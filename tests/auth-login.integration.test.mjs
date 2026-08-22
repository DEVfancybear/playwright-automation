import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUTH_SCRIPT = path.resolve(process.env.AUTH_SCRIPT_UNDER_TEST || path.join(ROOT, 'scripts', 'auth-login.mjs'));
const TEST_USER = 'qa-user-never-log-this';
const TEST_PASS = 'PW_SECRET_never_log_this_90210';
const TEST_TOTP = 'JBSWY3DPEHPK3PXP';
const counters = { delayedLogin: 0, productLogin: 0, twoStepLogin: 0, otpSubmit: 0 };

let server;
let baseUrl;

before(async () => {
  server = createServer(handleRequest);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('refreshes a stale session when the SPA login form renders late', { timeout: 30_000 }, async () => {
  const fixture = makeFixture('delayed-session');
  try {
    writeFileSync(fixture.state, JSON.stringify({
      cookies: [{
        name: 'session', value: 'stale', domain: '127.0.0.1', path: '/', expires: -1,
        httpOnly: false, secure: false, sameSite: 'Lax',
      }],
      origins: [],
    }));

    const result = await runAuth('/delayed-login', fixture);
    assert.equal(result.code, 0, result.output);
    assert.equal(counters.delayedLogin, 1, result.output);
    assert.equal(cookieValue(fixture.state, 'session'), 'delayed-valid');
    assertNoSecrets(result.output);

    const reused = await runAuth('/delayed-login', fixture);
    assert.equal(reused.code, 0, reused.output);
    assert.equal(counters.delayedLogin, 1, 'an Account form plus unrelated Continue must not invalidate a good session');
    assert.match(reused.output, /Phiên còn dùng được, bỏ qua đăng nhập/);
    assertNoSecrets(reused.output);
  } finally {
    fixture.cleanup();
  }
});

test('does not trust a storage sidecar from a different login target', { timeout: 30_000 }, async () => {
  const fixture = makeFixture('wrong-target-sidecar');
  const before = counters.delayedLogin;
  try {
    writeFileSync(fixture.state, JSON.stringify({
      cookies: [{
        name: 'session', value: 'product-valid', domain: '127.0.0.1', path: '/', expires: -1,
        httpOnly: false, secure: false, sameSite: 'Lax',
      }],
      origins: [],
    }));
    writeFileSync(fixture.meta, JSON.stringify({
      loginUrl: `${baseUrl}/product-login`,
      landingUrl: `${baseUrl}/product-dashboard`,
    }));

    const result = await runAuth('/delayed-login', fixture);
    assert.equal(result.code, 0, result.output);
    assert.equal(counters.delayedLogin, before + 1, 'target change must force verification/login on the requested URL');
    assert.equal(cookieValue(fixture.state, 'session'), 'delayed-valid');
    assertNoSecrets(result.output);
  } finally {
    fixture.cleanup();
  }
});

test('binds a storage sidecar to the complete query-scoped login URL', { timeout: 30_000 }, async () => {
  const fixture = makeFixture('query-target-sidecar');
  const before = counters.delayedLogin;
  try {
    writeFileSync(fixture.state, JSON.stringify({
      cookies: [{
        name: 'session', value: 'product-valid', domain: '127.0.0.1', path: '/', expires: -1,
        httpOnly: false, secure: false, sameSite: 'Lax',
      }],
      origins: [],
    }));
    writeFileSync(fixture.meta, JSON.stringify({
      loginUrl: `${baseUrl}/delayed-login?tenant=old`,
      landingUrl: `${baseUrl}/product-dashboard`,
    }));

    const result = await runAuth('/delayed-login?tenant=new', fixture);
    assert.equal(result.code, 0, result.output);
    assert.equal(counters.delayedLogin, before + 1, 'query-scoped target change must not reuse old sidecar metadata');
    assert.equal(cookieValue(fixture.state, 'session'), 'delayed-valid');
    assertNoSecrets(result.output);
  } finally {
    fixture.cleanup();
  }
});

test('does not collapse trailing-slash login targets in sidecar identity', { timeout: 30_000 }, async () => {
  const fixture = makeFixture('slash-target-sidecar');
  const before = counters.delayedLogin;
  try {
    writeFileSync(fixture.state, JSON.stringify({
      cookies: [{
        name: 'session', value: 'product-valid', domain: '127.0.0.1', path: '/', expires: -1,
        httpOnly: false, secure: false, sameSite: 'Lax',
      }],
      origins: [],
    }));
    writeFileSync(fixture.meta, JSON.stringify({
      loginUrl: `${baseUrl}/delayed-login`,
      landingUrl: `${baseUrl}/product-dashboard`,
    }));

    const result = await runAuth('/delayed-login/', fixture);
    assert.equal(result.code, 0, result.output);
    assert.equal(counters.delayedLogin, before + 1, 'trailing-slash target change must verify the requested URL');
    assert.equal(cookieValue(fixture.state, 'session'), 'delayed-valid');
    assertNoSecrets(result.output);
  } finally {
    fixture.cleanup();
  }
});

test('check mode rejects bare HTTP auth and server errors without a login form', { timeout: 30_000 }, async () => {
  for (const [route, status] of [['/unauthorized', 401], ['/server-error', 500]]) {
    const fixture = makeFixture(`http-${status}`);
    try {
      writeFileSync(fixture.state, JSON.stringify({
        cookies: [{
          name: 'session', value: 'stale', domain: '127.0.0.1', path: '/', expires: -1,
          httpOnly: false, secure: false, sameSite: 'Lax',
        }],
        origins: [],
      }));
      writeFileSync(fixture.meta, JSON.stringify({
        loginUrl: `${baseUrl}/delayed-login`,
        landingUrl: `${baseUrl}${route}`,
      }));

      const result = await runAuth('/delayed-login', fixture, ['--check']);
      assert.equal(result.code, 3, result.output);
      assert.match(result.output, new RegExp(`HTTP ${status}`));
      assertNoSecrets(result.output);
    } finally {
      fixture.cleanup();
    }
  }
});

test('does not classify a dashboard promoCode input as OTP', { timeout: 30_000 }, async () => {
  const fixture = makeFixture('product-code');
  try {
    writeFileSync(fixture.envFile, `TEST_USER=${TEST_USER}\nTEST_PASS=${TEST_PASS}\n`);
    const result = await runAuth('/product-login', fixture, ['--success-url', '/product-dashboard'], {
      TEST_USER: undefined,
      TEST_PASS: undefined,
      TEST_TOTP_SECRET: undefined,
    });
    assert.equal(result.code, 0, result.output);
    assert.equal(counters.productLogin, 1, result.output);
    assert.equal(cookieValue(fixture.state, 'session'), 'product-valid');
    assertNoSecrets(result.output);

    const reused = await runAuth('/product-login', fixture, ['--success-url', '/product-dashboard'], {
      TEST_USER: undefined,
      TEST_PASS: undefined,
      TEST_TOTP_SECRET: undefined,
    });
    assert.equal(reused.code, 0, reused.output);
    assert.equal(counters.productLogin, 1, 'ensure mode must reuse the valid storageState');
    assert.match(reused.output, /Phiên còn dùng được, bỏ qua đăng nhập/);
    assertNoSecrets(reused.output);
  } finally {
    fixture.cleanup();
  }
});

test('waits for custom password selector in a delayed two-step form', { timeout: 30_000 }, async () => {
  const fixture = makeFixture('two-step');
  try {
    writeFileSync(fixture.state, JSON.stringify({
      cookies: [{
        name: 'session', value: 'stale', domain: '127.0.0.1', path: '/', expires: -1,
        httpOnly: false, secure: false, sameSite: 'Lax',
      }],
      origins: [],
    }));
    const result = await runAuth('/two-step-login', fixture, [
      '--user-selector', '#account',
      '--next-selector', '#advance',
      '--pass-selector', '#secret',
      '--submit-selector', '#signin',
    ]);
    assert.equal(result.code, 0, result.output);
    assert.equal(counters.twoStepLogin, 1, result.output);
    assert.equal(cookieValue(fixture.state, 'session'), 'two-step-valid');
    assertNoSecrets(result.output);
  } finally {
    fixture.cleanup();
  }
});

test('waits for delayed TOTP and saves only the final authenticated state', { timeout: 30_000 }, async () => {
  const fixture = makeFixture('delayed-otp');
  try {
    const result = await runAuth('/otp-login', fixture, ['--success-url', '/otp-dashboard'], {
      TEST_TOTP_SECRET: TEST_TOTP,
    });
    assert.equal(result.code, 0, result.output);
    assert.equal(counters.otpSubmit, 1, result.output);
    assert.equal(cookieValue(fixture.state, 'session'), 'otp-valid');
    assertNoSecrets(result.output);
  } finally {
    fixture.cleanup();
  }
});

test('redacts credential values from Playwright fill errors', { timeout: 15_000 }, async () => {
  const fixture = makeFixture('disabled-password');
  try {
    const debugFile = path.join(fixture.dir, 'playwright-debug.log');
    const result = await runAuth('/disabled-login', fixture, ['--pass-selector', '#file-pass'], {
      DEBUG: 'pw:api',
      DEBUG_FILE: debugFile,
      PWDEBUG: 'console',
      PWDEBUGIMPL: '1',
    }, '1500');
    assert.notEqual(result.code, 0, result.output);
    assertNoSecrets(result.output);
    assert.match(result.output, /\[REDACTED\]/);
    if (existsSync(debugFile)) assertNoSecrets(readFileSync(debugFile, 'utf8'));
  } finally {
    fixture.cleanup();
  }
});

test('redacts credential values echoed by application error text', { timeout: 15_000 }, async () => {
  const fixture = makeFixture('echo-error');
  try {
    const result = await runAuth('/echo-login', fixture, [], {}, '1500');
    assert.notEqual(result.code, 0, result.output);
    assertNoSecrets(result.output);
    assert.match(result.output, /\[REDACTED\]/);
  } finally {
    fixture.cleanup();
  }
});

test('redacts generated TOTP from Playwright fill errors', { timeout: 15_000 }, async () => {
  const fixture = makeFixture('readonly-otp');
  try {
    const result = await runAuth('/readonly-otp-login', fixture, [], {
      TEST_TOTP_SECRET: TEST_TOTP,
      DEBUG: 'pw:api',
      PWDEBUG: 'console',
      PWDEBUGIMPL: '1',
    }, '1500');
    assert.notEqual(result.code, 0, result.output);
    assert.doesNotMatch(result.output, /fill\("\d{6}"\)/);
    assert.doesNotMatch(result.output, new RegExp(escapeRegExp(TEST_TOTP)));
    assert.match(result.output, /\[REDACTED\]/);
  } finally {
    fixture.cleanup();
  }
});

test('fails closed before browser spawn when NODE_DEBUG can dump the secret environment', { timeout: 15_000 }, async () => {
  const fixture = makeFixture('node-debug-child-process');
  try {
    const result = await runAuth('/otp-login', fixture, [], {
      TEST_TOTP_SECRET: TEST_TOTP,
      NODE_DEBUG: 'child*',
    }, '1500');
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /unset NODE_DEBUG\/NODE_DEBUG_NATIVE/);
    assertNoSecrets(result.output);
  } finally {
    fixture.cleanup();
  }
});

function makeFixture(name) {
  const dir = mkdtempSync(path.join(tmpdir(), `pw-auth-${name}-`));
  const state = path.join(dir, 'state.json');
  const meta = state.replace(/\.json$/i, '') + '.meta.json';
  const envFile = path.join(dir, 'empty.env');
  writeFileSync(envFile, '# intentionally empty\n');
  return {
    dir,
    state,
    meta,
    envFile,
    cleanup() {
      const resolved = path.resolve(dir);
      const tempRoot = path.resolve(tmpdir());
      assert.ok(resolved.startsWith(tempRoot + path.sep), `unsafe temp cleanup target: ${resolved}`);
      rmSync(resolved, { recursive: true, force: true });
    },
  };
}

async function runAuth(route, fixture, extraArgs = [], envPatch = {}, timeout = '6000') {
  const env = {
    ...process.env,
    TEST_USER,
    TEST_PASS,
    TEST_TOTP_SECRET: undefined,
    ...envPatch,
  };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }

  const args = [
    AUTH_SCRIPT,
    '--url', `${baseUrl}${route}`,
    '--out', fixture.state,
    '--env', fixture.envFile,
    '--timeout', timeout,
    ...extraArgs,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, env, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => {
      const result = { code, stdout, stderr, output: `${stdout}\n${stderr}` };
      const expectedMarker = process.env.AUTH_EXPECT_MUTANT_MARKER;
      try {
        if (expectedMarker) {
          assert.match(result.output, new RegExp(`AUTH_MUTANT_EXECUTED:${escapeRegExp(expectedMarker)}`));
          process.stdout.write(`[mutant-executed:${expectedMarker}]\n`);
        }
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function cookieValue(statePath, name) {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  return state.cookies.find(cookie => cookie.name === name)?.value;
}

function assertNoSecrets(output) {
  assert.doesNotMatch(output, new RegExp(escapeRegExp(TEST_USER)));
  assert.doesNotMatch(output, new RegExp(escapeRegExp(TEST_PASS)));
  assert.doesNotMatch(output, new RegExp(escapeRegExp(TEST_TOTP)));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function handleRequest(request, response) {
  const url = new URL(request.url, baseUrl || 'http://127.0.0.1');
  const cookies = request.headers.cookie || '';

  const postBody = request.method === 'POST' ? await readBody(request) : '';

  if (url.pathname === '/delayed-login' || url.pathname === '/delayed-login/') {
    if (cookies.includes('session=delayed-valid')) return redirect(response, '/delayed-dashboard');
    return html(response, delayedForm('/do-delayed-login', 700));
  }
  if (url.pathname === '/do-delayed-login' && request.method === 'POST') {
    counters.delayedLogin += 1;
    return redirect(response, '/delayed-dashboard', 'session=delayed-valid; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/delayed-dashboard') {
    return cookies.includes('session=delayed-valid')
      ? html(response, '<h1>Delayed dashboard</h1><form><label>Account <input name="account"></label><button type="submit">Save</button></form><aside><button>Continue</button></aside>')
      : redirect(response, '/delayed-login');
  }

  if (url.pathname === '/product-login') return html(response, loginForm('/do-product-login'));
  if (url.pathname === '/do-product-login' && request.method === 'POST') {
    counters.productLogin += 1;
    return redirect(response, '/product-dashboard', 'session=product-valid; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/product-dashboard') {
    return cookies.includes('session=product-valid')
      ? html(response, '<h1>Product dashboard</h1><label>Promo code <input name="promoCode"></label>')
      : redirect(response, '/product-login');
  }

  if (url.pathname === '/two-step-login') return html(response, twoStepForm());
  if (url.pathname === '/do-two-step' && request.method === 'POST') {
    counters.twoStepLogin += 1;
    return redirect(response, '/two-step-dashboard', 'session=two-step-valid; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/two-step-dashboard') {
    return cookies.includes('session=two-step-valid')
      ? html(response, '<h1>Two-step dashboard</h1>')
      : redirect(response, '/two-step-login');
  }

  if (url.pathname === '/otp-login') return html(response, loginForm('/do-password'));
  if (url.pathname === '/do-password' && request.method === 'POST') {
    return redirect(response, '/otp-challenge', 'preauth=yes; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/otp-challenge') {
    if (cookies.includes('session=otp-valid')) return redirect(response, '/otp-dashboard');
    if (!cookies.includes('preauth=yes')) return redirect(response, '/otp-login');
    return html(response, delayedOtpForm(700));
  }
  if (url.pathname === '/do-otp' && request.method === 'POST') {
    const submitted = new URLSearchParams(postBody).get('otp') ?? '';
    const accepted = [-1, 0, 1].map(offset => testTotp(TEST_TOTP, offset));
    if (!/^\d{6}$/.test(submitted) || !accepted.includes(submitted)) {
      return html(response, `<div role="alert">Invalid OTP</div>${delayedOtpForm(0)}`, 401);
    }
    counters.otpSubmit += 1;
    return redirect(response, '/otp-dashboard', 'session=otp-valid; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/otp-dashboard') {
    return cookies.includes('session=otp-valid')
      ? html(response, '<h1>OTP dashboard</h1>')
      : redirect(response, '/otp-login');
  }

  if (url.pathname === '/disabled-login') {
    return html(response, `<form>
      <label>Username <input name="username"></label>
      <label>Password <input id="file-pass" type="file" name="password"></label>
      <button type="submit">Login</button>
    </form>`);
  }

  if (url.pathname === '/echo-login') return html(response, loginForm('/do-echo-login'));
  if (url.pathname === '/do-echo-login' && request.method === 'POST') {
    return html(response, `<div role="alert">Invalid ${TEST_USER} / ${TEST_PASS}</div>${loginForm('/do-echo-login')}`);
  }

  if (url.pathname === '/readonly-otp-login') return html(response, loginForm('/do-readonly-password'));
  if (url.pathname === '/do-readonly-password' && request.method === 'POST') {
    return redirect(response, '/readonly-otp-challenge', 'preauth=readonly; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/readonly-otp-challenge') {
    return html(response, `<form>
      <label>Authentication code <input type="file" name="otp" autocomplete="one-time-code"></label>
      <button type="submit">Verify</button>
    </form>`);
  }

  if (url.pathname === '/unauthorized') return html(response, '<h1>Unauthorized</h1>', 401);
  if (url.pathname === '/server-error') return html(response, '<h1>Server error</h1>', 500);

  response.writeHead(404, { 'content-type': 'text/plain' });
  response.end('not found');
}

function html(response, body, status = 200) {
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html><body>${body}</body></html>`);
}

function redirect(response, location, cookie) {
  const headers = { location };
  if (cookie) headers['set-cookie'] = cookie;
  response.writeHead(302, headers);
  response.end();
}

function loginForm(action) {
  return `<form method="post" action="${action}">
    <label>Username <input name="username"></label>
    <label>Password <input type="password" name="password"></label>
    <button type="submit">Login</button>
  </form>`;
}

function delayedForm(action, delay) {
  return `<p id="loading">Loading</p><script>
    setTimeout(() => { document.body.innerHTML = ${JSON.stringify(loginForm(action))}; }, ${delay});
  </script>`;
}

function twoStepForm() {
  const secondStep = `<form method="post" action="/do-two-step">
    <label>Secret <input id="secret" name="secret"></label>
    <button id="signin" type="submit">Sign in</button>
  </form>`;
  return `<label>Account <input id="account"></label><button id="advance" type="button">Next</button>
    <script>document.querySelector('#advance').addEventListener('click', () => {
      setTimeout(() => { document.body.innerHTML = ${JSON.stringify(secondStep)}; }, 700);
    });</script>`;
}

function delayedOtpForm(delay) {
  const otpForm = `<form method="post" action="/do-otp">
    <label>Authentication code <input name="otp" autocomplete="one-time-code"></label>
    <button type="submit">Verify</button>
  </form>`;
  return `<p id="loading">Preparing verification</p><script>
    setTimeout(() => { document.body.innerHTML = ${JSON.stringify(otpForm)}; }, ${delay});
  </script>`;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function testTotp(secret, counterOffset = 0) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const character of secret.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const counter = Math.floor(Date.now() / 1000 / 30) + counterOffset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hash = crypto.createHmac('sha1', Buffer.from(bytes)).update(buffer).digest();
  const offset = hash.at(-1) & 0x0f;
  const code = (((hash[offset] & 0x7f) << 24)
    | ((hash[offset + 1] & 0xff) << 16)
    | ((hash[offset + 2] & 0xff) << 8)
    | (hash[offset + 3] & 0xff)) % 1_000_000;
  return String(code).padStart(6, '0');
}

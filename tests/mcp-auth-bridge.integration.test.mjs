import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const initModuleUrl = process.env.BRIDGE_INIT_UNDER_TEST
  ? pathToFileURL(path.resolve(process.env.BRIDGE_INIT_UNDER_TEST)).href
  : new URL('../scripts/mcp-auth-init.mjs', import.meta.url).href;
const initModule = await import(initModuleUrl);
const {
  installAuthBridge,
  loadBridgeConfig,
  matchesExactLoginUrl,
} = initModule;
const require = createRequire(import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRAPPER = process.env.BRIDGE_WRAPPER_UNDER_TEST
  ? path.resolve(process.env.BRIDGE_WRAPPER_UNDER_TEST)
  : path.join(ROOT, 'scripts', 'mcp-auth-bridge.mjs');
const TEST_USER = 'cms-admin-bridge@example.test';
const TEST_PASS = 'bridge-password-never-print';
const TEST_TOTP = 'JBSWY3DPEHPK3PXP';

let server;
let browser;
let baseUrl;
const counters = {
  oneStep: 0,
  twoStep: 0,
  otp: 0,
  lookalike: 0,
};

test.before(async () => {
  server = createServer(handleRequest);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  await browser?.close();
  await new Promise(resolve => server?.close(resolve));
});

test.beforeEach(() => {
  for (const key of Object.keys(counters)) counters[key] = 0;
});

test('wrapper dry-run pins extension MCP and never prints dotenv values', async () => {
  const fixture = makeFixture();
  try {
    const result = await runWrapper([
      '--env', fixture.envFile,
      '--login-url', `${baseUrl}/one-step-login`,
      '--dry-run',
    ]);

    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /@playwright\/mcp@0\.0\.79/);
    assert.match(result.output, /--extension/);
    assert.match(result.output, /--init-page/);
    assert.match(result.output, /mcp-auth-init\.cjs/);
    assert.match(result.output, /--secrets/);
    assert.match(result.output, /TEST_USER/);
    assert.match(result.output, /TEST_PASS/);
    assertNoSecrets(result.output);
  } finally {
    fixture.cleanup();
  }
});

test('wrapper only forwards TLS bypass after explicit non-production confirmation', async () => {
  const fixture = makeFixture();
  try {
    const blocked = await runWrapper([
      '--env', fixture.envFile,
      '--login-url', 'https://staging.example.test/login',
      '--ignore-https-errors',
      '--dry-run',
    ]);
    assert.equal(blocked.code, 1, blocked.output);
    assert.match(blocked.output, /confirm-non-production/);

    const allowed = await runWrapper([
      '--env', fixture.envFile,
      '--login-url', 'https://staging.example.test/login',
      '--ignore-https-errors',
      '--confirm-non-production',
      '--dry-run',
    ]);
    assert.equal(allowed.code, 0, allowed.output);
    assert.match(allowed.output, /--ignore-https-errors/);
    assert.match(allowed.output, /bypassed for confirmed non-production origin/);
    assertNoSecrets(allowed.output);
  } finally {
    fixture.cleanup();
  }
});

test('wrapper fails closed for missing credentials, unsafe URL, and NODE_DEBUG', async () => {
  const fixture = makeFixture('# empty on purpose\n');
  try {
    const missing = await runWrapper([
      '--env', fixture.envFile,
      '--login-url', `${baseUrl}/one-step-login`,
      '--dry-run',
    ]);
    assert.equal(missing.code, 1, missing.output);
    assert.match(missing.output, /TEST_USER.*TEST_PASS|TEST_PASS.*TEST_USER/);

    const unsafe = await runWrapper([
      '--env', fixture.validEnvFile,
      '--login-url', 'file:///tmp/lookalike.html',
      '--dry-run',
    ]);
    assert.equal(unsafe.code, 1, unsafe.output);
    assert.match(unsafe.output, /http.*https/i);
    assertNoSecrets(unsafe.output);

    const debug = await runWrapper([
      '--env', fixture.validEnvFile,
      '--login-url', `${baseUrl}/one-step-login`,
      '--dry-run',
    ], { NODE_DEBUG: 'child*' });
    assert.equal(debug.code, 1, debug.output);
    assert.match(debug.output, /NODE_DEBUG/);
    assertNoSecrets(debug.output);
  } finally {
    fixture.cleanup();
  }
});

test('exact URL matching rejects hostile origin, path, query, and fragment variants', () => {
  const allowed = ['https://staging.example.test/login?role=admin#form'];
  assert.equal(matchesExactLoginUrl(allowed[0], allowed), true);

  const hostile = [
    'http://staging.example.test/login?role=admin#form',
    'https://staging.example.test.evil.test/login?role=admin#form',
    'https://staging.example.test/Login?role=admin#form',
    'https://staging.example.test/login?role=partner#form',
    'https://staging.example.test/login?role=admin',
    'https://user@staging.example.test/login?role=admin#form',
  ];
  for (const candidate of hostile) {
    assert.equal(matchesExactLoginUrl(candidate, allowed), false, candidate);
  }
});

test('loads named credentials locally without inferring their account format', () => {
  const fixture = makeFixture([
    'CMS_ADMIN_USER=0912345678',
    'CMS_ADMIN_PASS=123456',
    'CMS_ADMIN_TOTP=JBSWY3DPEHPK3PXP',
    '',
  ].join('\n'));
  try {
    const config = loadBridgeConfig({
      PW_AUTH_BRIDGE_ENV_FILE: fixture.envFile,
      PW_AUTH_BRIDGE_LOGIN_URLS: JSON.stringify([`${baseUrl}/one-step-login`]),
      PW_AUTH_BRIDGE_USER_ENV: 'CMS_ADMIN_USER',
      PW_AUTH_BRIDGE_PASS_ENV: 'CMS_ADMIN_PASS',
      PW_AUTH_BRIDGE_TOTP_ENV: 'CMS_ADMIN_TOTP',
    });

    assert.equal(config.username, '0912345678');
    assert.equal(config.password, '123456');
    assert.equal(config.totpSecret, TEST_TOTP);
  } finally {
    fixture.cleanup();
  }
});

test('local bridge logs in a one-step form without exposing credentials', { timeout: 20_000 }, async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = [];
  try {
    await installAuthBridge(page, bridgeConfig({
      loginUrls: [`${baseUrl}/one-step-login`],
      logger: message => logs.push(message),
    }));

    await page.goto(`${baseUrl}/one-step-login`);
    await expect(page).toHaveURL(`${baseUrl}/one-step-dashboard`);
    await expect(page.getByRole('heading', { name: 'One-step dashboard' })).toBeVisible();
    assert.equal(counters.oneStep, 1);
    assertNoSecrets(logs.join('\n'));
  } finally {
    await context.close();
  }
});

test('MCP init-page default receives the Playwright Page directly', { timeout: 20_000 }, async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const fixture = makeFixture();
  const originalEnv = { ...process.env };
  try {
    Object.assign(process.env, {
      PW_AUTH_BRIDGE_ENV_FILE: fixture.envFile,
      PW_AUTH_BRIDGE_LOGIN_URLS: JSON.stringify([`${baseUrl}/one-step-login`]),
      PW_AUTH_BRIDGE_USER_ENV: 'TEST_USER',
      PW_AUTH_BRIDGE_PASS_ENV: 'TEST_PASS',
    });
    const { default: initMcpAuthBridge } = require('../scripts/mcp-auth-init.cjs');
    await initMcpAuthBridge(page);
    await page.goto(`${baseUrl}/one-step-login`);
    await expect(page).toHaveURL(`${baseUrl}/one-step-dashboard`);
    assert.equal(counters.oneStep, 1);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    fixture.cleanup();
    await context.close();
  }
});

test('local bridge selects a role and completes delayed two-step login', { timeout: 20_000 }, async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = [];
  try {
    await installAuthBridge(page, bridgeConfig({
      loginUrls: [`${baseUrl}/two-step-login`],
      selectSelector: '#role',
      selectValue: 'admin',
      userSelector: '#account',
      nextSelector: '#next',
      passSelector: '#password',
      submitSelector: '#submit',
      logger: message => logs.push(message),
    }));

    await page.goto(`${baseUrl}/two-step-login`);
    await expect(page).toHaveURL(`${baseUrl}/two-step-dashboard`);
    await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();
    assert.equal(counters.twoStep, 1);
    assertNoSecrets(logs.join('\n'));
  } finally {
    await context.close();
  }
});

test('local bridge completes a delayed TOTP challenge without exposing its code', { timeout: 20_000 }, async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = [];
  try {
    await installAuthBridge(page, bridgeConfig({
      loginUrls: [`${baseUrl}/otp-login`, `${baseUrl}/otp-challenge`],
      totpSecret: TEST_TOTP,
      logger: message => logs.push(message),
    }));

    await page.goto(`${baseUrl}/otp-login`);
    await expect(page).toHaveURL(`${baseUrl}/otp-dashboard`);
    await expect(page.getByRole('heading', { name: 'OTP dashboard' })).toBeVisible();
    assert.equal(counters.otp, 1);
    const combined = logs.join('\n');
    assertNoSecrets(combined);
    assert.doesNotMatch(combined, /\b\d{6}\b/);
  } finally {
    await context.close();
  }
});

test('local bridge ignores an identical form on an unconfigured URL', { timeout: 20_000 }, async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await installAuthBridge(page, bridgeConfig({
      loginUrls: [`${baseUrl}/one-step-login`],
    }));

    await page.goto(`${baseUrl}/lookalike-login`);
    await expect(page.getByLabel('Username')).toHaveValue('');
    await expect(page.getByLabel('Password')).toHaveValue('');
    assert.equal(counters.lookalike, 0);
  } finally {
    await context.close();
  }
});

function bridgeConfig(overrides = {}) {
  return {
    loginUrls: [],
    username: TEST_USER,
    password: TEST_PASS,
    totpSecret: undefined,
    timeout: 3_000,
    logger: () => {},
    ...overrides,
  };
}

function makeFixture(contents = `TEST_USER=${TEST_USER}\nTEST_PASS=${TEST_PASS}\nTEST_TOTP_SECRET=${TEST_TOTP}\n`) {
  const dir = mkdtempSync(path.join(tmpdir(), 'pw-mcp-auth-bridge-'));
  const envFile = path.join(dir, '.env');
  const validEnvFile = path.join(dir, 'valid.env');
  writeFileSync(envFile, contents);
  writeFileSync(validEnvFile, `TEST_USER=${TEST_USER}\nTEST_PASS=${TEST_PASS}\n`);
  return {
    dir,
    envFile,
    validEnvFile,
    cleanup() {
      const resolved = path.resolve(dir);
      const tempRoot = path.resolve(tmpdir());
      assert.ok(resolved.startsWith(tempRoot + path.sep), `unsafe temp cleanup target: ${resolved}`);
      rmSync(resolved, { recursive: true, force: true });
    },
  };
}

function runWrapper(args, envPatch = {}) {
  const env = { ...process.env, ...envPatch };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WRAPPER, ...args], {
      cwd: ROOT,
      env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout, stderr, output: `${stdout}\n${stderr}` }));
  });
}

function assertNoSecrets(output) {
  assert.doesNotMatch(output, new RegExp(escapeRegExp(TEST_USER)));
  assert.doesNotMatch(output, new RegExp(escapeRegExp(TEST_PASS)));
  assert.doesNotMatch(output, new RegExp(escapeRegExp(TEST_TOTP)));
}

async function handleRequest(request, response) {
  const url = new URL(request.url, baseUrl || 'http://127.0.0.1');
  const body = request.method === 'POST' ? await readBody(request) : '';
  const cookies = request.headers.cookie || '';

  if (url.pathname === '/one-step-login') return html(response, loginForm('/do-one-step'));
  if (url.pathname === '/do-one-step' && request.method === 'POST') {
    const form = new URLSearchParams(body);
    if (form.get('username') !== TEST_USER || form.get('password') !== TEST_PASS) {
      return html(response, `<div role="alert">Invalid ${TEST_USER} ${TEST_PASS}</div>${loginForm('/do-one-step')}`, 401);
    }
    counters.oneStep += 1;
    return redirect(response, '/one-step-dashboard', 'session=one-step; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/one-step-dashboard') {
    return cookies.includes('session=one-step')
      ? html(response, '<h1>One-step dashboard</h1>')
      : redirect(response, '/one-step-login');
  }

  if (url.pathname === '/two-step-login') return html(response, twoStepForm());
  if (url.pathname === '/do-two-step' && request.method === 'POST') {
    const form = new URLSearchParams(body);
    if (form.get('role') !== 'admin' || form.get('username') !== TEST_USER || form.get('password') !== TEST_PASS) {
      return html(response, '<div role="alert">Invalid admin login</div>', 401);
    }
    counters.twoStep += 1;
    return redirect(response, '/two-step-dashboard', 'session=two-step; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/two-step-dashboard') {
    return cookies.includes('session=two-step')
      ? html(response, '<h1>Admin dashboard</h1>')
      : redirect(response, '/two-step-login');
  }

  if (url.pathname === '/otp-login') return html(response, loginForm('/do-otp-password'));
  if (url.pathname === '/do-otp-password' && request.method === 'POST') {
    const form = new URLSearchParams(body);
    if (form.get('username') !== TEST_USER || form.get('password') !== TEST_PASS) {
      return html(response, '<div role="alert">Invalid password</div>', 401);
    }
    return redirect(response, '/otp-challenge', 'preauth=otp; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/otp-challenge') {
    return cookies.includes('preauth=otp')
      ? html(response, delayedOtpForm(200))
      : redirect(response, '/otp-login');
  }
  if (url.pathname === '/do-otp' && request.method === 'POST') {
    const submitted = new URLSearchParams(body).get('otp') ?? '';
    const accepted = [-1, 0, 1].map(offset => testTotp(TEST_TOTP, offset));
    if (!accepted.includes(submitted)) return html(response, '<div role="alert">Invalid OTP</div>', 401);
    counters.otp += 1;
    return redirect(response, '/otp-dashboard', 'session=otp; Path=/; SameSite=Lax');
  }
  if (url.pathname === '/otp-dashboard') {
    return cookies.includes('session=otp')
      ? html(response, '<h1>OTP dashboard</h1>')
      : redirect(response, '/otp-login');
  }

  if (url.pathname === '/lookalike-login') {
    return html(response, loginForm('/do-lookalike'));
  }
  if (url.pathname === '/do-lookalike' && request.method === 'POST') {
    counters.lookalike += 1;
    return html(response, '<h1>Should never submit</h1>');
  }

  response.writeHead(404, { 'content-type': 'text/plain' });
  response.end('not found');
}

function loginForm(action) {
  return `<form method="post" action="${action}">
    <label>Username <input name="username"></label>
    <label>Password <input type="password" name="password"></label>
    <button type="submit">Login</button>
  </form>`;
}

function twoStepForm() {
  return `<form method="post" action="/do-two-step">
    <input id="role-value" type="hidden" name="role" value="partner">
    <button id="role" type="button" role="combobox" aria-expanded="false" aria-controls="role-options">Partner</button>
    <div id="role-options" role="listbox" hidden>
      <button type="button" role="option" data-value="partner">Partner</button>
      <button type="button" role="option" data-value="admin">Administrator</button>
    </div>
    <label>Account <input id="account" name="username"></label>
    <button id="next" type="button">Next</button>
    <section id="second"></section>
  </form>
  <script>
  const role = document.querySelector('#role');
  const options = document.querySelector('#role-options');
  role.addEventListener('click', () => {
    const open = options.hidden;
    options.hidden = !open;
    role.setAttribute('aria-expanded', String(open));
  });
  options.addEventListener('click', event => {
    const option = event.target.closest('[role="option"]');
    if (!option) return;
    document.querySelector('#role-value').value = option.dataset.value;
    role.textContent = option.textContent;
    options.hidden = true;
    role.setAttribute('aria-expanded', 'false');
  });
  document.querySelector('#next').addEventListener('click', () => {
    setTimeout(() => { document.querySelector('#second').innerHTML = ${JSON.stringify(`
      <label>Password <input id="password" type="password" name="password"></label>
      <button id="submit" type="submit">Sign in</button>
    `)}; }, 200);
  });
  </script>`;
}

function delayedOtpForm(delay) {
  const form = `<form method="post" action="/do-otp">
    <label>Authentication code <input name="otp" autocomplete="one-time-code"></label>
    <button type="submit">Verify</button>
  </form>`;
  return `<p>Preparing verification</p><script>
    setTimeout(() => { document.body.innerHTML = ${JSON.stringify(form)}; }, ${delay});
  </script>`;
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
    if (index < 0) throw new Error('invalid test TOTP secret');
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const USER_SELECTOR = [
  'input[autocomplete="username"]:visible',
  'input[type="email"]:visible',
  'input[name*="user" i]:visible',
  'input[name*="email" i]:visible',
  'input[name*="account" i]:visible',
  'input[type="tel"]:visible',
  'input[type="text"]:visible',
].join(', ');

const PASS_SELECTOR = [
  'input[type="password"]:visible',
  'input[autocomplete="current-password"]:visible',
  'input[name*="pass" i]:visible',
].join(', ');

const OTP_SELECTOR = [
  'input[autocomplete="one-time-code"]:visible',
  'input[inputmode="numeric"][maxlength="6"]:visible',
  'input[name*="otp" i]:visible',
  'input[name*="totp" i]:visible',
  'input[id*="otp" i]:visible',
  'input[id*="totp" i]:visible',
  'input[name*="auth" i][name*="code" i]:visible',
  'input[id*="auth" i][id*="code" i]:visible',
].join(', ');

export function readDotEnvFile(file) {
  const resolved = path.resolve(file);
  if (!existsSync(resolved)) throw new Error(`Không tìm thấy file env: ${resolved}`);

  const values = {};
  for (const raw of readFileSync(resolved, 'utf8').split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice('export '.length).trim();
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    values[key] = value;
  }
  return values;
}

export function loadBridgeConfig(runtimeEnv = process.env) {
  const envFile = runtimeEnv.PW_AUTH_BRIDGE_ENV_FILE;
  if (!envFile) throw new Error('Thiếu PW_AUTH_BRIDGE_ENV_FILE.');
  const dotenv = readDotEnvFile(envFile);
  const userKey = runtimeEnv.PW_AUTH_BRIDGE_USER_ENV || 'TEST_USER';
  const passKey = runtimeEnv.PW_AUTH_BRIDGE_PASS_ENV || 'TEST_PASS';
  const totpKey = runtimeEnv.PW_AUTH_BRIDGE_TOTP_ENV || 'TEST_TOTP_SECRET';
  const missing = [userKey, passKey].filter(key => !dotenv[key]);
  if (missing.length) throw new Error(`Thiếu credential trong file env: ${missing.join(', ')}`);

  let loginUrls;
  try {
    loginUrls = JSON.parse(runtimeEnv.PW_AUTH_BRIDGE_LOGIN_URLS || '[]');
  } catch {
    throw new Error('PW_AUTH_BRIDGE_LOGIN_URLS phải là JSON array.');
  }
  if (!Array.isArray(loginUrls) || loginUrls.length === 0) {
    throw new Error('Bridge yêu cầu ít nhất một exact login URL.');
  }

  const selectSelector = runtimeEnv.PW_AUTH_BRIDGE_SELECT_SELECTOR || undefined;
  const selectValue = runtimeEnv.PW_AUTH_BRIDGE_SELECT_VALUE || undefined;
  if (Boolean(selectSelector) !== Boolean(selectValue)) {
    throw new Error('Select bridge cần đủ selector và value.');
  }

  return normalizeConfig({
    loginUrls,
    username: dotenv[userKey],
    password: dotenv[passKey],
    totpSecret: dotenv[totpKey] || undefined,
    userSelector: runtimeEnv.PW_AUTH_BRIDGE_USER_SELECTOR || undefined,
    nextSelector: runtimeEnv.PW_AUTH_BRIDGE_NEXT_SELECTOR || undefined,
    passSelector: runtimeEnv.PW_AUTH_BRIDGE_PASS_SELECTOR || undefined,
    submitSelector: runtimeEnv.PW_AUTH_BRIDGE_SUBMIT_SELECTOR || undefined,
    otpSelector: runtimeEnv.PW_AUTH_BRIDGE_OTP_SELECTOR || undefined,
    selectSelector,
    selectValue,
    timeout: Number(runtimeEnv.PW_AUTH_BRIDGE_TIMEOUT) || 30_000,
  });
}

export function matchesExactLoginUrl(candidate, loginUrls) {
  let href;
  try {
    href = new URL(candidate).href;
  } catch {
    return false;
  }
  return loginUrls.some(loginUrl => {
    try {
      return new URL(loginUrl).href === href;
    } catch {
      return false;
    }
  });
}

export async function installAuthBridge(page, inputConfig = loadBridgeConfig()) {
  const config = normalizeConfig(inputConfig);
  const attemptedUrls = new Set();
  const sensitive = [config.username, config.password, config.totpSecret].filter(Boolean);
  const report = message => {
    const redacted = redact(message, sensitive);
    (config.logger || defaultLogger)(redacted);
  };

  let disposed = false;
  let running = false;
  let pending = false;

  const run = async () => {
    pending = true;
    if (running || disposed) return;
    running = true;
    try {
      while (pending && !disposed) {
        pending = false;
        const currentUrl = page.url();
        trace(`observe ${safeUrl(currentUrl)}`);
        if (!matchesExactLoginUrl(currentUrl, config.loginUrls)) {
          trace('ignore non-configured URL');
          attemptedUrls.clear();
          continue;
        }
        const exactUrl = new URL(currentUrl).href;
        if (attemptedUrls.has(exactUrl)) continue;
        attemptedUrls.add(exactUrl);
        trace('attempt configured login URL');
        try {
          await authenticateCurrentPage(page, config);
          trace('authentication action completed');
        } catch (error) {
          trace(`authentication error: ${redact(error.message, sensitive)}`);
          if (!isPageGone(error)) report(`MCP auth bridge bị chặn tại ${safeUrl(currentUrl)}: ${error.message}`);
        }
      }
    } finally {
      running = false;
    }
  };

  const onDomContentLoaded = () => { void run(); };
  const onFrameNavigated = frame => {
    if (frame !== page.mainFrame()) return;
    void page.waitForLoadState('domcontentloaded', { timeout: config.timeout })
      .then(run)
      .catch(error => {
        if (!isPageGone(error)) report(`MCP auth bridge không chờ được DOM: ${error.message}`);
      });
  };
  page.on('domcontentloaded', onDomContentLoaded);
  page.on('framenavigated', onFrameNavigated);
  await run();

  return {
    runNow: run,
    dispose() {
      disposed = true;
      page.off('domcontentloaded', onDomContentLoaded);
      page.off('framenavigated', onFrameNavigated);
    },
  };
}

export default async function initMcpAuthBridge(page) {
  await installAuthBridge(page);
}

async function authenticateCurrentPage(page, config) {
  const authSurface = page.locator([
    config.otpSelector || OTP_SELECTOR,
    config.passSelector || PASS_SELECTOR,
    config.userSelector || USER_SELECTOR,
  ].join(', ')).first();
  await authSurface.waitFor({ state: 'visible', timeout: config.timeout });
  trace('auth surface visible');

  const otp = page.locator(config.otpSelector || OTP_SELECTOR).first();
  if (await isVisible(otp)) {
    trace('TOTP surface selected');
    if (!config.totpSecret) throw new Error('thiếu TOTP secret trong file env');
    const code = generateTotp(config.totpSecret);
    await otp.fill(code);
    const verify = config.submitSelector
      ? page.locator(config.submitSelector).first()
      : page.getByRole('button', { name: /verify|xác minh|continue|tiếp tục|submit/i }).first();
    await verify.click();
    return;
  }

  if (config.selectSelector) {
    trace('select configured option');
    const select = page.locator(config.selectSelector).first();
    await select.waitFor({ state: 'visible', timeout: config.timeout });
    await selectConfiguredOption(page, select, config.selectValue, config.timeout);
  }

  const user = page.locator(config.userSelector || USER_SELECTOR).first();
  const pass = page.locator(config.passSelector || PASS_SELECTOR).first();
  if (await isVisible(user)) await user.fill(config.username);

  if (!await isVisible(pass)) {
    trace('advance two-step form');
    const next = config.nextSelector
      ? page.locator(config.nextSelector).first()
      : page.getByRole('button', { name: /next|continue|tiếp tục|kế tiếp/i }).first();
    await next.click();
    await pass.waitFor({ state: 'visible', timeout: config.timeout });
  }

  await pass.fill(config.password);
  trace('credential fields filled locally');
  const submit = config.submitSelector
    ? page.locator(config.submitSelector).first()
    : page.getByRole('button', { name: /đăng nhập|login|log in|sign in/i }).first();
  await submit.click();
}

async function selectConfiguredOption(page, control, expected, timeout) {
  const tagName = await control.evaluate(element => element.tagName);
  if (tagName === 'SELECT') {
    try {
      await control.selectOption(expected);
    } catch {
      await control.selectOption({ label: expected });
    }
    return;
  }

  await control.click();
  const options = page.getByRole('option');
  await options.first().waitFor({ state: 'visible', timeout });

  const exactLabel = page.getByRole('option', { name: expected, exact: true }).first();
  if (await isVisible(exactLabel)) {
    await exactLabel.click();
    return;
  }

  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index);
    if (await option.getAttribute('data-value') === expected) {
      await option.click();
      return;
    }
  }
  throw new Error('không tìm thấy exact role option đã cấu hình');
}

function normalizeConfig(config) {
  if (!Array.isArray(config.loginUrls) || config.loginUrls.length === 0) {
    throw new Error('Bridge yêu cầu ít nhất một exact login URL.');
  }
  const loginUrls = config.loginUrls.map(value => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Login URL phải dùng http/https và không chứa userinfo.');
    }
    return url.href;
  });
  if (!config.username || !config.password) throw new Error('Bridge thiếu username/password.');
  if (Boolean(config.selectSelector) !== Boolean(config.selectValue)) {
    throw new Error('Select bridge cần đủ selector và value.');
  }
  return {
    timeout: 30_000,
    logger: defaultLogger,
    ...config,
    loginUrls,
  };
}

async function isVisible(locator) {
  return locator.isVisible().catch(() => false);
}

function generateTotp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const character of secret.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('TOTP secret không đúng base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  if (bytes.length === 0) throw new Error('TOTP secret rỗng');
  const counter = Math.floor(Date.now() / 1000 / 30);
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

function redact(message, sensitiveValues) {
  let result = String(message ?? '');
  for (const secret of [...sensitiveValues].sort((left, right) => right.length - left.length)) {
    result = result.split(secret).join('[REDACTED]');
  }
  return result.replace(/\b\d{6}\b/g, '[REDACTED-CODE]');
}

function defaultLogger(message) {
  console.error(message);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '<invalid-url>';
  }
}

function isPageGone(error) {
  return /Target page, context or browser has been closed|Page closed/i.test(String(error?.message));
}

function trace(message) {
  if (process.env.PW_AUTH_BRIDGE_TRACE === '1') console.error(`[mcp-auth-bridge trace] ${message}`);
}

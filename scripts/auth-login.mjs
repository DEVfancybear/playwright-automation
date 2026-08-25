#!/usr/bin/env node
/**
 * auth-login.mjs — đăng nhập tự động một lần, lưu phiên ra storageState.
 *
 * Mục đích: bỏ hẳn khâu "agent dừng lại nhờ tester gõ mật khẩu". Script đọc
 * credential từ BIẾN MÔI TRƯỜNG (hoặc file .env), tự đăng nhập, xác minh phiên
 * dùng được thật, rồi lưu ra file storageState để mọi lượt sau nạp lại.
 *
 * Ba điểm thiết kế đáng chú ý:
 *
 *   1. Agent điều phối chỉ truyền TÊN biến môi trường. Helper process này được
 *      phép nạp giá trị nội bộ để điền form, nhưng không trả nó ra hội thoại,
 *      log hay dòng lệnh (`ps` và shell history đều có thể lưu dòng lệnh).
 *   2. Có phiên còn dùng được thì KHÔNG đăng nhập lại. Đây là thứ khiến việc
 *      đăng nhập từ "mỗi lần chạy một lần" thành "một lần cho cả tuần".
 *   3. Lưu xong thì mở lại bằng context sạch để xác minh. Lỗi kinh điển của
 *      auth setup là lưu quá sớm, ra file rỗng, rồi mọi test sau fail khó hiểu.
 *
 * Chạy `node auth-login.mjs --help` để xem hướng dẫn.
 */

import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import path from 'node:path';

import {
  assertCredentialSubmissionOrigin,
  ensureCredentialEnvFile,
  resolveCredentialEnvPath,
  resolveTlsPolicy,
} from './runtime-safety.mjs';

const HELP = `
auth-login.mjs — bảo đảm phiên đăng nhập còn dùng được (idempotent)

CÁCH DÙNG
  node auth-login.mjs --url <trang đăng nhập> --out .auth/<target>.json [tuỳ chọn]

CREDENTIAL — truyền TÊN biến, không truyền giá trị
  --user-env <TÊN>         Biến chứa tài khoản. Mặc định: TEST_USER
  --pass-env <TÊN>         Biến chứa mật khẩu. Mặc định: TEST_PASS
  --totp-env <TÊN>         Biến chứa TOTP secret (base32) nếu app bật 2FA.
                           Bỏ trống thì tự dùng TEST_TOTP_SECRET nếu biến này có giá trị
  --env <file>             Nạp thêm file .env. Mặc định: ./.env nếu tồn tại
                           (đặt tên là --env chứ không phải --env-file: Node nuốt mất
                            --env-file vì trùng cờ CLI của chính nó)

  Đặt giá trị bằng file .env hoặc export ra môi trường:
    TEST_USER=qa_user01
    TEST_PASS=...
  KHÔNG truyền mật khẩu qua tham số dòng lệnh — nó lộ ra trong ps và shell history.

ĐÍCH
  --url <url>              (bắt buộc) Trang đăng nhập
  --out <file.json>        (bắt buộc) Nơi lưu storageState. Nên để trong .auth/

DÒ FORM — bỏ trống thì script tự dò theo nhãn/role
  --user-selector <sel>    Ô tài khoản, nếu tự dò sai
  --next-selector <sel>    Nút Tiếp tục của form username → password
  --pass-selector <sel>    Ô mật khẩu
  --submit-selector <sel>  Nút đăng nhập
  --otp-selector <sel>     Ô nhập OTP

XÁC MINH ĐÃ ĐĂNG NHẬP
  --success-url <regex>    URL sau khi đăng nhập phải khớp, ví dụ: "/dashboard"
  --success-text <text>    Text phải xuất hiện sau khi đăng nhập
  --verify-url <url>       Trang dùng để xác minh lại phiên. Mặc định: --url

CHẾ ĐỘ
  Mặc định                 Ensure: phiên còn sống thì dùng lại; hết hạn thì tự login
  --check                  Chỉ kiểm tra phiên hiện có còn dùng được. Không đăng nhập.
                           exit 0 = còn dùng được, exit 3 = hết hạn/không có
  --force                  Bỏ qua phiên cũ, đăng nhập lại từ đầu
  --headed                 Hiện trình duyệt (mặc định chạy ẩn)
  --browser <tên>          chromium | firefox | webkit. Mặc định: chromium
  --timeout <ms>           Timeout mỗi bước. Mặc định: 30000
  --ignore-https-errors    Bỏ qua lỗi TLS trong context Playwright riêng
  --confirm-non-production
                           Cổng bắt buộc cho cờ trên; Agent chỉ tự bật sau khi
                           xác minh target là local/dev/QA/staging/UAT
  --help

MÃ THOÁT
  0  thành công (đăng nhập mới, hoặc phiên cũ còn dùng được)
  1  lỗi cấu hình hoặc không đăng nhập được
  2  không tìm thấy form đăng nhập — truyền --user-selector/--pass-selector
  3  (--check) phiên không dùng được

VÍ DỤ
  # Lệnh chuẩn cho mọi lượt — tự dùng lại hoặc gia hạn khi cần
  node auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json

  # Chỉ chẩn đoán trạng thái phiên, không đăng nhập
  node auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json --check

  # App có 2FA bằng app Authenticator
  node auth-login.mjs --url ... --out ... --totp-env TEST_TOTP_SECRET
`;

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      url: { type: 'string' },
      out: { type: 'string' },
      'user-env': { type: 'string', default: 'TEST_USER' },
      'pass-env': { type: 'string', default: 'TEST_PASS' },
      'totp-env': { type: 'string' },
      env: { type: 'string' },
      'user-selector': { type: 'string' },
      'next-selector': { type: 'string' },
      'pass-selector': { type: 'string' },
      'submit-selector': { type: 'string' },
      'otp-selector': { type: 'string' },
      'success-url': { type: 'string' },
      'success-text': { type: 'string' },
      'verify-url': { type: 'string' },
      check: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      headed: { type: 'boolean', default: false },
      browser: { type: 'string', default: 'chromium' },
      timeout: { type: 'string', default: '30000' },
      'ignore-https-errors': { type: 'boolean', default: false },
      'confirm-non-production': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  }));
} catch (e) {
  console.error(`Tham số không hợp lệ: ${e.message}\n${HELP}`);
  process.exit(1);
}

if (args.help || !args.url || !args.out) {
  console.log(HELP);
  process.exit(args.help ? 0 : 1);
}

const TIMEOUT = Number(args.timeout) || 30_000;

let tlsPolicy;
try {
  tlsPolicy = resolveTlsPolicy({
    url: args.url,
    ignoreHttpsErrors: args['ignore-https-errors'],
    confirmedNonProduction: args['confirm-non-production'],
  });
} catch (error) {
  console.error(`Từ chối cấu hình TLS: ${error.message}`);
  process.exit(1);
}
if (tlsPolicy.ignoreHTTPSErrors) {
  console.warn(
    `⚠ Đang bỏ qua xác minh TLS cho target non-production ${tlsPolicy.origin}. ` +
    'Điều này không chứng minh certificate hợp lệ.',
  );
}

// --- .env -----------------------------------------------------------------
// Chỉ nạp biến CHƯA có sẵn trong môi trường, để export ngoài shell luôn thắng file.
function loadEnvFile(file) {
  if (!existsSync(file)) return 0;
  let n = 0;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val && process.env[key] === undefined) {
      process.env[key] = val;
      n++;
    }
  }
  return n;
}

let envFile;
try {
  envFile = resolveCredentialEnvPath(args.env ?? path.join(process.cwd(), '.env'));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const loaded = loadEnvFile(envFile);
if (loaded) console.log(`  Đã nạp ${loaded} biến từ ${path.relative(process.cwd(), envFile) || envFile}`);

// Giữ secret trong helper process và che chúng ở mọi đường lỗi trước khi ghi log.
// Playwright có thể đưa giá trị đã fill vào message lỗi, còn app có thể echo lại
// credential trong role=alert, nên chỉ tránh console.log trực tiếp là chưa đủ.
const userKey = args['user-env'];
const passKey = args['pass-env'];
const username = process.env[userKey];
const password = process.env[passKey];
const sensitiveValues = new Set([
  username,
  password,
  args['totp-env'] ? process.env[args['totp-env']] : undefined,
  process.env.TEST_TOTP_SECRET,
].filter(value => typeof value === 'string' && value.length > 0));

function redactSensitive(value) {
  let text = String(value ?? '');
  for (const secret of [...sensitiveValues].sort((left, right) => right.length - left.length)) {
    text = text.split(secret).join('[REDACTED]');
  }
  return text;
}

// NODE_DEBUG=child_process được Node cache từ lúc process khởi động; khi
// Playwright spawn browser, Node có thể dump nguyên env (gồm credential) trước
// khi code này kịp redact. Không thể tắt an toàn trong-process nên phải fail closed.
const enabledNodeDebugKeys = ['NODE_DEBUG', 'NODE_DEBUG_NATIVE']
  .filter(key => process.env[key]?.trim());
if (enabledNodeDebugKeys.length > 0) {
  console.error(
    'Từ chối mở browser vì NODE_DEBUG/NODE_DEBUG_NATIVE đang bật; debug runtime có thể làm lộ credential.\n' +
    'Hãy unset NODE_DEBUG/NODE_DEBUG_NATIVE rồi chạy lại auth-login.mjs.'
  );
  process.exit(1);
}
delete process.env.NODE_DEBUG;
delete process.env.NODE_DEBUG_NATIVE;

// Playwright's own `DEBUG=pw:api` logger writes fill("<value>") before a caught
// error reaches redactSensitive(). This helper handles secrets, so inherited
// diagnostic modes that can bypass our output boundary are always disabled.
const unsafeDiagnosticEnv = ['DEBUG', 'DEBUG_FILE', 'PWDEBUG', 'PWDEBUGIMPL'];
for (const key of unsafeDiagnosticEnv) delete process.env[key];

// --- TOTP cho 2FA ---------------------------------------------------------
// Tự cài để không thêm dependency: RFC 6238, HMAC-SHA1, bước 30 giây, 6 chữ số.
function base32Decode(input) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const out = [];
  for (const ch of input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase()) {
    const idx = A.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totp(secret, atMs = Date.now()) {
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0x0f;
  const code = (((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff)) % 1_000_000;
  return String(code).padStart(6, '0');
}

// --- Nạp Playwright -------------------------------------------------------
const unwrap = (ns) => (ns?.chromium ? ns : (ns?.default?.chromium ? ns.default : ns));

async function loadPlaywright() {
  for (const mod of ['@playwright/test', 'playwright']) {
    try { return unwrap(await import(mod)); } catch { /* thử cách khác */ }
  }
  const req = createRequire(path.join(process.cwd(), 'package.json'));
  for (const mod of ['@playwright/test', 'playwright']) {
    try { return unwrap(await import(pathToFileURL(req.resolve(mod)).href)); } catch { /* thử gói tiếp theo */ }
  }
  return null;
}

const pw = await loadPlaywright();
if (!pw) {
  console.error(
    'Không tìm thấy Playwright.\n' +
    'Cài trong thư mục dự án rồi chạy lại script từ đó:\n' +
    '  npm i -D @playwright/test\n' +
    '  npx playwright install chromium'
  );
  process.exit(1);
}
const browserType = pw[args.browser];
if (!browserType) {
  console.error(`Trình duyệt không hợp lệ: ${args.browser}. Chọn: chromium | firefox | webkit`);
  process.exit(1);
}

// --- Xác minh phiên -------------------------------------------------------
/**
 * Mở context sạch bằng storageState đã lưu rồi kiểm xem còn đăng nhập không.
 *
 * Dấu hiệu "còn đăng nhập" ưu tiên tín hiệu người dùng chỉ định; không có thì
 * dùng heuristic: trang xác minh KHÔNG còn form password/OTP nào hiển thị. Heuristic này
 * chọn hướng an toàn — nghi ngờ thì báo hết hạn và đăng nhập lại, vì đăng nhập thừa
 * chỉ tốn vài giây, còn chạy cả suite bằng phiên chết thì đỏ hàng loạt vô nghĩa.
 */
/** Sidecar cạnh file phiên: nhớ trang đích sau đăng nhập để lần sau xác minh đúng chỗ. */
const metaPath = (statePath) => statePath.replace(/\.json$/i, '') + '.meta.json';
const OTP_FIELD_SELECTOR = [
  'input[autocomplete="one-time-code"]:visible',
  'input[name*="otp" i]:visible',
  'input[id*="otp" i]:visible',
  'input[name*="one-time" i]:visible',
  'input[id*="one-time" i]:visible',
  'input[name*="verification" i][name*="code" i]:visible',
  'input[id*="verification" i][id*="code" i]:visible',
  'input[name*="auth" i][name*="code" i]:visible',
  'input[id*="auth" i][id*="code" i]:visible',
].join(', ');
const AUTH_CHALLENGE_SELECTOR = [
  'input[type="password"]:visible',
  OTP_FIELD_SELECTOR,
].join(', ');

/** Locator đầu tiên đang/soon trở nên visible, hoặc null sau toàn bộ timeout. */
async function firstVisible(candidates, timeout = 1_500) {
  const locators = candidates.map(locator => locator.first());

  // Giữ thứ tự ưu tiên khi DOM đã sẵn sàng.
  for (const locator of locators) {
    try {
      if (await locator.isVisible()) return locator;
    } catch { /* thử ứng viên tiếp theo */ }
  }

  if (timeout <= 0 || locators.length === 0) return null;
  try {
    const found = await Promise.any(locators.map(async locator => {
      await locator.waitFor({ state: 'visible', timeout });
      return locator;
    }));
    return found;
  } catch {
    return null;
  }
}

function authChallengeLocators(page) {
  const locators = [page.locator(AUTH_CHALLENGE_SELECTOR)];
  if (args['pass-selector']) locators.push(page.locator(args['pass-selector']));
  if (args['otp-selector']) locators.push(page.locator(args['otp-selector']));
  return locators;
}

function authIdentityLocators(page) {
  const locators = [
    page.getByLabel(/email|tài khoản|tên đăng nhập|username|user|account|số điện thoại|sđt|phone/i),
    page.getByPlaceholder(/email|tài khoản|tên đăng nhập|username|account|số điện thoại|sđt|phone/i),
    page.locator('input[autocomplete="username"], input[type="email"], input[name="username"], input[name="email"], input[name="account"], input[id*="user" i]'),
  ];
  if (args['user-selector']) locators.unshift(page.locator(args['user-selector']));
  return locators;
}

function namedAuthActionLocators(scope) {
  return [
    scope.getByRole('button', { name: /đăng nhập|dang nhap|log\s*in|sign\s*in|tiếp tục|tiếp theo|next|continue/i }),
  ];
}

function explicitAuthActionLocators(page) {
  const locators = [];
  if (args['next-selector']) locators.unshift(page.locator(args['next-selector']));
  if (args['submit-selector']) locators.unshift(page.locator(args['submit-selector']));
  return locators;
}

async function findPairedAuthIdentity(page) {
  for (const candidate of authIdentityLocators(page)) {
    const identity = await firstVisible([candidate], 0);
    if (!identity) continue;

    // Nếu identity nằm trong form, action suy đoán cũng phải nằm trong đúng form.
    // Tránh nhầm Account/Profile form với nút Continue của một widget khác trên trang.
    const form = identity.locator('xpath=ancestor::form[1]');
    if (await form.count().catch(() => 0)) {
      const inForm = await firstVisible(namedAuthActionLocators(form), 0);
      if (inForm) return identity;
      const explicit = await firstVisible(explicitAuthActionLocators(page), 0);
      if (explicit) return identity;
      continue;
    }

    const action = await firstVisible([
      ...explicitAuthActionLocators(page),
      ...namedAuthActionLocators(page),
    ], 0);
    if (action) return identity;
  }
  return null;
}

async function findAuthChallenge(page, timeout = 0) {
  const directChallenge = await firstVisible(authChallengeLocators(page), timeout);
  if (directChallenge) return directChallenge;

  // SSO hai bước có thể chỉ render username + Login/Next ở bước đầu. Chỉ coi
  // username là challenge khi có action đăng nhập đi kèm để tránh nhầm input
  // tài khoản trên một trang nghiệp vụ bình thường.
  return findPairedAuthIdentity(page);
}

function safeUrlForLog(value) {
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return String(value).replace(/[?#].*$/, '');
  }
}

function readMeta(statePath) {
  try {
    return JSON.parse(readFileSync(metaPath(statePath), 'utf8'));
  } catch {
    return {};
  }
}

function canonicalLoginIdentity(value) {
  try {
    // URL.href chỉ chuẩn hoá cú pháp (host case/default port), nhưng giữ nguyên
    // userinfo, pathname, query và hash. Khác một byte về scope => xác minh lại;
    // relogin thừa an toàn hơn tin sidecar của target khác.
    return new URL(value).href;
  } catch {
    return null;
  }
}

/**
 * Trang dùng để xác minh phiên.
 *
 * KHÔNG được mặc định là trang đăng nhập: nhiều app (SauceDemo là ví dụ điển hình)
 * vẫn hiển thị form đăng nhập ở `/` kể cả khi phiên còn sống, nên xác minh ở đó sẽ
 * luôn kết luận sai là "hết phiên". Đúng chỗ để xác minh là trang mình ĐÃ ĐÁP XUỐNG
 * sau khi đăng nhập lần trước — phiên chết thì trang đó tự đá về login.
 */
function resolveVerifyUrl(statePath) {
  if (args['verify-url']) return args['verify-url'];
  const meta = readMeta(statePath);
  const sameLoginTarget = canonicalLoginIdentity(meta.loginUrl)
    === canonicalLoginIdentity(args.url);
  return sameLoginTarget && meta.landingUrl ? meta.landingUrl : args.url;
}

async function sessionUsable(statePath) {
  if (!existsSync(statePath)) return { ok: false, why: 'chưa có file phiên' };
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return { ok: false, why: 'file phiên hỏng, không parse được' };
  }
  const nCookies = state?.cookies?.length ?? 0;
  const nOrigins = state?.origins?.length ?? 0;
  if (nCookies === 0 && nOrigins === 0) return { ok: false, why: 'file phiên rỗng' };

  const expired = (state.cookies ?? []).filter(
    (c) => typeof c.expires === 'number' && c.expires > 0 && c.expires * 1000 < Date.now(),
  );
  if (expired.length && expired.length === nCookies) {
    return { ok: false, why: 'mọi cookie trong phiên đã hết hạn' };
  }

  const browser = await browserType.launch({ headless: !args.headed });
  try {
    const ctx = await browser.newContext({
      storageState: statePath,
      ignoreHTTPSErrors: tlsPolicy.ignoreHTTPSErrors,
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(TIMEOUT);
    const verifyUrl = resolveVerifyUrl(statePath);
    const response = await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    if (response && response.status() >= 400) {
      return {
        ok: false,
        why: `trang xác minh trả HTTP ${response.status()} (${safeUrlForLog(response.url())})`,
      };
    }
    if (args['success-url']) {
      const expected = new RegExp(args['success-url']);
      await page.waitForURL(expected, { timeout: Math.min(TIMEOUT, 5_000) }).catch(() => {});
      const ok = expected.test(page.url());
      return { ok, why: ok ? '' : `URL sau khi nạp phiên không khớp --success-url (đang ở ${safeUrlForLog(page.url())})` };
    }
    if (args['success-text']) {
      const success = page.getByText(args['success-text']).first();
      await success.waitFor({ state: 'visible', timeout: Math.min(TIMEOUT, 5_000) }).catch(() => {});
      const ok = await success.isVisible().catch(() => false);
      return { ok, why: ok ? '' : `không thấy --success-text trên trang xác minh` };
    }

    // SPA thường dựng form login sau DOMContentLoaded. Đợi tín hiệu readiness của
    // network rồi đợi chính auth surface; không dùng sleep mù và không kết luận
    // phiên còn sống từ một DOM tạm thời đang rỗng.
    await page.waitForLoadState('networkidle', { timeout: Math.min(TIMEOUT, 5_000) }).catch(() => {});
    const challenge = await findAuthChallenge(page, Math.min(TIMEOUT, 2_500));
    if (!challenge) return { ok: true, why: '' };
    return {
      ok: false,
      why: `trang xác minh (${safeUrlForLog(verifyUrl)}) hiện form xác thực ⇒ phiên đã hết/chưa hoàn tất`
        + (verifyUrl === args.url ? '. Nếu app vẫn hiện form login kể cả khi đã đăng nhập,'
            + ' truyền --verify-url <trang sau đăng nhập> hoặc --success-text.' : ''),
    };
  } catch (e) {
    return { ok: false, why: `không mở được trang xác minh: ${redactSensitive(e.message)}` };
  } finally {
    await browser.close().catch(() => {});
  }
}

// --- Chế độ --check -------------------------------------------------------
if (args.check) {
  const { ok, why } = await sessionUsable(args.out);
  if (ok) {
    console.log(`✓ Phiên còn dùng được: ${args.out}`);
    process.exit(0);
  }
  console.log(`✗ Phiên không dùng được (${why}). Cần đăng nhập lại.`);
  process.exit(3);
}

// --- Bỏ qua đăng nhập nếu phiên cũ còn tốt --------------------------------
if (!args.force) {
  const { ok } = await sessionUsable(args.out);
  if (ok) {
    console.log(`✓ Phiên còn dùng được, bỏ qua đăng nhập: ${args.out}`);
    console.log('  Muốn đăng nhập lại thì thêm --force.');
    process.exit(0);
  }
}

// --- Đọc credential -------------------------------------------------------
if (!username || !password) {
  const missing = [!username && userKey, !password && passKey].filter(Boolean);
  let setup;
  try {
    setup = ensureCredentialEnvFile(envFile, {
      userEnv: userKey,
      passEnv: passKey,
      totpEnv: args['totp-env'] ?? 'TEST_TOTP_SECRET',
    });
  } catch (error) {
    console.error(`Không chuẩn bị được file credential riêng: ${error.message}`);
    process.exit(1);
  }
  const displayEnv = path.relative(process.cwd(), setup.path) || setup.path;
  console.error(
    `Thiếu biến môi trường: ${missing.join(', ')}\n\n` +
    `${setup.created ? 'Đã tự tạo' : 'Mở'} file credential riêng ${displayEnv} rồi điền:\n` +
    `  ${userKey}=<tài khoản test>\n` +
    `  ${passKey}=<mật khẩu>\n\n` +
    `Không gửi giá trị qua chat. Helper sẽ tự đọc file local này ở lần chạy kế tiếp.\n` +
    `File template/example/fixture không bao giờ được dùng làm nguồn credential.`,
  );
  process.exit(1);
}
console.log(`  ✓ Credential sẵn sàng trong $${userKey} / $${passKey} (không ghi giá trị ra log)`);

// --- Đăng nhập ------------------------------------------------------------
const browser = await browserType.launch({ headless: !args.headed });
const ctx = await browser.newContext({
  ignoreHTTPSErrors: tlsPolicy.ignoreHTTPSErrors,
});
const page = await ctx.newPage();
page.setDefaultTimeout(TIMEOUT);
let exitCode = 0;

try {
  console.log(`  Mở ${safeUrlForLog(args.url)}`);
  await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  assertCredentialSubmissionOrigin(page.url(), tlsPolicy.origin);

  const findPassField = async (timeout = 1_500) => args['pass-selector']
    ? firstVisible([page.locator(args['pass-selector'])], timeout)
    : firstVisible([
        page.locator('input[type="password"]'),
        page.getByLabel(/mật khẩu|password|pass/i),
      ], timeout);
  const findUserField = async (timeout = 1_500) => args['user-selector']
    ? firstVisible([page.locator(args['user-selector'])], timeout)
    : firstVisible([
        page.getByLabel(/email|tài khoản|tên đăng nhập|username|user|số điện thoại|sđt|phone/i),
        page.getByPlaceholder(/email|tài khoản|tên đăng nhập|username|số điện thoại|sđt/i),
        page.locator('input[type="email"]'),
        page.locator('input[name="username"], input[name="email"], input[name="account"], input[id*="user" i]'),
        page.locator('input[type="text"]'),
      ], timeout);

  const userField = await findUserField();
  let passField = await findPassField();

  if (!userField && !passField) {
    console.error(
      '\n✗ Không dò được form đăng nhập trên trang này.\n' +
      '  Cách xử lý: đọc cây accessibility của trang rồi truyền selector thật vào:\n' +
      '    node scripts/explore.mjs --url <trang login>\n' +
      '    node scripts/auth-login.mjs ... --user-selector "..." --pass-selector "..."\n' +
      '  Nếu trang login nằm sau redirect/SSO, truyền đúng URL cuối bằng --url.',
    );
    exitCode = 2;
    throw new Error('__handled__');
  }

  if (userField) await userField.fill(username);

  // Form hai bước (Microsoft/Google/SSO nội bộ): username → Tiếp tục → password.
  if (!passField && userField) {
    const next = args['next-selector']
      ? await firstVisible([page.locator(args['next-selector'])], Math.min(TIMEOUT, 5_000))
      : await firstVisible([
          page.getByRole('button', { name: /tiếp tục|tiếp theo|next|continue|đồng ý/i }),
          page.locator('button[type="submit"], input[type="submit"]'),
        ]);
    if (!next) {
      console.error(
        '\n✗ Đã thấy ô tài khoản nhưng không thấy nút Tiếp tục của form nhiều bước.\n' +
        '  Đọc cây accessibility rồi truyền --next-selector <selector>.',
      );
      exitCode = 2;
      throw new Error('__handled__');
    }
    await next.click();
    passField = await findPassField(TIMEOUT);
  }

  if (!passField) {
    console.error(
      '\n✗ Không tìm thấy ô mật khẩu sau bước nhập tài khoản.\n' +
      '  Nếu đây là SSO/passwordless/CAPTCHA, cần một tài khoản test hoặc auth strategy phù hợp.\n' +
      '  Form tuỳ biến thì truyền --pass-selector lấy từ cây accessibility.',
    );
    exitCode = 2;
    throw new Error('__handled__');
  }

  await passField.fill(password);

  const submit = args['submit-selector']
    ? await firstVisible([page.locator(args['submit-selector'])], Math.min(TIMEOUT, 5_000))
    : await firstVisible([
        page.getByRole('button', { name: /đăng nhập|dang nhap|login|sign in|submit|tiếp tục/i }),
        page.locator('button[type="submit"], input[type="submit"]'),
      ]);

  if (submit) {
    await submit.click();
  } else {
    // Nhiều form đăng nhập submit được bằng Enter dù không có nút rõ ràng.
    await passField.press('Enter');
  }

  // --- 2FA ---------------------------------------------------------------
  const successAlreadyVisible = args['success-url']
    ? new RegExp(args['success-url']).test(page.url())
    : args['success-text']
      ? await page.getByText(args['success-text']).first().isVisible().catch(() => false)
      : false;
  const otpWait = successAlreadyVisible ? 0 : Math.min(TIMEOUT, 5_000);
  const otpField = args['otp-selector']
    ? await firstVisible([page.locator(args['otp-selector'])], otpWait)
    : await firstVisible([
        page.getByLabel(/otp|mã xác thực|mã xác minh|verification code|authentication code/i),
        page.locator(OTP_FIELD_SELECTOR),
      ], otpWait);
  const totpKey = args['totp-env'] ?? (process.env.TEST_TOTP_SECRET ? 'TEST_TOTP_SECRET' : undefined);

  if (otpField) {
    if (!totpKey) {
      console.error(
        '\n✗ Trang yêu cầu OTP/TOTP nhưng chưa có secret tự động.\n' +
        '  Đặt TEST_TOTP_SECRET trong .env, hoặc truyền --totp-env <TÊN_BIẾN>.\n' +
        '  Không gửi mã/secret qua hội thoại.',
      );
      exitCode = 1;
      throw new Error('__handled__');
    }
    const secret = process.env[totpKey];
    if (!secret) {
      console.error(`Thiếu biến ${totpKey} cho 2FA.`);
      exitCode = 1;
      throw new Error('__handled__');
    }
    sensitiveValues.add(secret);
    const code = totp(secret);
    sensitiveValues.add(code);
    console.log(`  Nhập mã 2FA từ $${totpKey} (giá trị không ghi log)`);
    await otpField.fill(code);
    const otpSubmit = await firstVisible([
      page.getByRole('button', { name: /xác nhận|xác minh|verify|continue|tiếp tục|submit/i }),
      page.locator('button[type="submit"]'),
    ]);
    if (otpSubmit) await otpSubmit.click(); else await otpField.press('Enter');
  }

  // --- Chờ tín hiệu đăng nhập thật sự xong -------------------------------
  // Lưu state ngay sau khi click là lỗi kinh điển: cookie phiên có thể chưa được
  // set xong, ra file rỗng, và mọi test sau đó fail rất khó truy.
  if (args['success-url']) {
    await page.waitForURL(new RegExp(args['success-url']), { timeout: TIMEOUT });
  } else if (args['success-text']) {
    await page.getByText(args['success-text']).first().waitFor({ state: 'visible', timeout: TIMEOUT });
  } else {
    await Promise.all(authChallengeLocators(page).map(locator => locator.first()
      .waitFor({ state: 'hidden', timeout: TIMEOUT })
      .catch(() => {})));
  }

  const stillOnLogin = await findAuthChallenge(page);
  if (stillOnLogin) {
    // Thông báo lỗi đăng nhập nằm ở đâu tuỳ app: role=alert là chuẩn nhất nhưng
    // nhiều app chỉ gắn class/data-test. Thử lần lượt rồi lấy cái đầu tiên có chữ.
    let errText = '';
    for (const loc of [
      page.getByRole('alert'),
      page.locator('[data-test*="error" i], [data-testid*="error" i]'),
      page.locator('.error, .error-message, .alert-danger, .invalid-feedback, .ant-form-item-explain-error'),
      page.locator('[class*="error" i]:visible'),
    ]) {
      const t = await loc.first().innerText({ timeout: 1_000 }).catch(() => '');
      if (t && t.trim()) { errText = t.trim(); break; }
    }
    console.error(
      '\n✗ Vẫn còn ở trang đăng nhập sau khi submit.\n' +
      (errText ? `  App báo: ${redactSensitive(errText).replace(/\s+/g, ' ').slice(0, 200)}\n` : '') +
      '  Kiểm tra lại tài khoản/mật khẩu trong .env, hoặc truyền --success-url / --success-text\n' +
      '  để script biết đâu là dấu hiệu đăng nhập thành công.',
    );
    exitCode = 1;
    throw new Error('__handled__');
  }

  const landingUrl = page.url();
  mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  await ctx.storageState({ path: args.out });
  // Nhớ trang đích để --check lần sau xác minh đúng chỗ, không xác minh trên trang login.
  writeFileSync(
    metaPath(args.out),
    JSON.stringify({ landingUrl, loginUrl: args.url, savedAt: new Date().toISOString() }, null, 2),
  );
  await browser.close();

  // --- Xác minh lại bằng context sạch ------------------------------------
  const verify = await sessionUsable(args.out);
  if (!verify.ok) {
    console.error(`\n✗ Đã lưu phiên nhưng nạp lại thì không dùng được: ${verify.why}`);
    console.error('  Thường do app gắn phiên vào sessionStorage hoặc yêu cầu header riêng.');
    console.error('  Xử lý: dùng đăng nhập qua API rồi bơm token — xem references/auth-and-data.md');
    process.exit(1);
  }

  const saved = JSON.parse(readFileSync(args.out, 'utf8'));
  console.log(
    `\n✓ Đăng nhập thành công và phiên đã xác minh dùng được.\n` +
    `  File   : ${args.out}  (${saved.cookies?.length ?? 0} cookie, ${saved.origins?.length ?? 0} origin)\n` +
    `  URL sau: ${safeUrlForLog(landingUrl)}\n\n` +
    `  Lượt sau gọi lại cùng lệnh; script tự dùng phiên này nếu còn sống:\n` +
    `    node scripts/auth-login.mjs --url ${safeUrlForLog(args.url)} --out ${args.out}\n\n` +
    `  Nhớ: ${args.out} chứa cookie thật — phải nằm trong .gitignore, không đính kèm ticket.`,
  );
  process.exit(0);
} catch (e) {
  if (e.message !== '__handled__') {
    console.error(`\n✗ Đăng nhập thất bại: ${redactSensitive(e.message)}`);
    exitCode = exitCode || 1;
  }
  await browser.close().catch(() => {});
  process.exit(exitCode || 1);
}

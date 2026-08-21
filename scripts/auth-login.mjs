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
 *   1. Agent không bao giờ cầm mật khẩu. Nó chỉ truyền TÊN biến môi trường.
 *      Mật khẩu không xuất hiện trong hội thoại, trong log, hay trong dòng lệnh
 *      (dòng lệnh còn nằm trong `ps` và history của shell).
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

const HELP = `
auth-login.mjs — đăng nhập tự động, lưu phiên để dùng lại

CÁCH DÙNG
  node auth-login.mjs --url <trang đăng nhập> --out .auth/<target>.json [tuỳ chọn]

CREDENTIAL — truyền TÊN biến, không truyền giá trị
  --user-env <TÊN>         Biến chứa tài khoản. Mặc định: TEST_USER
  --pass-env <TÊN>         Biến chứa mật khẩu. Mặc định: TEST_PASS
  --totp-env <TÊN>         Biến chứa TOTP secret (base32) nếu app bật 2FA
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
  --pass-selector <sel>    Ô mật khẩu
  --submit-selector <sel>  Nút đăng nhập
  --otp-selector <sel>     Ô nhập OTP

XÁC MINH ĐÃ ĐĂNG NHẬP
  --success-url <regex>    URL sau khi đăng nhập phải khớp, ví dụ: "/dashboard"
  --success-text <text>    Text phải xuất hiện sau khi đăng nhập
  --verify-url <url>       Trang dùng để xác minh lại phiên. Mặc định: --url

CHẾ ĐỘ
  --check                  Chỉ kiểm tra phiên hiện có còn dùng được. Không đăng nhập.
                           exit 0 = còn dùng được, exit 3 = hết hạn/không có
  --force                  Bỏ qua phiên cũ, đăng nhập lại từ đầu
  --headed                 Hiện trình duyệt (mặc định chạy ẩn)
  --browser <tên>          chromium | firefox | webkit. Mặc định: chromium
  --timeout <ms>           Timeout mỗi bước. Mặc định: 30000
  --help

MÃ THOÁT
  0  thành công (đăng nhập mới, hoặc phiên cũ còn dùng được)
  1  lỗi cấu hình hoặc không đăng nhập được
  2  không tìm thấy form đăng nhập — truyền --user-selector/--pass-selector
  3  (--check) phiên không dùng được

VÍ DỤ
  # Lần đầu — đăng nhập và lưu phiên
  node auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json

  # Mỗi lượt sau — kiểm tra trước, chỉ đăng nhập lại khi cần
  node auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json --check \\
    || node auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json

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

const envFile = args.env ?? path.join(process.cwd(), '.env');
const loaded = loadEnvFile(envFile);
if (loaded) console.log(`  Đã nạp ${loaded} biến từ ${path.relative(process.cwd(), envFile) || envFile}`);

/** Che giá trị khi in ra — không bao giờ để secret lọt vào log hay transcript. */
const mask = (v) => (!v ? '(trống)' : v.length <= 2 ? '**' : v[0] + '*'.repeat(Math.min(v.length - 2, 8)) + v.at(-1));

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
 * dùng heuristic: trang xác minh KHÔNG còn ô mật khẩu nào hiển thị. Heuristic này
 * chọn hướng an toàn — nghi ngờ thì báo hết hạn và đăng nhập lại, vì đăng nhập thừa
 * chỉ tốn vài giây, còn chạy cả suite bằng phiên chết thì đỏ hàng loạt vô nghĩa.
 */
/** Sidecar cạnh file phiên: nhớ trang đích sau đăng nhập để lần sau xác minh đúng chỗ. */
const metaPath = (statePath) => statePath.replace(/\.json$/i, '') + '.meta.json';

function readMeta(statePath) {
  try {
    return JSON.parse(readFileSync(metaPath(statePath), 'utf8'));
  } catch {
    return {};
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
  return args['verify-url'] ?? readMeta(statePath).landingUrl ?? args.url;
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
    const ctx = await browser.newContext({ storageState: statePath });
    const page = await ctx.newPage();
    const verifyUrl = resolveVerifyUrl(statePath);
    await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

    if (args['success-url']) {
      const ok = new RegExp(args['success-url']).test(page.url());
      return { ok, why: ok ? '' : `URL sau khi nạp phiên không khớp --success-url (đang ở ${page.url()})` };
    }
    if (args['success-text']) {
      const ok = await page.getByText(args['success-text']).first().isVisible().catch(() => false);
      return { ok, why: ok ? '' : `không thấy --success-text trên trang xác minh` };
    }
    const passVisible = await page.locator('input[type="password"]:visible').count().catch(() => 0);
    if (passVisible === 0) return { ok: true, why: '' };
    return {
      ok: false,
      why: `trang xác minh (${verifyUrl}) hiện ô mật khẩu ⇒ phiên đã hết`
        + (verifyUrl === args.url ? '. Nếu app vẫn hiện form login kể cả khi đã đăng nhập,'
            + ' truyền --verify-url <trang sau đăng nhập> hoặc --success-text.' : ''),
    };
  } catch (e) {
    return { ok: false, why: `không mở được trang xác minh: ${e.message}` };
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
const userKey = args['user-env'];
const passKey = args['pass-env'];
const username = process.env[userKey];
const password = process.env[passKey];

if (!username || !password) {
  const missing = [!username && userKey, !password && passKey].filter(Boolean);
  console.error(
    `Thiếu biến môi trường: ${missing.join(', ')}\n\n` +
    `Tạo file .env cạnh dự án rồi điền:\n` +
    `  ${userKey}=<tài khoản test>\n` +
    `  ${passKey}=<mật khẩu>\n\n` +
    `Hoặc export ra môi trường trước khi chạy. .env phải nằm trong .gitignore —\n` +
    `không commit, kể cả tài khoản staging.`,
  );
  process.exit(1);
}
console.log(`  Tài khoản: ${username}  ·  Mật khẩu: ${mask(password)} (đọc từ $${passKey})`);

// --- Đăng nhập ------------------------------------------------------------
const browser = await browserType.launch({ headless: !args.headed });
const ctx = await browser.newContext();
const page = await ctx.newPage();
let exitCode = 0;

/** Locator đầu tiên tìm thấy trong danh sách ứng viên, hoặc null. */
async function firstVisible(candidates) {
  for (const loc of candidates) {
    try {
      if (await loc.first().isVisible({ timeout: 1_500 })) return loc.first();
    } catch { /* ứng viên tiếp theo */ }
  }
  return null;
}

try {
  console.log(`  Mở ${args.url}`);
  await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

  const passField = args['pass-selector']
    ? page.locator(args['pass-selector'])
    : await firstVisible([
        page.locator('input[type="password"]'),
        page.getByLabel(/mật khẩu|password|pass/i),
      ]);

  const userField = args['user-selector']
    ? page.locator(args['user-selector'])
    : await firstVisible([
        page.getByLabel(/email|tài khoản|tên đăng nhập|username|user|số điện thoại|sđt|phone/i),
        page.getByPlaceholder(/email|tài khoản|tên đăng nhập|username|số điện thoại|sđt/i),
        page.locator('input[type="email"]'),
        page.locator('input[name="username"], input[name="email"], input[name="account"], input[id*="user" i]'),
        page.locator('input[type="text"]'),
      ]);

  if (!userField || !passField) {
    console.error(
      '\n✗ Không dò được form đăng nhập trên trang này.\n' +
      `  Ô tài khoản: ${userField ? 'tìm thấy' : 'KHÔNG thấy'}\n` +
      `  Ô mật khẩu : ${passField ? 'tìm thấy' : 'KHÔNG thấy'}\n\n` +
      '  Cách xử lý: đọc cây accessibility của trang rồi truyền selector thật vào:\n' +
      '    node scripts/explore.mjs --url <trang login>\n' +
      '    node scripts/auth-login.mjs ... --user-selector "..." --pass-selector "..."\n' +
      '  Nếu trang login nằm sau redirect/SSO, truyền đúng URL cuối bằng --url.',
    );
    exitCode = 2;
    throw new Error('__handled__');
  }

  await userField.fill(username);
  await passField.fill(password);

  const submit = args['submit-selector']
    ? page.locator(args['submit-selector'])
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

  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  // --- 2FA ---------------------------------------------------------------
  if (args['totp-env']) {
    const secret = process.env[args['totp-env']];
    if (!secret) {
      console.error(`Thiếu biến ${args['totp-env']} cho 2FA.`);
      exitCode = 1;
      throw new Error('__handled__');
    }
    const otpField = args['otp-selector']
      ? page.locator(args['otp-selector'])
      : await firstVisible([
          page.getByLabel(/otp|mã xác thực|mã xác minh|verification code|authentication code/i),
          page.locator('input[autocomplete="one-time-code"]'),
          page.locator('input[name*="otp" i], input[id*="otp" i], input[name*="code" i]'),
        ]);
    if (otpField) {
      const code = totp(secret);
      console.log(`  Nhập mã 2FA (TOTP, 6 chữ số) — hết hạn sau ${30 - (Math.floor(Date.now() / 1000) % 30)}s`);
      await otpField.fill(code);
      const otpSubmit = await firstVisible([
        page.getByRole('button', { name: /xác nhận|xác minh|verify|continue|tiếp tục|submit/i }),
        page.locator('button[type="submit"]'),
      ]);
      if (otpSubmit) await otpSubmit.click(); else await otpField.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    } else {
      console.log('  (Không thấy ô OTP — có thể tài khoản này được miễn 2FA, đi tiếp)');
    }
  }

  // --- Chờ tín hiệu đăng nhập thật sự xong -------------------------------
  // Lưu state ngay sau khi click là lỗi kinh điển: cookie phiên có thể chưa được
  // set xong, ra file rỗng, và mọi test sau đó fail rất khó truy.
  if (args['success-url']) {
    await page.waitForURL(new RegExp(args['success-url']), { timeout: TIMEOUT });
  } else if (args['success-text']) {
    await page.getByText(args['success-text']).first().waitFor({ state: 'visible', timeout: TIMEOUT });
  } else {
    await page.locator('input[type="password"]:visible')
      .first().waitFor({ state: 'detached', timeout: TIMEOUT })
      .catch(() => {});
    await page.waitForTimeout(500);
  }

  const stillOnLogin = await page.locator('input[type="password"]:visible').count().catch(() => 0);
  if (stillOnLogin > 0) {
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
      (errText ? `  App báo: ${errText.replace(/\s+/g, ' ').slice(0, 200)}\n` : '') +
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
    `  URL sau: ${page.url()}\n\n` +
    `  Lượt sau chạy trước lệnh này để khỏi đăng nhập lại:\n` +
    `    node scripts/auth-login.mjs --url ${args.url} --out ${args.out} --check\n\n` +
    `  Nhớ: ${args.out} chứa cookie thật — phải nằm trong .gitignore, không đính kèm ticket.`,
  );
  process.exit(0);
} catch (e) {
  if (e.message !== '__handled__') {
    console.error(`\n✗ Đăng nhập thất bại: ${e.message}`);
    exitCode = exitCode || 1;
  }
  await browser.close().catch(() => {});
  process.exit(exitCode || 1);
}

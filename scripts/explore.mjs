#!/usr/bin/env node
/**
 * explore.mjs — Trinh sát một trang web và sinh danh sách locator DÙNG ĐƯỢC NGAY.
 *
 * Mục đích: loại bỏ việc đoán selector. Script mở trang thật, chờ render xong,
 * đọc DOM, rồi in ra locator theo đúng thứ tự ưu tiên của Playwright
 * (getByRole > getByLabel > getByPlaceholder > getByTestId > getByText > #id > CSS),
 * kèm cảnh báo khi một locator dính nhiều phần tử (strict mode sẽ fail).
 *
 * Chạy `node explore.mjs --help` để xem hướng dẫn.
 */

import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const HELP = `
explore.mjs — trinh sát trang web, lấy locator có thật

CÁCH DÙNG
  node explore.mjs --url <url> [tuỳ chọn]

TUỲ CHỌN
  --url <url>              (bắt buộc) URL cần trinh sát. Hỗ trợ cả file:// cho HTML tĩnh.
  --out <thư mục>          Nơi lưu kết quả. Mặc định: ./recon-output
  --browser <tên>          chromium | firefox | webkit. Mặc định: chromium
  --headed                 Hiện trình duyệt (mặc định chạy ẩn)
  --viewport <WxH>         Kích thước màn hình. Mặc định: 1280x800
  --device <tên>           Preset thiết bị, ví dụ: "iPhone 14", "Pixel 7"
  --wait <ms>              Chờ thêm sau khi trang load. Mặc định: 1000
  --wait-for <selector>    Chờ selector này xuất hiện trước khi đọc DOM
  --max <n>                Số phần tử tối đa liệt kê. Mặc định: 150

  ĐĂNG NHẬP TRƯỚC KHI TRINH SÁT
  --auth <file.json>       Dùng storageState đã lưu sẵn
  --login-url <url>        Trang đăng nhập (mặc định dùng --url)
  --username <giá trị>     Tài khoản
  --password <giá trị>     Mật khẩu
  --save-auth <file.json>  Lưu lại storageState sau khi đăng nhập để lần sau dùng --auth

  TƯƠNG TÁC TRƯỚC KHI CHỤP
  --click <text>           Bấm phần tử có text này trước khi đọc DOM (lặp lại được)
  --fill <label=giá trị>   Điền vào ô có nhãn/placeholder này (lặp lại được)

  KHÁC
  --no-screenshot          Không chụp màn hình
  --timeout <ms>           Timeout điều hướng. Mặc định: 45000
  --ignore-https-errors    Bỏ qua lỗi chứng chỉ (staging dùng self-signed cert)
  --help

VÍ DỤ
  node explore.mjs --url https://staging.example.com/login
  node explore.mjs --url https://app.example.com --auth .auth/user.json --out recon/dashboard
  node explore.mjs --url https://example.com --click "Đăng ký" --out recon/register
  node explore.mjs --url https://app.example.com/login \\
     --username tester@example.com --password 'Abc@123' --save-auth .auth/user.json

KẾT QUẢ
  In tóm tắt ra màn hình (đủ để viết test luôn) và lưu vào --out:
    elements.md          bảng phần tử + locator gợi ý
    page-info.json       dữ liệu thô, dùng cho script khác
    screenshot.png       ảnh full page
    console.log          log console (đặc biệt là error)
    network-errors.log   request lỗi 4xx/5xx hoặc failed
`;

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      url: { type: 'string' },
      out: { type: 'string', default: './recon-output' },
      browser: { type: 'string', default: 'chromium' },
      headed: { type: 'boolean', default: false },
      viewport: { type: 'string', default: '1280x800' },
      device: { type: 'string' },
      wait: { type: 'string', default: '1000' },
      'wait-for': { type: 'string' },
      max: { type: 'string', default: '150' },
      auth: { type: 'string' },
      'login-url': { type: 'string' },
      username: { type: 'string' },
      password: { type: 'string' },
      'save-auth': { type: 'string' },
      click: { type: 'string', multiple: true, default: [] },
      fill: { type: 'string', multiple: true, default: [] },
      'no-screenshot': { type: 'boolean', default: false },
      timeout: { type: 'string', default: '45000' },
      'ignore-https-errors': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  }));
} catch (err) {
  console.error(`Tham số không hợp lệ: ${err.message}\n${HELP}`);
  process.exit(1);
}

if (args.help || !args.url) {
  console.log(HELP);
  process.exit(args.url ? 0 : 1);
}

// --- Nạp Playwright -------------------------------------------------------
// Skill thường nằm ngoài thư mục dự án, còn Playwright lại được cài trong dự án.
// Nên thử phân giải cả từ vị trí script lẫn từ thư mục làm việc hiện tại.
// Playwright là gói CommonJS: tuỳ cách nạp mà các export nằm ở namespace hoặc ở .default.
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

const outDir = path.resolve(args.out);
mkdirSync(outDir, { recursive: true });

const [vw, vh] = args.viewport.split('x').map(Number);
const navTimeout = Number(args.timeout);

const contextOptions = {
  viewport: { width: vw || 1280, height: vh || 800 },
  ignoreHTTPSErrors: args['ignore-https-errors'],
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
};
if (args.device && pw.devices?.[args.device]) Object.assign(contextOptions, pw.devices[args.device]);
if (args.auth) {
  if (!existsSync(args.auth)) {
    console.error(`Không tìm thấy file auth: ${args.auth}`);
    process.exit(1);
  }
  contextOptions.storageState = args.auth;
}

const browser = await browserType.launch({ headless: !args.headed });
const context = await browser.newContext(contextOptions);
const page = await context.newPage();

const consoleLines = [];
const networkErrors = [];
page.on('console', m => consoleLines.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.message}`));
page.on('requestfailed', r => networkErrors.push(`FAILED ${r.method()} ${r.url()} — ${r.failure()?.errorText ?? ''}`));
page.on('response', r => { if (r.status() >= 400) networkErrors.push(`${r.status()} ${r.request().method()} ${r.url()}`); });

const fail = async (msg, err) => {
  console.error(`\n✗ ${msg}${err ? `\n  ${err.message}` : ''}`);
  await browser.close();
  process.exit(1);
};

// --- Đăng nhập (tuỳ chọn) -------------------------------------------------
if (args.username && args.password) {
  const loginUrl = args['login-url'] || args.url;
  console.log(`→ Đăng nhập tại ${loginUrl} ...`);
  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: navTimeout });

    const userField = page.locator(
      'input[type="email"], input[name*="user" i], input[name*="email" i], ' +
      'input[id*="user" i], input[id*="email" i], input[type="text"]'
    ).first();
    const passField = page.locator('input[type="password"]').first();

    await userField.fill(args.username, { timeout: 15000 });
    await passField.fill(args.password, { timeout: 15000 });
    await passField.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: navTimeout }).catch(() => {});

    if (await page.locator('input[type="password"]').count() > 0) {
      console.warn('⚠ Vẫn thấy ô mật khẩu sau khi submit — có thể đăng nhập chưa thành công.');
    }
    if (args['save-auth']) {
      mkdirSync(path.dirname(path.resolve(args['save-auth'])), { recursive: true });
      await context.storageState({ path: args['save-auth'] });
      console.log(`→ Đã lưu phiên đăng nhập: ${args['save-auth']}`);
    }
  } catch (err) {
    await fail('Đăng nhập thất bại. Thử --headed để nhìn xem đang kẹt ở đâu.', err);
  }
}

// --- Điều hướng -----------------------------------------------------------
console.log(`→ Mở ${args.url} ...`);
try {
  await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
} catch (err) {
  await fail(`Không mở được ${args.url}. Kiểm tra server đã chạy chưa và URL có đúng không.`, err);
}

// networkidle rất hữu ích cho recon, nhưng app có polling/websocket sẽ không bao giờ idle → bỏ qua nếu quá hạn.
await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
if (args['wait-for']) {
  await page.locator(args['wait-for']).first().waitFor({ timeout: navTimeout })
    .catch(() => console.warn(`⚠ Không thấy "${args['wait-for']}" trong thời gian chờ — vẫn tiếp tục.`));
}
await page.waitForTimeout(Number(args.wait));

// --- Tương tác trước khi đọc DOM -----------------------------------------
for (const spec of args.fill) {
  const [label, ...rest] = spec.split('=');
  const value = rest.join('=');
  const target = page.getByLabel(label).or(page.getByPlaceholder(label)).first();
  await target.fill(value, { timeout: 10000 })
    .then(() => console.log(`→ Đã điền "${label}"`))
    .catch(() => console.warn(`⚠ Không điền được "${label}"`));
}
for (const text of args.click) {
  const target = page.getByRole('button', { name: text }).or(page.getByRole('link', { name: text }))
    .or(page.getByText(text, { exact: false })).first();
  await target.click({ timeout: 10000 })
    .then(() => console.log(`→ Đã bấm "${text}"`))
    .catch(() => console.warn(`⚠ Không bấm được "${text}"`));
  await page.waitForTimeout(600);
}

// --- Thu thập phần tử -----------------------------------------------------
const collected = await page.evaluate((MAX) => {
  const roleOf = (el) => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
    if (tag === 'button') return 'button';
    if (tag === 'select') return el.multiple ? 'listbox' : 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'summary') return 'button';
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'img') return 'img';
    if (tag === 'input') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      return { submit: 'button', button: 'button', reset: 'button', image: 'button',
               checkbox: 'checkbox', radio: 'radio', range: 'slider', number: 'spinbutton',
               search: 'searchbox', file: 'button', hidden: null }[t] ?? 'textbox';
    }
    return null;
  };

  const labelOf = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria?.trim()) return aria.trim();
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const txt = by.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
      if (txt) return txt;
    }
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl?.textContent?.trim()) return lbl.textContent.trim();
    }
    const wrap = el.closest('label');
    if (wrap?.textContent?.trim()) return wrap.textContent.trim();
    return '';
  };

  const nameOf = (el, label) => {
    if (label) return label;
    const alt = el.getAttribute('alt');
    if (alt?.trim()) return alt.trim();
    if (el.tagName.toLowerCase() === 'input') {
      const t = (el.getAttribute('type') || '').toLowerCase();
      if (['submit', 'button', 'reset'].includes(t)) return (el.value || '').trim();
      return '';
    }
    const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt) return txt.slice(0, 80);
    return (el.getAttribute('title') || '').trim();
  };

  const cssPath = (el) => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 4) {
      let part = cur.tagName.toLowerCase();
      const cls = (cur.getAttribute('class') || '').trim().split(/\s+/).filter(c => c && !/\d/.test(c))[0];
      if (cls) part += `.${CSS.escape(cls)}`;
      const sameTag = cur.parentElement ? [...cur.parentElement.children].filter(c => c.tagName === cur.tagName) : [];
      if (sameTag.length > 1) part += `:nth-child(${[...cur.parentElement.children].indexOf(cur) + 1})`;
      parts.unshift(part);
      if (cur.id) { parts[0] = `#${CSS.escape(cur.id)}`; break; }
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };

  const SELECTOR = 'a[href], button, input, select, textarea, summary, [role], [contenteditable="true"], h1, h2, h3, h4, h5, h6, [data-testid], [data-test], [data-cy]';
  const nodes = [...document.querySelectorAll(SELECTOR)];
  const out = [];

  for (const el of nodes) {
    if (out.length >= MAX) break;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const hidden = style.display === 'none' || style.visibility === 'hidden' ||
                   el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true' ||
                   (el.tagName === 'INPUT' && el.type === 'hidden');
    if (hidden) continue;

    const role = roleOf(el);
    const label = labelOf(el);
    const name = nameOf(el, label);
    const testid = el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy') || '';
    const placeholder = el.getAttribute('placeholder') || '';
    const tag = el.tagName.toLowerCase();

    if (!role && !testid) continue;

    out.push({
      tag,
      type: el.getAttribute('type') || '',
      role, name, label, placeholder, testid,
      id: el.id || '',
      css: cssPath(el),
      inViewport: rect.top < innerHeight && rect.bottom > 0 && rect.width > 0 && rect.height > 0,
      disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
      href: tag === 'a' ? (el.getAttribute('href') || '') : '',
      level: /^h[1-6]$/.test(tag) ? Number(tag[1]) : undefined,
    });
  }

  return {
    title: document.title,
    url: location.href,
    lang: document.documentElement.lang || '',
    frames: [...document.querySelectorAll('iframe')].map(f => f.getAttribute('title') || f.getAttribute('name') || f.getAttribute('src') || '(iframe không tên)'),
    headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 25)
      .map(h => `${h.tagName.toLowerCase()}: ${(h.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90)}`),
    forms: [...document.querySelectorAll('form')].map(f => ({
      name: f.getAttribute('name') || f.getAttribute('id') || '(không tên)',
      action: f.getAttribute('action') || '',
      fields: f.querySelectorAll('input:not([type=hidden]), select, textarea').length,
    })),
    elements: out,
  };
}, Number(args.max));

// --- Gợi ý locator + kiểm tra tính duy nhất -------------------------------
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function suggest(e) {
  if (e.role && e.name) {
    const lvl = e.role === 'heading' && e.level ? `, level: ${e.level}` : '';
    return { code: `page.getByRole('${e.role}', { name: '${esc(e.name)}'${lvl} })`, kind: 'role' };
  }
  if (e.label) return { code: `page.getByLabel('${esc(e.label)}')`, kind: 'label' };
  if (e.placeholder) return { code: `page.getByPlaceholder('${esc(e.placeholder)}')`, kind: 'placeholder' };
  if (e.testid) return { code: `page.getByTestId('${esc(e.testid)}')`, kind: 'testid' };
  if (e.name) return { code: `page.getByText('${esc(e.name)}')`, kind: 'text' };
  if (e.id) return { code: `page.locator('#${esc(e.id)}')`, kind: 'css' };
  return { code: `page.locator('${esc(e.css)}')`, kind: 'css' };
}

function toLocator(e, s) {
  switch (s.kind) {
    case 'role': {
      const opts = { name: e.name, exact: true };
      if (e.role === 'heading' && e.level) opts.level = e.level;
      return page.getByRole(e.role, opts);
    }
    case 'label': return page.getByLabel(e.label, { exact: true });
    case 'placeholder': return page.getByPlaceholder(e.placeholder, { exact: true });
    case 'testid': return page.getByTestId(e.testid);
    case 'text': return page.getByText(e.name, { exact: true });
    default: return page.locator(e.id ? `#${e.id}` : e.css);
  }
}

const rows = [];
for (const e of collected.elements) {
  const s = suggest(e);
  let count = null;
  try { count = await toLocator(e, s).count(); } catch { /* locator không hợp lệ với engine — bỏ qua đếm */ }
  rows.push({ ...e, locator: s.code, kind: s.kind, count });
}

// --- Ghi file -------------------------------------------------------------
const quality = { role: 'tốt', label: 'tốt', placeholder: 'khá', testid: 'tốt', text: 'khá', css: 'yếu' };

// Locator trùng nhau (ví dụ 2 nút "Chi tiết" trên 2 dòng bảng) chỉ cần liệt kê một lần —
// cột "khớp N phần tử" đã nói đủ, in lặp lại chỉ làm nhiễu.
const uniqueRows = [...new Map(rows.map(r => [r.locator, r])).values()];

const mdRows = uniqueRows.map(r => {
  const warn = r.count === 0 ? ' ⚠ không khớp' : r.count > 1 ? ` ⚠ khớp ${r.count} phần tử` : '';
  const extra = [
    r.disabled ? 'disabled' : '',
    r.href ? `→ ${r.href}` : '',
    r.testid && r.kind !== 'testid' ? `hoặc \`page.getByTestId('${esc(r.testid)}')\`` : '',
  ].filter(Boolean).join(' · ');
  return `| ${r.role || r.tag} | ${(r.name || r.placeholder || r.testid || '').slice(0, 45)} | \`${r.locator}\` | ${quality[r.kind]}${warn} | ${extra} |`;
});

const md = `# Kết quả trinh sát

- **URL**: ${collected.url}
- **Tiêu đề**: ${collected.title}
- **Ngôn ngữ trang**: ${collected.lang || '(không khai báo)'}
- **Số phần tử đọc được**: ${rows.length} (${uniqueRows.length} locator khác nhau)
${collected.frames.length ? `- **iframe** (cần dùng \`page.frameLocator(...)\`): ${collected.frames.join(', ')}` : ''}

## Cấu trúc heading
${collected.headings.length ? collected.headings.map(h => `- ${h}`).join('\n') : '_(không có)_'}

## Form
${collected.forms.length ? collected.forms.map(f => `- **${f.name}** — ${f.fields} trường, action: ${f.action || '(không có)'}`).join('\n') : '_(không có)_'}

## Locator gợi ý

| Role/Tag | Tên hiển thị | Locator | Độ bền | Ghi chú |
|---|---|---|---|---|
${mdRows.join('\n')}

> Cột "Độ bền": \`tốt\` dùng được lâu dài; \`khá\` chấp nhận được; \`yếu\` là CSS — sẽ gãy khi dev đổi giao diện,
> nên đề nghị dev thêm \`data-testid\` cho những phần tử này.
> Locator bị đánh dấu "khớp N phần tử" sẽ làm Playwright báo lỗi strict mode — thu hẹp bằng \`.filter()\` hoặc theo vùng cha.

## Console
${consoleLines.length ? '```\n' + consoleLines.slice(0, 60).join('\n') + '\n```' : '_(sạch)_'}

## Request lỗi
${networkErrors.length ? '```\n' + networkErrors.slice(0, 40).join('\n') + '\n```' : '_(không có)_'}
`;

writeFileSync(path.join(outDir, 'elements.md'), md, 'utf8');
writeFileSync(path.join(outDir, 'page-info.json'), JSON.stringify({ ...collected, elements: rows }, null, 2), 'utf8');
writeFileSync(path.join(outDir, 'console.log'), consoleLines.join('\n'), 'utf8');
writeFileSync(path.join(outDir, 'network-errors.log'), networkErrors.join('\n'), 'utf8');

if (!args['no-screenshot']) {
  await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true }).catch(() => {});
}

// --- Tóm tắt ra màn hình --------------------------------------------------
const errors = consoleLines.filter(l => l.startsWith('[error]') || l.startsWith('[pageerror]'));
const INTERACTIVE_ROLES = ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'searchbox', 'spinbutton'];
const interactive = uniqueRows.filter(r => INTERACTIVE_ROLES.includes(r.role));

console.log([
  '',
  '═══════════════════════════════════════════════════════',
  ` ${collected.title || '(không có tiêu đề)'}`,
  ` ${collected.url}`,
  '═══════════════════════════════════════════════════════',
  ` Locator tương tác: ${interactive.length} / tổng ${rows.length} phần tử`,
  ` Lỗi console: ${errors.length}   Request lỗi: ${networkErrors.length}`,
  ...(collected.frames.length ? [` iframe: ${collected.frames.length} (phải dùng frameLocator)`] : []),
  '───────────────────────────────────────────────────────',
].join('\n'));

const groups = [
  ['NÚT / LINK', r => ['button', 'link'].includes(r.role)],
  ['Ô NHẬP LIỆU', r => ['textbox', 'searchbox', 'spinbutton', 'combobox', 'listbox'].includes(r.role)],
  ['CHECKBOX / RADIO', r => ['checkbox', 'radio', 'switch'].includes(r.role)],
];

for (const [heading, filter] of groups) {
  const items = uniqueRows.filter(filter);
  if (!items.length) continue;
  console.log(`\n▸ ${heading}`);
  for (const r of items.slice(0, 40)) {
    const warn = r.count === 0 ? '  ⚠ KHÔNG KHỚP' : r.count > 1 ? `  ⚠ KHỚP ${r.count}` : '';
    console.log(`  ${r.locator}${warn}`);
  }
  if (items.length > 40) console.log(`  ... còn ${items.length - 40} phần tử nữa, xem elements.md`);
}

if (errors.length) {
  console.log(`\n▸ LỖI CONSOLE (có thể đã là bug — kiểm chứng bằng tay)`);
  errors.slice(0, 10).forEach(l => console.log(`  ${l}`));
}
if (networkErrors.length) {
  console.log(`\n▸ REQUEST LỖI`);
  networkErrors.slice(0, 10).forEach(l => console.log(`  ${l}`));
}

console.log(`
───────────────────────────────────────────────────────
 Đã lưu: ${outDir}
   elements.md · page-info.json · screenshot.png · console.log · network-errors.log
═══════════════════════════════════════════════════════
`);

await context.close();
await browser.close();

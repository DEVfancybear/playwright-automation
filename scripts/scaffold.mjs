#!/usr/bin/env node
/**
 * scaffold.mjs — Dựng khung dự án automation test Playwright + TypeScript.
 *
 * Sinh sẵn: playwright.config.ts (đa môi trường, reporter, retry, trace),
 * Page Object mẫu, fixture đăng nhập một lần bằng storageState, spec mẫu cho
 * từng loại test được chọn, và file CI.
 *
 * Chạy `node scaffold.mjs --help` để xem hướng dẫn.
 */

import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = path.join(SKILL_DIR, 'assets', 'template');

const HELP = `
scaffold.mjs — dựng khung dự án Playwright + TypeScript cho tester

CÁCH DÙNG
  node scaffold.mjs --dir <thư mục> [tuỳ chọn]

TUỲ CHỌN
  --dir <đường dẫn>     (bắt buộc) Nơi tạo dự án, ví dụ ./e2e
  --name <tên>          Tên dự án trong package.json. Mặc định: tên thư mục
  --base-url <url>      URL app cần test. Mặc định: http://localhost:3000
  --api-url <url>       URL API. Mặc định: giống --base-url
  --features <ds>       Loại test cần dựng, cách nhau bởi dấu phẩy.
                        ui | api | visual | a11y      Mặc định: ui,api
  --ci <loại>           github | jenkins | gitlab | none   Mặc định: github
  --force               Ghi đè file đã tồn tại (mặc định: bỏ qua, không ghi đè)
  --dry-run             Chỉ in ra những gì sẽ tạo, không ghi file
  --help

VÍ DỤ
  node scaffold.mjs --dir ./e2e
  node scaffold.mjs --dir ./e2e --base-url https://staging.example.com --features ui,api,visual,a11y
  node scaffold.mjs --dir ./tests-e2e --api-url https://api-staging.example.com --ci jenkins

SAU KHI CHẠY
  cd <thư mục> && npm install && npx playwright install --with-deps chromium
  cp .env.example .env      # rồi điền tài khoản test vào .env
  npx playwright test --ui
`;

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      dir: { type: 'string' },
      name: { type: 'string' },
      'base-url': { type: 'string', default: 'http://localhost:3000' },
      'api-url': { type: 'string' },
      features: { type: 'string', default: 'ui,api' },
      ci: { type: 'string', default: 'github' },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  }));
} catch (err) {
  console.error(`Tham số không hợp lệ: ${err.message}\n${HELP}`);
  process.exit(1);
}

if (args.help || !args.dir) {
  console.log(HELP);
  process.exit(args.dir ? 0 : 1);
}

if (!existsSync(TEMPLATE_DIR)) {
  console.error(`Không tìm thấy thư mục template: ${TEMPLATE_DIR}`);
  process.exit(1);
}

const targetDir = path.resolve(args.dir);
const projectName = args.name || path.basename(targetDir) || 'e2e-tests';
const baseUrl = args['base-url'];
const apiUrl = args['api-url'] || baseUrl;
const features = new Set(args.features.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const ci = args.ci.toLowerCase();

const VALID_FEATURES = ['ui', 'api', 'visual', 'a11y'];
const unknown = [...features].filter(f => !VALID_FEATURES.includes(f));
if (unknown.length) {
  console.error(`Feature không hợp lệ: ${unknown.join(', ')}. Chọn trong: ${VALID_FEATURES.join(' | ')}`);
  process.exit(1);
}
if (!['github', 'jenkins', 'gitlab', 'none'].includes(ci)) {
  console.error(`--ci không hợp lệ: ${ci}. Chọn: github | jenkins | gitlab | none`);
  process.exit(1);
}

// Phiên bản Playwright dùng trong package.json và image Docker của CI.
const PW_VERSION = '1.62.1';

const TOKENS = {
  '{{PROJECT_NAME}}': projectName,
  '{{BASE_URL}}': baseUrl,
  '{{API_URL}}': apiUrl,
  '{{PW_VERSION}}': PW_VERSION,
};

/** Tên file trong template → tên thật khi copy (tránh việc .gitignore/package.json của template ảnh hưởng tới skill). */
const RENAME = {
  '_gitignore': '.gitignore',
  '_env.example': '.env.example',
  'package.json.tmpl': 'package.json',
};

/** Quyết định file nào được copy theo --features / --ci. */
function shouldInclude(rel) {
  const p = rel.replace(/\\/g, '/');

  if (p.startsWith('ci/')) return false;   // xử lý riêng bên dưới

  if (p.startsWith('tests/api/') || p.includes('api-fixtures')) return features.has('api');
  if (p.startsWith('tests/visual/') || p === 'screenshot.css') return features.has('visual');
  if (p.startsWith('tests/a11y/')) return features.has('a11y');
  if (p.startsWith('tests/ui/') || p.startsWith('pages/')) return features.has('ui');

  return true;   // config, utils, fixtures chung, README, .env.example...
}

const created = [];
const skipped = [];

function walk(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const rel = base ? path.join(base, entry) : entry;
    if (statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

function render(content) {
  let out = content;
  for (const [token, value] of Object.entries(TOKENS)) out = out.split(token).join(value);
  return out;
}

/** Điều chỉnh nội dung theo --features sau khi đã thay token. */
function postProcess(relTarget, content) {
  const name = relTarget.replace(/\\/g, '/');

  // Accessibility cần gói axe; thiếu nó thì spec a11y không chạy được.
  if (name === 'package.json' && features.has('a11y')) {
    content = content.replace(
      /"devDependencies":\s*\{/,
      '"devDependencies": {\n    "@axe-core/playwright": "^4.10.1",'
    );
  }

  // Visual test ổn định hơn nhiều khi có CSS tắt animation / ẩn phần tử động.
  if (name === 'playwright.config.ts' && features.has('visual')) {
    content = content.replace(
      'toHaveScreenshot: {',
      "toHaveScreenshot: {\n      stylePath: './screenshot.css',"
    );
  }

  return content;
}

function emit(relTarget, content) {
  const dest = path.join(targetDir, relTarget);
  if (existsSync(dest) && !args.force) {
    skipped.push(relTarget);
    return;
  }
  if (!args['dry-run']) {
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, postProcess(relTarget, content), 'utf8');
  }
  created.push(relTarget);
}

for (const rel of walk(TEMPLATE_DIR)) {
  if (!shouldInclude(rel)) continue;
  const content = render(readFileSync(path.join(TEMPLATE_DIR, rel), 'utf8'));
  const dir = path.dirname(rel);
  const base = path.basename(rel);
  const target = path.join(dir === '.' ? '' : dir, RENAME[base] || base);
  emit(target, content);
}

// --- File CI --------------------------------------------------------------
const CI_MAP = {
  github: ['ci/github-actions.yml', '.github/workflows/e2e.yml'],
  jenkins: ['ci/Jenkinsfile', 'Jenkinsfile'],
  gitlab: ['ci/gitlab-ci.yml', '.gitlab-ci.yml'],
};
if (ci !== 'none') {
  const [src, dest] = CI_MAP[ci];
  const abs = path.join(TEMPLATE_DIR, src);
  if (existsSync(abs)) emit(dest, render(readFileSync(abs, 'utf8')));
}

// --- Tổng kết -------------------------------------------------------------
console.log(`
═══════════════════════════════════════════════════════
 Dự án: ${projectName}
 Thư mục: ${targetDir}
 BASE_URL: ${baseUrl}
 API_URL: ${apiUrl}
 Loại test: ${[...features].join(', ') || '(không có)'}
 CI: ${ci}
═══════════════════════════════════════════════════════
${args['dry-run'] ? ' (DRY RUN — chưa ghi file nào)\n' : ''}`);

console.log(`Đã tạo ${created.length} file:`);
for (const f of created.sort()) console.log(`  + ${f}`);

if (skipped.length) {
  console.log(`\nBỏ qua ${skipped.length} file đã tồn tại (dùng --force để ghi đè):`);
  for (const f of skipped.sort()) console.log(`  - ${f}`);
}

console.log(`
───────────────────────────────────────────────────────
BƯỚC TIẾP THEO

  cd "${path.relative(process.cwd(), targetDir) || '.'}"
  npm install
  npx playwright install --with-deps chromium
  cp .env.example .env          # rồi điền tài khoản test thật vào .env

  npx playwright test --ui      # chế độ giao diện, dễ theo dõi nhất
  npx playwright test           # chạy toàn bộ

LƯU Ý
  · Sửa pages/LoginPage.ts cho khớp giao diện thật — chạy
    scripts/explore.mjs để lấy locator có thật thay vì đoán.
  · .env chứa mật khẩu thật và đã được .gitignore — đừng commit.
───────────────────────────────────────────────────────
`);

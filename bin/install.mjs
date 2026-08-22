#!/usr/bin/env node
/**
 * Trình cài đặt skill playwright-automation.
 *
 * Copy nội dung skill vào nơi agent host tìm skill:
 *   - Claude: ~/.claude/skills hoặc .claude/skills
 *   - Codex:  $CODEX_HOME/skills (hoặc ~/.codex/skills) hay .agents/skills
 */

import { parseArgs } from 'node:util';
import { cpSync, existsSync, lstatSync, rmSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'playwright-automation';

// Chỉ những thứ agent cần khi nạp skill. docs/ và README dành cho người đọc trên GitHub,
// đưa vào thư mục skill chỉ làm rác.
const SKILL_CONTENT = ['SKILL.md', 'agents', 'references', 'scripts', 'assets', 'LICENSE'];

function includeSkillFile(source) {
  const name = path.basename(source);
  return name !== '__pycache__' && !/\.py[co]$/i.test(name);
}

const HOSTS = {
  claude: {
    label: 'Claude Code',
    userDir: ['.claude', 'skills'],
    projectDir: ['.claude', 'skills'],
  },
  codex: {
    label: 'Codex',
    userDir: ['.codex', 'skills'],
    projectDir: ['.agents', 'skills'],
  },
};

const HELP = `
playwright-automation — skill Playwright QA cho Claude và Codex

CÁCH DÙNG
  npx @duong.dev/playwright-automation install [tuỳ chọn]     Cài skill
  npx @duong.dev/playwright-automation uninstall [tuỳ chọn]   Gỡ skill
  npx @duong.dev/playwright-automation where                  In ra nơi skill đang được cài

TUỲ CHỌN
  --codex          Cài cho Codex: $CODEX_HOME/skills/ nếu có, nếu không ~/.codex/skills/
                   Với --project, cài vào .agents/skills/ của dự án hiện tại
  --claude         Cài cho Claude Code (mặc định, giữ tương thích ngược)
  --project        Cài vào thư mục skill của dự án hiện tại, commit được cho cả team
                   thay vì thư mục skill cá nhân dùng ở mọi dự án
  --dir <đường dẫn>  Cài vào thư mục tự chọn
  --force          Ghi đè bản đã cài
  --help

VÍ DỤ
  npx @duong.dev/playwright-automation install
  npx @duong.dev/playwright-automation install --codex
  npx @duong.dev/playwright-automation install --codex --project
  npx @duong.dev/playwright-automation install --project
  npx @duong.dev/playwright-automation install --force
  npx @duong.dev/playwright-automation uninstall

SAU KHI CÀI
  Codex: gõ /skills hoặc nhắc $playwright-automation.
  Claude Code: khởi động lại nếu skill chưa xuất hiện.
  Sau đó thử:
    "Dựng giúp tôi khung automation test Playwright cho https://example.com"
`;

let args, positionals;
try {
  ({ values: args, positionals } = parseArgs({
    options: {
      project: { type: 'boolean', default: false },
      codex: { type: 'boolean', default: false },
      claude: { type: 'boolean', default: false },
      dir: { type: 'string' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  }));
} catch (err) {
  console.error(`Tham số không hợp lệ: ${err.message}\n${HELP}`);
  process.exit(1);
}

const command = positionals[0];

if (args.help || !command) {
  console.log(HELP);
  process.exit(args.help ? 0 : 1);
}

if (args.codex && args.claude) {
  console.error(`Chỉ chọn một trong hai: --codex hoặc --claude.\n${HELP}`);
  process.exit(1);
}

const hasCustomDir = args.dir !== undefined;
if (hasCustomDir && !args.dir.trim()) {
  console.error('--dir không được rỗng hoặc chỉ chứa khoảng trắng.');
  process.exit(1);
}

const hostKey = args.codex ? 'codex' : 'claude';
const host = HOSTS[hostKey];

function skillBase(projectScoped = args.project) {
  if (projectScoped) return path.join(process.cwd(), ...host.projectDir);

  if (hostKey === 'codex') {
    const configuredHome = process.env.CODEX_HOME?.trim();
    const codexHome = configuredHome ? path.resolve(configuredHome) : path.join(homedir(), '.codex');
    return path.join(codexHome, 'skills');
  }

  return path.join(homedir(), ...host.userDir);
}

function targetDir() {
  if (hasCustomDir) return path.resolve(args.dir);
  return path.join(skillBase(), SKILL_NAME);
}

function version() {
  try {
    return JSON.parse(readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
  } catch {
    return '?';
  }
}

function samePath(left, right) {
  const normalize = value => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function canonicalPath(value) {
  try {
    return realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

function isSameOrAncestor(parent, child) {
  const relative = path.relative(canonicalPath(parent), canonicalPath(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function inspectRemovalTarget(target) {
  const resolved = path.resolve(target);
  const actual = canonicalPath(resolved);
  const candidates = [resolved, actual];
  const protectedPaths = [homedir(), process.cwd(), PKG_ROOT].map(canonicalPath);

  for (const candidate of candidates) {
    if (samePath(candidate, path.parse(candidate).root)) {
      return { ok: false, why: 'đích là filesystem root' };
    }
    if (protectedPaths.some(protectedPath => isSameOrAncestor(candidate, protectedPath))) {
      return { ok: false, why: 'đích là hoặc bao phủ home, thư mục hiện tại hay source package' };
    }
  }

  let skill;
  try {
    const targetStat = lstatSync(resolved);
    const skillPath = path.join(resolved, 'SKILL.md');
    const skillStat = lstatSync(skillPath);
    if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) {
      return { ok: false, why: 'đích không phải thư mục thật' };
    }
    if (!skillStat.isFile() || skillStat.isSymbolicLink()) {
      return { ok: false, why: 'SKILL.md không phải file thật' };
    }
    skill = readFileSync(skillPath, 'utf8');
  } catch {
    return { ok: false, why: 'không có SKILL.md nhận diện bản cài' };
  }
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter || !/^name:\s*playwright-automation\s*$/m.test(frontmatter)) {
    return { ok: false, why: 'frontmatter SKILL.md không khai báo name: playwright-automation' };
  }
  return { ok: true, why: '' };
}

function requireSafeRemovalTarget(target) {
  const inspection = inspectRemovalTarget(target);
  if (inspection.ok) return;
  console.error(
    `Từ chối xoá/ghi đè thư mục không được xác minh là skill ${SKILL_NAME}:\n` +
    `  ${path.resolve(target)}\n` +
    `Lý do: ${inspection.why}.\n` +
    'Hãy chọn đúng thư mục skill hoặc tự xử lý thư mục ngoài installer sau khi kiểm tra.'
  );
  process.exit(1);
}

function warnLegacyCodexInstall() {
  if (hostKey !== 'codex' || hasCustomDir) return;

  const legacy = path.join(homedir(), '.agents', 'skills', SKILL_NAME);
  const activeGlobal = path.join(skillBase(false), SKILL_NAME);
  if (!existsSync(legacy) || samePath(legacy, activeGlobal)) return;

  console.warn(`
Cảnh báo: phát hiện bản Codex legacy tại:
  ${legacy}
Codex global hiện dùng:
  ${activeGlobal}
Bản legacy không được tự xoá; hãy bỏ nó thủ công nếu không còn host nào sử dụng.
`);
}

const dest = targetDir();

function uninstallHint() {
  const scope = hasCustomDir
    ? ` --dir "${dest}"`
    : args.project
      ? ' --project'
      : '';
  return `npx @duong.dev/playwright-automation uninstall --${hostKey}${scope}`;
}

switch (command) {
  case 'install': {
    if (existsSync(dest) && !args.force) {
      const inspection = inspectRemovalTarget(dest);
      const remedy = inspection.ok
        ? `Dùng --force để ghi đè, hoặc gỡ đúng bản này bằng: ${uninstallHint()}`
        : `Không dùng --force/uninstall tại đây: ${inspection.why}. Hãy chọn đúng thư mục skill.`;
      console.error(
        `Skill đã có sẵn tại:\n  ${dest}\n\n` +
        remedy
      );
      process.exit(1);
    }

    // Ghi đè sạch: cpSync chỉ merge, sẽ để lại file của bản cũ đã bị gỡ ở bản mới
    // (ví dụ reference bị đổi tên) → thư mục lai, SKILL.md mới trỏ vào file cũ.
    if (existsSync(dest)) {
      requireSafeRemovalTarget(dest);
      rmSync(dest, { recursive: true, force: true });
      console.log(`Đã xoá bản cũ tại: ${dest}`);
    }

    mkdirSync(dest, { recursive: true });
    const copied = [];
    for (const item of SKILL_CONTENT) {
      const src = path.join(PKG_ROOT, item);
      if (!existsSync(src)) continue;
      cpSync(src, path.join(dest, item), { recursive: true, filter: includeSkillFile });
      copied.push(item);
    }

    if (!copied.includes('SKILL.md')) {
      console.error('Gói bị thiếu SKILL.md — cài đặt thất bại. Vui lòng báo lỗi tại repo.');
      process.exit(1);
    }

    console.log(`
✓ Đã cài skill playwright-automation v${version()}

  Host: ${host.label}
  Vị trí: ${dest}
  Nội dung: ${copied.join(', ')}
  Phạm vi: ${hasCustomDir ? 'thư mục tự chọn'
             : args.project ? `dự án này (commit ${host.projectDir.join('/')}/ để cả team dùng)`
             : 'toàn máy, mọi dự án'}

BƯỚC TIẾP THEO
  1. ${hostKey === 'codex'
    ? 'Gõ /skills hoặc nhắc $playwright-automation; nếu chưa xuất hiện, khởi động lại Codex.'
    : 'Khởi động lại Claude Code nếu skill chưa xuất hiện.'}
  2. Thử một yêu cầu thật, ví dụ:
       "Test giúp tôi chức năng đăng nhập ở https://staging.example.com"

  Để chạy được test, cần Node ≥ 20 và Playwright trong thư mục dự án:
       npm i -D @playwright/test && npx playwright install --with-deps chromium
`);
    warnLegacyCodexInstall();
    break;
  }

  case 'uninstall': {
    if (!existsSync(dest)) {
      console.log(`Không có skill nào ở:\n  ${dest}`);
      warnLegacyCodexInstall();
      process.exit(0);
    }
    requireSafeRemovalTarget(dest);
    rmSync(dest, { recursive: true, force: true });
    console.log(`✓ Đã gỡ skill khỏi:\n  ${dest}`);
    warnLegacyCodexInstall();
    break;
  }

  case 'where': {
    if (hasCustomDir) {
      console.log(`${host.label} — thư mục tự chọn:\n  ${dest}\n  ${existsSync(dest) ? '✓ đã cài' : '✗ chưa cài'}`);
      break;
    }
    const global = path.join(skillBase(false), SKILL_NAME);
    const project = path.join(skillBase(true), SKILL_NAME);
    console.log(`
${host.label}

Toàn máy: ${global}
          ${existsSync(global) ? '✓ đã cài' : '✗ chưa cài'}

Dự án:    ${project}
          ${existsSync(project) ? '✓ đã cài' : '✗ chưa cài'}
`);
    warnLegacyCodexInstall();
    break;
  }

  default:
    console.error(`Lệnh không hợp lệ: ${command}\n${HELP}`);
    process.exit(1);
}

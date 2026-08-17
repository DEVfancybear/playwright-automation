#!/usr/bin/env node
/**
 * Trình cài đặt skill playwright-automation.
 *
 * Copy nội dung skill vào nơi agent host tìm skill:
 *   - Claude: ~/.claude/skills hoặc .claude/skills
 *   - Codex:  ~/.agents/skills hoặc .agents/skills
 */

import { parseArgs } from 'node:util';
import { cpSync, existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'playwright-automation';

// Chỉ những thứ agent cần khi nạp skill. docs/ và README dành cho người đọc trên GitHub,
// đưa vào thư mục skill chỉ làm rác.
const SKILL_CONTENT = ['SKILL.md', 'agents', 'references', 'scripts', 'assets', 'LICENSE'];

const HOSTS = {
  claude: {
    label: 'Claude Code',
    userDir: ['.claude', 'skills'],
    projectDir: ['.claude', 'skills'],
  },
  codex: {
    label: 'Codex',
    userDir: ['.agents', 'skills'],
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
  --codex          Cài cho Codex: ~/.agents/skills/ hoặc .agents/skills/ với --project
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

const hostKey = args.codex ? 'codex' : 'claude';
const host = HOSTS[hostKey];

function skillBase(projectScoped = args.project) {
  const parts = projectScoped ? host.projectDir : host.userDir;
  return path.join(projectScoped ? process.cwd() : homedir(), ...parts);
}

function targetDir() {
  if (args.dir) return path.resolve(args.dir);
  return path.join(skillBase(), SKILL_NAME);
}

function version() {
  try {
    return JSON.parse(readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
  } catch {
    return '?';
  }
}

const dest = targetDir();

switch (command) {
  case 'install': {
    if (existsSync(dest) && !args.force) {
      console.error(
        `Skill đã có sẵn tại:\n  ${dest}\n\n` +
        `Dùng --force để ghi đè, hoặc gỡ trước bằng: npx @duong.dev/playwright-automation uninstall`
      );
      process.exit(1);
    }

    // Ghi đè sạch: cpSync chỉ merge, sẽ để lại file của bản cũ đã bị gỡ ở bản mới
    // (ví dụ reference bị đổi tên) → thư mục lai, SKILL.md mới trỏ vào file cũ.
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true });
      console.log(`Đã xoá bản cũ tại: ${dest}`);
    }

    mkdirSync(dest, { recursive: true });
    const copied = [];
    for (const item of SKILL_CONTENT) {
      const src = path.join(PKG_ROOT, item);
      if (!existsSync(src)) continue;
      cpSync(src, path.join(dest, item), { recursive: true });
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
  Phạm vi: ${args.dir ? 'thư mục tự chọn'
             : args.project ? `dự án này (commit ${host.projectDir.join('/')}/ để cả team dùng)`
             : 'toàn máy, mọi dự án'}

BƯỚC TIẾP THEO
  1. ${hostKey === 'codex'
    ? 'Gõ /skills hoặc nhắc $playwright-automation; nếu chưa xuất hiện, khởi động lại Codex.'
    : 'Khởi động lại Claude Code nếu skill chưa xuất hiện.'}
  2. Thử một yêu cầu thật, ví dụ:
       "Test giúp tôi chức năng đăng nhập ở https://staging.example.com"

  Để chạy được test, cần Node ≥ 18 và Playwright trong thư mục dự án:
       npm i -D @playwright/test && npx playwright install --with-deps chromium
`);
    break;
  }

  case 'uninstall': {
    if (!existsSync(dest)) {
      console.log(`Không có skill nào ở:\n  ${dest}`);
      process.exit(0);
    }
    rmSync(dest, { recursive: true, force: true });
    console.log(`✓ Đã gỡ skill khỏi:\n  ${dest}`);
    break;
  }

  case 'where': {
    if (args.dir) {
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
    break;
  }

  default:
    console.error(`Lệnh không hợp lệ: ${command}\n${HELP}`);
    process.exit(1);
}

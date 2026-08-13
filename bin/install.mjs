#!/usr/bin/env node
/**
 * Trình cài đặt skill playwright-automation.
 *
 * Copy nội dung skill vào nơi Claude tìm skill:
 *   - mặc định: ~/.claude/skills/playwright-automation  (dùng cho mọi dự án)
 *   - --project: .claude/skills/playwright-automation   (chia sẻ cho cả team)
 */

import { parseArgs } from 'node:util';
import { cpSync, existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'playwright-automation';

// Chỉ những thứ Claude cần khi nạp skill. docs/ và README dành cho người đọc trên GitHub,
// đưa vào thư mục skill chỉ làm rác.
const SKILL_CONTENT = ['SKILL.md', 'references', 'scripts', 'assets', 'LICENSE'];

const HELP = `
playwright-automation — skill automation testing Playwright + TypeScript cho tester

CÁCH DÙNG
  npx @duong.dev/playwright-automation install [tuỳ chọn]     Cài skill
  npx @duong.dev/playwright-automation uninstall [tuỳ chọn]   Gỡ skill
  npx @duong.dev/playwright-automation where                  In ra nơi skill đang được cài

TUỲ CHỌN
  --project        Cài vào .claude/skills/ của dự án hiện tại (commit được, cả team dùng chung)
                   thay vì ~/.claude/skills/ (chỉ mình bạn, dùng ở mọi dự án)
  --dir <đường dẫn>  Cài vào thư mục tự chọn
  --force          Ghi đè bản đã cài
  --help

VÍ DỤ
  npx @duong.dev/playwright-automation install
  npx @duong.dev/playwright-automation install --project
  npx @duong.dev/playwright-automation install --force
  npx @duong.dev/playwright-automation uninstall

SAU KHI CÀI
  Khởi động lại Claude Code, rồi thử:
    "Dựng giúp tôi khung automation test Playwright cho https://example.com"
`;

let args, positionals;
try {
  ({ values: args, positionals } = parseArgs({
    options: {
      project: { type: 'boolean', default: false },
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
  process.exit(command ? 0 : 1);
}

function targetDir() {
  if (args.dir) return path.resolve(args.dir);
  const base = args.project
    ? path.join(process.cwd(), '.claude', 'skills')
    : path.join(homedir(), '.claude', 'skills');
  return path.join(base, SKILL_NAME);
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

  Vị trí: ${dest}
  Nội dung: ${copied.join(', ')}
  Phạm vi: ${args.dir ? 'thư mục tự chọn'
             : args.project ? 'dự án này (commit .claude/skills/ để cả team dùng)'
             : 'toàn máy, mọi dự án'}

BƯỚC TIẾP THEO
  1. Khởi động lại Claude Code để nó quét lại danh sách skill.
  2. Thử một yêu cầu thật, ví dụ:
       "Test giúp tôi chức năng đăng nhập ở https://staging.congty.vn"

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
    const global = path.join(homedir(), '.claude', 'skills', SKILL_NAME);
    const project = path.join(process.cwd(), '.claude', 'skills', SKILL_NAME);
    console.log(`
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

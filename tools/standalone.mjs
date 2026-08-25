#!/usr/bin/env node
/**
 * Entrypoint cho tester clone repository rồi chạy trực tiếp trong terminal.
 *
 * Script chỉ bootstrap toolchain bên trong repository này. Nó không cài Agent
 * Skill vào Codex/Claude, không tạo project con và không nhận credential trên
 * command line.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRE = createRequire(path.join(ROOT, 'package.json'));
const MIN_NODE_MAJOR = 20;
const FULL_TEST_FILES = [
  'tests/installer.test.mjs',
  'tests/auth-login.integration.test.mjs',
  'tests/mcp-auth-bridge.integration.test.mjs',
  'tests/standalone.integration.test.mjs',
  'tests/skill-contract.test.mjs',
];

const HELP = `
playwright-automation — chạy độc lập ngay trong repository đã clone

CÁCH DÙNG
  npm run test:standalone                 Smoke nhanh bằng Chromium + fixture local
  npm test                                Toàn bộ regression suite của skill
  npm run test:standalone:full            Bí danh tường minh của npm test
  npm run test:url -- --url <url>         Mở URL thật và lưu evidence/locator

VÍ DỤ
  npm run test:url -- --url https://playwright.dev
  npm run test:url -- --url https://staging.example.com --headed --out ./recon/staging

LẦN CHẠY ĐẦU
  Lệnh tự chạy npm ci từ package-lock.json khi thiếu dependency và chỉ tải
  Chromium khi máy chưa có browser đúng phiên bản. Không cần import skill vào
  project khác, cũng không cần cài skill vào Codex hay Claude.
`;

export function nodeMajor(version = process.versions.node) {
  return Number.parseInt(version.split('.')[0], 10);
}

export function parseInvocation(argv) {
  const [mode = 'self-test', ...rest] = argv;
  if (mode === '--help' || mode === '-h' || mode === 'help') {
    return { mode: 'help', rest: [] };
  }
  if (!['self-test', 'suite', 'url'].includes(mode)) {
    throw new Error(`Lệnh không hợp lệ: ${mode}`);
  }
  if (['self-test', 'suite'].includes(mode)) {
    const unknown = rest.filter(arg => !['--help', '-h'].includes(arg));
    if (unknown.length) throw new Error(`Tham số ${mode} không hợp lệ: ${unknown.join(', ')}`);
  }
  return { mode, rest };
}

function run(label, command, args, options = {}) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
    windowsHide: true,
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture
      ? `\n${result.stdout || ''}${result.stderr || ''}`
      : '';
    throw new Error(`${label} thất bại (exit ${result.status})${detail}`);
  }
  return result;
}

function npmInvocation(args) {
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  }
  if (process.platform === 'win32') {
    return { command: process.env.ComSpec, args: ['/d', '/s', '/c', 'npm.cmd', ...args] };
  }
  return { command: 'npm', args };
}

function runNpm(label, args) {
  const invocation = npmInvocation(args);
  run(label, invocation.command, invocation.args);
}

function playwrightIsInstalled() {
  try {
    REQUIRE.resolve('@playwright/test');
    return true;
  } catch {
    return false;
  }
}

function optionValue(args, name) {
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasOption(args, name) {
  return args.some(arg => arg === name || arg.startsWith(`${name}=`));
}

async function bootstrap(browserName = 'chromium') {
  const major = nodeMajor();
  if (!Number.isInteger(major) || major < MIN_NODE_MAJOR) {
    throw new Error(`Cần Node.js >= ${MIN_NODE_MAJOR}; máy đang dùng ${process.versions.node}.`);
  }
  console.log(`✓ Node.js ${process.versions.node}`);

  if (!playwrightIsInstalled()) {
    const lockfile = path.join(ROOT, 'package-lock.json');
    if (!existsSync(lockfile)) {
      throw new Error('Thiếu package-lock.json; clone có thể chưa đầy đủ nên không thể bootstrap tái lập.');
    }
    runNpm('Cài dependency khóa phiên bản bằng npm ci', [
      'ci',
      '--ignore-scripts',
      '--include=dev',
      '--no-audit',
      '--no-fund',
    ]);
  } else {
    console.log('✓ Dependency Playwright đã có');
  }

  if (!playwrightIsInstalled()) {
    throw new Error('npm ci đã hoàn tất nhưng vẫn không nạp được @playwright/test.');
  }

  const playwright = await import('@playwright/test');
  const browserType = playwright[browserName];
  if (!['chromium', 'firefox', 'webkit'].includes(browserName) || !browserType) {
    throw new Error(`Browser không hợp lệ: ${browserName}. Chọn chromium | firefox | webkit.`);
  }
  const executable = browserType.executablePath();
  if (!existsSync(executable)) {
    const cli = REQUIRE.resolve('@playwright/test/cli');
    const installArgs = [cli, 'install'];
    if (process.platform === 'linux') installArgs.push('--with-deps');
    installArgs.push(browserName);
    run(`Cài ${browserName} cho Playwright`, process.execPath, installArgs);
  } else {
    console.log(`✓ ${browserName} đã có: ${executable}`);
  }
}

async function main(argv = process.argv.slice(2)) {
  let invocation;
  try {
    invocation = parseInvocation(argv);
  } catch (error) {
    console.error(`${error.message}\n${HELP}`);
    process.exitCode = 1;
    return;
  }

  if (invocation.mode === 'help') {
    console.log(HELP);
    return;
  }

  if (invocation.rest.includes('--help') || invocation.rest.includes('-h')) {
    if (invocation.mode === 'url') {
      run('Hướng dẫn test URL', process.execPath, [path.join(ROOT, 'scripts', 'explore.mjs'), '--help']);
    } else {
      console.log(HELP);
    }
    return;
  }

  if (invocation.mode === 'url' && !hasOption(invocation.rest, '--url')) {
    console.error(`Thiếu --url.\n${HELP}`);
    process.exitCode = 1;
    return;
  }

  try {
    const browserName = invocation.mode === 'url'
      ? optionValue(invocation.rest, '--browser') || 'chromium'
      : 'chromium';
    await bootstrap(browserName);

    if (invocation.mode === 'url') {
      run('Test URL độc lập', process.execPath, [
        path.join(ROOT, 'scripts', 'explore.mjs'),
        ...invocation.rest,
      ]);
      console.log('\nTERMINAL_TEST_OK — evidence đã được lưu; không cần project Playwright bên ngoài.');
      return;
    }

    if (invocation.mode === 'suite') {
      run('Toàn bộ regression suite', process.execPath, [
        '--test',
        '--test-concurrency=1',
        ...FULL_TEST_FILES,
      ]);
      console.log('\nSTANDALONE_FULL_OK');
      return;
    }

    run('Standalone smoke suite', process.execPath, [
      '--test',
      '--test-concurrency=1',
      'tests/standalone.integration.test.mjs',
      'tests/skill-contract.test.mjs',
    ]);
    console.log('\nSTANDALONE_OK');
  } catch (error) {
    console.error(`\nSTANDALONE_FAIL: ${error.message}`);
    if (process.platform === 'linux') {
      console.error('Nếu browser thiếu thư viện hệ thống, chạy lại với quyền cài package hệ điều hành phù hợp.');
    }
    process.exitCode = 1;
  }
}

await main();

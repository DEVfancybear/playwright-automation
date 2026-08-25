#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readDotEnvFile } from './mcp-auth-init.mjs';
import {
  ensureCredentialEnvFile,
  resolveCredentialEnvPath,
  resolveTlsPolicy,
} from './runtime-safety.mjs';

export const PLAYWRIGHT_MCP_PACKAGE = '@playwright/mcp@0.0.79';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INIT_PAGE = path.join(ROOT, 'scripts', 'mcp-auth-init.cjs');
const RESERVED_MCP_FLAGS = [
  '--allow-unrestricted-file-access',
  '--cdp-endpoint',
  '--config',
  '--endpoint',
  '--extension',
  '--host',
  '--init-page',
  '--init-script',
  '--ignore-https-errors',
  '--port',
  '--secrets',
];

const HELP = `
mcp-auth-bridge — local Playwright MCP login bridge

CÁCH DÙNG
  node scripts/mcp-auth-bridge.mjs --env <file> --login-url <exact-url> [tuỳ chọn]

BẮT BUỘC
  --env <file>                 File dotenv được MCP local đọc; mặc định ./.env
  --login-url <exact-url>      URL được phép điền credential; lặp lại cho OTP/SSO URL

CREDENTIAL — chỉ truyền tên biến
  --user-env <TÊN>             Mặc định TEST_USER
  --pass-env <TÊN>             Mặc định TEST_PASS
  --totp-env <TÊN>             Mặc định TEST_TOTP_SECRET

FORM TUỲ CHỌN
  --user-selector <css>
  --next-selector <css>
  --pass-selector <css>
  --submit-selector <css>
  --otp-selector <css>
  --select-selector <css>      Dropdown role/tenant
  --select-value <value|label> Giá trị hoặc label không bí mật
  --timeout <ms>               Mặc định 30000

MCP
  --ignore-https-errors        Bỏ qua TLS lỗi trong MCP browser context
  --confirm-non-production     Cổng bắt buộc; chỉ dùng cho local/dev/QA/staging/UAT
  --dry-run                    In command đã che secret, không start MCP
  -- <args>                    Chuyển args không dành riêng cho bridge sang MCP

Bridge pin ${PLAYWRIGHT_MCP_PACKAGE}, bật --extension, --init-page và --secrets.
Playwright Extension phải được cài trong Chrome/Edge. Không truyền giá trị secret
trên dòng lệnh; bridge chỉ đọc chúng trong process MCP local.
`;

export function parseBridgeArgs(argv = process.argv.slice(2)) {
  const separator = argv.indexOf('--');
  const bridgeArgs = separator === -1 ? argv : argv.slice(0, separator);
  const mcpArgs = separator === -1 ? [] : argv.slice(separator + 1);
  const result = {
    envFile: path.resolve('.env'),
    loginUrls: [],
    userEnv: 'TEST_USER',
    passEnv: 'TEST_PASS',
    totpEnv: 'TEST_TOTP_SECRET',
    timeout: 30_000,
    dryRun: false,
    ignoreHttpsErrors: false,
    confirmedNonProduction: false,
    help: false,
    mcpArgs,
  };

  for (let index = 0; index < bridgeArgs.length; index += 1) {
    const flag = bridgeArgs[index];
    if (flag === '--help' || flag === '-h') {
      result.help = true;
      continue;
    }
    if (flag === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (flag === '--ignore-https-errors') {
      result.ignoreHttpsErrors = true;
      continue;
    }
    if (flag === '--confirm-non-production') {
      result.confirmedNonProduction = true;
      continue;
    }
    const value = bridgeArgs[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} cần một giá trị.`);
    index += 1;
    switch (flag) {
      case '--env': result.envFile = path.resolve(value); break;
      case '--login-url': result.loginUrls.push(value); break;
      case '--user-env': result.userEnv = variableName(value, flag); break;
      case '--pass-env': result.passEnv = variableName(value, flag); break;
      case '--totp-env': result.totpEnv = variableName(value, flag); break;
      case '--user-selector': result.userSelector = value; break;
      case '--next-selector': result.nextSelector = value; break;
      case '--pass-selector': result.passSelector = value; break;
      case '--submit-selector': result.submitSelector = value; break;
      case '--otp-selector': result.otpSelector = value; break;
      case '--select-selector': result.selectSelector = value; break;
      case '--select-value': result.selectValue = value; break;
      case '--timeout': {
        const timeout = Number(value);
        if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('--timeout phải là số dương.');
        result.timeout = timeout;
        break;
      }
      default: throw new Error(`Tuỳ chọn bridge không hỗ trợ: ${flag}`);
    }
  }

  for (const arg of mcpArgs) {
    if (RESERVED_MCP_FLAGS.some(flag => arg === flag || arg.startsWith(`${flag}=`))) {
      throw new Error(`Không được override cờ MCP do bridge quản lý: ${arg}`);
    }
  }
  return result;
}

export function buildMcpLaunch(options, inheritedEnv = process.env) {
  const enabledNodeDebug = ['NODE_DEBUG', 'NODE_DEBUG_NATIVE'].filter(key => inheritedEnv[key]?.trim());
  if (enabledNodeDebug.length) {
    throw new Error('Hãy unset NODE_DEBUG/NODE_DEBUG_NATIVE; debug child process có thể làm lộ credential.');
  }
  if (!options.loginUrls.length) throw new Error('Cần ít nhất một --login-url exact.');
  const loginUrls = options.loginUrls.map(validateLoginUrl);
  const tlsPolicy = resolveTlsPolicy({
    url: loginUrls[0],
    ignoreHttpsErrors: options.ignoreHttpsErrors,
    confirmedNonProduction: options.confirmedNonProduction,
  });
  if (tlsPolicy.ignoreHTTPSErrors) {
    const origins = new Set(loginUrls.map(value => new URL(value).origin));
    if (origins.size !== 1) {
      throw new Error('Khi bỏ qua TLS, mọi exact login URL phải thuộc cùng một non-production origin.');
    }
  }
  if (Boolean(options.selectSelector) !== Boolean(options.selectValue)) {
    throw new Error('Cần truyền cùng lúc --select-selector và --select-value.');
  }

  const envFile = resolveCredentialEnvPath(options.envFile);
  const envSetup = ensureCredentialEnvFile(envFile, {
    userEnv: options.userEnv,
    passEnv: options.passEnv,
    totpEnv: options.totpEnv,
  });
  const dotenv = readDotEnvFile(envFile);
  const missing = [options.userEnv, options.passEnv].filter(key => !dotenv[key]);
  if (missing.length) {
    const created = envSetup.created ? `Đã tự tạo file credential riêng ${envFile}. ` : '';
    throw new Error(
      `${created}Thiếu credential trong file env: ${missing.join(', ')}. ` +
      'Tester điền file local này; không gửi giá trị qua chat.',
    );
  }

  const childEnv = { ...inheritedEnv };
  for (const key of ['DEBUG', 'DEBUG_FILE', 'PWDEBUG', 'PWDEBUGIMPL', 'NODE_DEBUG', 'NODE_DEBUG_NATIVE']) {
    delete childEnv[key];
  }
  Object.assign(childEnv, {
    PW_AUTH_BRIDGE_ENV_FILE: envFile,
    PW_AUTH_BRIDGE_LOGIN_URLS: JSON.stringify(loginUrls),
    PW_AUTH_BRIDGE_USER_ENV: options.userEnv,
    PW_AUTH_BRIDGE_PASS_ENV: options.passEnv,
    PW_AUTH_BRIDGE_TOTP_ENV: options.totpEnv,
    PW_AUTH_BRIDGE_TIMEOUT: String(options.timeout),
  });
  setOptional(childEnv, 'PW_AUTH_BRIDGE_USER_SELECTOR', options.userSelector);
  setOptional(childEnv, 'PW_AUTH_BRIDGE_NEXT_SELECTOR', options.nextSelector);
  setOptional(childEnv, 'PW_AUTH_BRIDGE_PASS_SELECTOR', options.passSelector);
  setOptional(childEnv, 'PW_AUTH_BRIDGE_SUBMIT_SELECTOR', options.submitSelector);
  setOptional(childEnv, 'PW_AUTH_BRIDGE_OTP_SELECTOR', options.otpSelector);
  setOptional(childEnv, 'PW_AUTH_BRIDGE_SELECT_SELECTOR', options.selectSelector);
  setOptional(childEnv, 'PW_AUTH_BRIDGE_SELECT_VALUE', options.selectValue);

  const npmCli = resolveNpmCli(inheritedEnv);
  const args = [
    npmCli,
    'exec',
    '--yes',
    `--package=${PLAYWRIGHT_MCP_PACKAGE}`,
    '--',
    'playwright-mcp',
    '--extension',
    ...(tlsPolicy.ignoreHTTPSErrors ? ['--ignore-https-errors'] : []),
    '--init-page', INIT_PAGE,
    '--secrets', envFile,
    ...options.mcpArgs,
  ];
  return {
    command: process.execPath,
    args,
    env: childEnv,
    summary: {
      command: process.execPath,
      args,
      credentialVariables: [options.userEnv, options.passEnv, options.totpEnv],
      exactLoginUrls: loginUrls,
      tlsValidation: tlsPolicy.ignoreHTTPSErrors
        ? `bypassed for confirmed non-production origin ${tlsPolicy.origin}`
        : 'enforced',
      secretValues: '[loaded only inside local MCP process]',
    },
  };
}

async function main() {
  try {
    const options = parseBridgeArgs();
    if (options.help) {
      process.stdout.write(HELP);
      return;
    }
    const launch = buildMcpLaunch(options);
    if (options.dryRun) {
      process.stdout.write(`${JSON.stringify(launch.summary, null, 2)}\n`);
      return;
    }

    const child = spawn(launch.command, launch.args, {
      cwd: process.cwd(),
      env: launch.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    const forward = signal => {
      if (!child.killed) child.kill(signal);
    };
    process.once('SIGINT', forward);
    process.once('SIGTERM', forward);
    child.once('error', error => {
      console.error(`Không start được Playwright MCP bridge: ${error.message}`);
      process.exitCode = 1;
    });
    child.once('exit', (code, signal) => {
      if (signal) process.kill(process.pid, signal);
      else process.exitCode = code ?? 1;
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function validateLoginUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Login URL không hợp lệ: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Login URL phải dùng http/https và không chứa userinfo.');
  }
  return url.href;
}

function variableName(value, flag) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`${flag} phải là tên biến môi trường.`);
  return value;
}

function resolveNpmCli(env) {
  const candidates = [
    env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  const found = candidates.find(candidate => existsSync(candidate));
  if (!found) throw new Error('Không tìm thấy npm-cli.js cạnh Node; hãy cài npm cùng Node.js.');
  return path.resolve(found);
}

function setOptional(env, key, value) {
  if (value !== undefined) env[key] = value;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) await main();

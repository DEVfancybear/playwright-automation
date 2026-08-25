#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';

import { ensureCredentialEnvFile } from './runtime-safety.mjs';

const HELP = `
auth-env.mjs — tạo file credential local an toàn, không chứa secret mẫu

CÁCH DÙNG
  node scripts/auth-env.mjs [--env .env] [--user-env TEST_USER] [--pass-env TEST_PASS]

Script chỉ tạo skeleton nếu file chưa tồn tại. File hiện có không bao giờ bị đọc
hoặc overwrite. Đường dẫn template/example/fixture bị từ chối.
`;

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      env: { type: 'string', default: '.env' },
      'user-env': { type: 'string', default: 'TEST_USER' },
      'pass-env': { type: 'string', default: 'TEST_PASS' },
      'totp-env': { type: 'string', default: 'TEST_TOTP_SECRET' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  }));
} catch (error) {
  console.error(`${error.message}\n${HELP}`);
  process.exit(1);
}

if (args.help) {
  console.log(HELP);
  process.exit(0);
}

try {
  const result = ensureCredentialEnvFile(args.env, {
    userEnv: args['user-env'],
    passEnv: args['pass-env'],
    totpEnv: args['totp-env'],
  });
  const display = path.relative(process.cwd(), result.path) || result.path;
  if (result.created) {
    console.log(`✓ Đã tạo file credential riêng: ${display}`);
    console.log('  Tester chỉ cần điền các giá trị còn trống; không gửi chúng qua chat.');
  } else {
    console.log(`✓ File credential riêng đã tồn tại: ${display} (không đọc/không overwrite)`);
  }
} catch (error) {
  console.error(`Không tạo được file credential: ${error.message}`);
  process.exit(1);
}

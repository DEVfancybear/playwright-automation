import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SAMPLE_DIRECTORY_NAMES = new Set([
  'example',
  'examples',
  'fixture',
  'fixtures',
  'sample',
  'samples',
  'template',
  'templates',
  'testdata',
  'test-data',
]);

const SAMPLE_FILE_PATTERN = /(?:^|[._-])(?:example|sample|template)(?:[._-]|$)/i;

/**
 * Reject dotenv files that are documentation/test material rather than a real
 * local secret source. The helper may read the returned path; the Agent must not.
 */
export function resolveCredentialEnvPath(file, cwd = process.cwd()) {
  const base = path.resolve(cwd);
  const resolved = path.resolve(base, file || '.env');
  const basename = path.basename(resolved).toLowerCase();
  const relative = path.relative(base, resolved);
  const insideBase = relative === '' || (
    !path.isAbsolute(relative)
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
  );
  // Ignore names in cwd's parent chain (the clone itself may live below a
  // directory called "examples"). For an explicitly external file, inspect
  // its full path because cwd can no longer define the trusted project root.
  const scoped = insideBase ? relative : resolved;
  const directories = path.dirname(scoped)
    .slice(path.parse(scoped).root.length)
    .split(path.sep)
    .filter(segment => segment && segment !== '.')
    .map(segment => segment.toLowerCase());

  const sampleDirectory = directories.find(segment => SAMPLE_DIRECTORY_NAMES.has(segment));
  const assetsTemplate = directories.some((segment, index) => (
    segment === 'assets' && SAMPLE_DIRECTORY_NAMES.has(directories[index + 1])
  ));
  if (sampleDirectory || assetsTemplate || SAMPLE_FILE_PATTERN.test(basename)) {
    throw new Error(
      `Từ chối dùng file credential mẫu/template: ${resolved}. ` +
      'Hãy dùng .env riêng ở root dự án hoặc một secret file do tester chỉ định.',
    );
  }
  return resolved;
}

export function credentialEnvTemplate({
  userEnv = 'TEST_USER',
  passEnv = 'TEST_PASS',
  totpEnv = 'TEST_TOTP_SECRET',
} = {}) {
  return [
    '# Credential thật chỉ nằm trong file local này.',
    '# File đã được .gitignore; không commit và không gửi giá trị qua chat.',
    '# Agent không đọc nội dung; auth helper đọc trực tiếp trong process riêng.',
    '',
    `${userEnv}=`,
    `${passEnv}=`,
    '',
    '# Bỏ trống nếu tài khoản test không dùng TOTP.',
    `${totpEnv}=`,
    '',
  ].join('\n');
}

/** Create a private skeleton once. Existing files are never read or overwritten. */
export function ensureCredentialEnvFile(file, options = {}) {
  const resolved = resolveCredentialEnvPath(file, options.cwd);
  if (existsSync(resolved)) return { path: resolved, created: false };
  mkdirSync(path.dirname(resolved), { recursive: true });
  try {
    writeFileSync(resolved, credentialEnvTemplate(options), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    return { path: resolved, created: true };
  } catch (error) {
    if (error?.code === 'EEXIST') return { path: resolved, created: false };
    throw error;
  }
}

/**
 * TLS validation can only be disabled when the caller explicitly records that
 * the exact target is non-production. This is deliberately not hostname inference.
 */
export function resolveTlsPolicy({
  url,
  ignoreHttpsErrors = false,
  confirmedNonProduction = false,
} = {}) {
  if (!ignoreHttpsErrors) {
    return { ignoreHTTPSErrors: false, confirmedNonProduction: false, origin: null };
  }
  if (!confirmedNonProduction) {
    throw new Error(
      '--ignore-https-errors chỉ được dùng cùng --confirm-non-production ' +
      'sau khi Agent đã xác minh target là local/dev/QA/staging/UAT.',
    );
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Không thể bật bỏ qua TLS vì URL target không hợp lệ.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Bỏ qua TLS chỉ áp dụng cho HTTPS URL không chứa userinfo.');
  }
  return {
    ignoreHTTPSErrors: true,
    confirmedNonProduction: true,
    origin: parsed.origin,
  };
}

export function assertCredentialSubmissionOrigin(currentUrl, approvedOrigin) {
  if (!approvedOrigin) return;
  let current;
  try {
    current = new URL(currentUrl);
  } catch {
    throw new Error('Không xác định được origin trước khi điền credential.');
  }
  if (current.origin !== approvedOrigin) {
    throw new Error(
      `TLS đang được bỏ qua cho ${approvedOrigin}, nhưng trang đăng nhập đã chuyển sang ` +
      `${current.origin}. Từ chối điền credential trên origin khác.`,
    );
  }
}

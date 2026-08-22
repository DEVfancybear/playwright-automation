#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'scripts', 'auth-login.mjs');
const AUTH_TEST = path.join(ROOT, 'tests', 'auth-login.integration.test.mjs');
const original = readFileSync(SOURCE, 'utf8');
const probeRoot = mkdtempSync(path.join(tmpdir(), 'pw-auth-mutants-'));

assert.equal(
  hasIntendedTapFailure('ok 1 - intended test\nnot ok 2 - unrelated test\n', 'intended test'),
  false,
  'mutation gate must reject an unrelated failing TAP entry',
);
assert.equal(
  hasIntendedTapFailure('not ok 1 - intended test\n', 'intended test'),
  true,
  'mutation gate must accept the intended failing TAP entry',
);

const mutants = [
  {
    id: 'session-surface-no-wait',
    from: 'const challenge = await findAuthChallenge(page, Math.min(TIMEOUT, 2_500));',
    to: 'const challenge = await findAuthChallenge(page, 0);',
    expectedTest: 'refreshes a stale session when the SPA login form renders late',
  },
  {
    id: 'generic-code-is-otp',
    from: '  \'input[id*="auth" i][id*="code" i]:visible\',\n].join(\', \');',
    to: '  \'input[id*="auth" i][id*="code" i]:visible\',\n  \'input[name*="code" i]:visible\',\n].join(\', \');',
    expectedTest: 'does not classify a dashboard promoCode input as OTP',
  },
  {
    id: 'custom-password-no-wait',
    from: 'passField = await findPassField(TIMEOUT);',
    to: 'passField = await findPassField(0);',
    expectedTest: 'waits for custom password selector in a delayed two-step form',
  },
  {
    id: 'otp-surface-no-wait',
    from: 'const otpWait = successAlreadyVisible ? 0 : Math.min(TIMEOUT, 5_000);',
    to: 'const otpWait = 0;',
    expectedTest: 'waits for delayed TOTP and saves only the final authenticated state',
  },
  {
    id: 'playwright-error-redaction-bypassed',
    from: 'console.error(`\\n✗ Đăng nhập thất bại: ${redactSensitive(e.message)}`);',
    to: 'console.error(`\\n✗ Đăng nhập thất bại: ${e.message}`);',
    expectedTest: 'redacts credential values from Playwright fill errors',
  },
];

try {
  let killed = 0;
  for (const mutant of mutants) {
    const occurrences = original.split(mutant.from).length - 1;
    assert.equal(occurrences, 1, `${mutant.id}: replacement anchor count must be exactly 1, got ${occurrences}`);

    const marker = `pw-${mutant.id}`;
    const changed = original.replace(mutant.from, mutant.to).replace(
      '#!/usr/bin/env node\n',
      `#!/usr/bin/env node\nconsole.error('AUTH_MUTANT_EXECUTED:${marker}');\n`,
    );
    assert.notEqual(changed, original, `${mutant.id}: mutant was not applied`);

    const mutantPath = path.join(probeRoot, `${mutant.id}.mjs`);
    writeFileSync(mutantPath, changed);

    const result = spawnSync(process.execPath, [
      '--test',
      '--test-concurrency=1',
      '--test-reporter=tap',
      '--test-name-pattern', `^${escapeRegExp(mutant.expectedTest)}$`,
      AUTH_TEST,
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        AUTH_SCRIPT_UNDER_TEST: mutantPath,
        AUTH_EXPECT_MUTANT_MARKER: marker,
      },
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true,
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;

    if (result.error) throw new Error(`${mutant.id}: test process failed: ${result.error.message}`);
    if (result.signal) throw new Error(`${mutant.id}: test process ended by ${result.signal}`);
    if (!output.includes(`[mutant-executed:${marker}]`)) {
      throw new Error(`${mutant.id}: execution marker missing; refusing a fail-open kill`);
    }
    if (/cancelled [1-9]/i.test(output)) {
      throw new Error(`${mutant.id}: test cancellation is not a valid mutation kill\n${output}`);
    }
    if (result.status === 0) {
      throw new Error(`${mutant.id}: SURVIVED\n${output}`);
    }
    if (!hasIntendedTapFailure(output, mutant.expectedTest)) {
      throw new Error(`${mutant.id}: intended test was not the failing TAP entry\n${output}`);
    }

    killed += 1;
    console.log(`KILLED ${mutant.id}`);
  }

  console.log(`manual mutation: ${killed}/${mutants.length} killed`);
} finally {
  const resolvedProbe = path.resolve(probeRoot);
  const resolvedTemp = path.resolve(tmpdir());
  assert.ok(resolvedProbe.startsWith(resolvedTemp + path.sep), `unsafe mutation cleanup target: ${resolvedProbe}`);
  rmSync(resolvedProbe, { recursive: true, force: true });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasIntendedTapFailure(output, testName) {
  return new RegExp(`^not ok \\d+ - ${escapeRegExp(testName)}$`, 'm').test(output);
}

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertCredentialSubmissionOrigin,
  ensureCredentialEnvFile,
  resolveCredentialEnvPath,
  resolveTlsPolicy,
} from '../scripts/runtime-safety.mjs';

test('creates a private root dotenv skeleton once without overwriting it', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pw-runtime-safety-'));
  const envFile = path.join(directory, '.env');
  try {
    const created = ensureCredentialEnvFile(envFile);
    assert.equal(created.created, true);
    assert.match(readFileSync(envFile, 'utf8'), /^TEST_USER=$/m);
    assert.match(readFileSync(envFile, 'utf8'), /^TEST_PASS=$/m);

    writeFileSync(envFile, 'TEST_USER=opaque-existing-value\n', 'utf8');
    const reused = ensureCredentialEnvFile(envFile);
    assert.equal(reused.created, false);
    assert.equal(readFileSync(envFile, 'utf8'), 'TEST_USER=opaque-existing-value\n');
  } finally {
    cleanup(directory);
  }
});

test('rejects template, example, fixture, and sample dotenv sources', () => {
  const root = path.join(tmpdir(), 'pw-safe-source-project');
  const unsafe = [
    path.join(root, 'assets', 'template', '.env'),
    path.join(root, 'examples', '.env'),
    path.join(root, 'fixtures', 'admin.env'),
    path.join(root, '.env.sample'),
    path.join(root, '.env.example'),
  ];
  for (const candidate of unsafe) {
    assert.throws(() => resolveCredentialEnvPath(candidate, root), /mẫu\/template/i, candidate);
  }
  assert.equal(resolveCredentialEnvPath('.env', root), path.resolve(root, '.env'));
  const cloneBelowExamples = path.join(tmpdir(), 'examples', 'real-project');
  assert.equal(
    resolveCredentialEnvPath('.env', cloneBelowExamples),
    path.resolve(cloneBelowExamples, '.env'),
    'parent directories outside the project root must not classify the root dotenv as a sample',
  );
});

test('TLS bypass requires an explicit non-production confirmation and HTTPS', () => {
  assert.throws(() => resolveTlsPolicy({
    url: 'https://staging.example.test/login',
    ignoreHttpsErrors: true,
  }), /confirm-non-production/);
  assert.throws(() => resolveTlsPolicy({
    url: 'http://staging.example.test/login',
    ignoreHttpsErrors: true,
    confirmedNonProduction: true,
  }), /HTTPS/);

  const policy = resolveTlsPolicy({
    url: 'https://staging.example.test/login',
    ignoreHttpsErrors: true,
    confirmedNonProduction: true,
  });
  assert.deepEqual(policy, {
    ignoreHTTPSErrors: true,
    confirmedNonProduction: true,
    origin: 'https://staging.example.test',
  });
});

test('TLS bypass refuses credential submission after a cross-origin redirect', () => {
  assert.doesNotThrow(() => assertCredentialSubmissionOrigin(
    'https://staging.example.test/admin/login?step=password',
    'https://staging.example.test',
  ));
  assert.throws(() => assertCredentialSubmissionOrigin(
    'https://login.example.test/password',
    'https://staging.example.test',
  ), /Từ chối điền credential trên origin khác/);
});

function cleanup(directory) {
  const resolved = path.resolve(directory);
  const tempRoot = path.resolve(tmpdir());
  assert.ok(resolved.startsWith(tempRoot + path.sep), `unsafe temp cleanup target: ${resolved}`);
  rmSync(resolved, { recursive: true, force: true });
}

#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INIT_SOURCE = path.join(ROOT, 'scripts', 'mcp-auth-init.mjs');
const WRAPPER_SOURCE = path.join(ROOT, 'scripts', 'mcp-auth-bridge.mjs');
const BRIDGE_TEST = path.join(ROOT, 'tests', 'mcp-auth-bridge.integration.test.mjs');
const originals = {
  init: readFileSync(INIT_SOURCE, 'utf8'),
  wrapper: readFileSync(WRAPPER_SOURCE, 'utf8'),
};
const probeRoot = mkdtempSync(path.join(tmpdir(), 'pw-bridge-mutants-'));
// Wrapper mutants keep their production relative import intact. Copy the init
// module beside them so a missing fixture cannot masquerade as a mutation kill.
writeFileSync(path.join(probeRoot, 'mcp-auth-init.mjs'), originals.init);
writeFileSync(
  path.join(probeRoot, 'runtime-safety.mjs'),
  readFileSync(path.join(ROOT, 'scripts', 'runtime-safety.mjs'), 'utf8'),
);

assert.equal(
  hasIntendedTapFailure('ok 1 - intended test\nnot ok 2 - unrelated test\n', 'intended test'),
  false,
  'bridge mutation gate must reject an unrelated failing TAP entry',
);
assert.equal(
  hasIntendedTapFailure('not ok 1 - intended test\n', 'intended test'),
  true,
  'bridge mutation gate must accept the intended failing TAP entry',
);

const mutants = [
  {
    id: 'exact-url-always-matches',
    source: 'init',
    from: '      return new URL(loginUrl).href === href;\n',
    to: marker => `      return (console.error('BRIDGE_MUTANT_EXECUTED:${marker}'), true);\n`,
    expectedTest: 'exact URL matching rejects hostile origin, path, query, and fragment variants',
  },
  {
    id: 'role-selection-skipped',
    source: 'init',
    from: '  if (config.selectSelector) {\n',
    to: marker => `  console.error('BRIDGE_MUTANT_EXECUTED:${marker}');\n  if (false) {\n`,
    expectedTest: 'local bridge selects a role and completes delayed two-step login',
  },
  {
    id: 'totp-replaced-with-constant',
    source: 'init',
    from: '    const code = generateTotp(config.totpSecret);\n',
    to: marker => `    console.error('BRIDGE_MUTANT_EXECUTED:${marker}');\n    const code = '000000';\n`,
    expectedTest: 'local bridge completes a delayed TOTP challenge without exposing its code',
  },
  {
    id: 'mcp-secrets-redaction-omitted',
    source: 'wrapper',
    from: "    '--secrets', envFile,\n",
    to: marker => `    (console.error('BRIDGE_MUTANT_EXECUTED:${marker}'), '--console-level'), 'error',\n`,
    expectedTest: 'wrapper dry-run pins extension MCP and never prints dotenv values',
  },
  {
    id: 'node-debug-fails-open',
    source: 'wrapper',
    from: '  if (enabledNodeDebug.length) {\n',
    to: marker => `  console.error('BRIDGE_MUTANT_EXECUTED:${marker}');\n  if (false) {\n`,
    expectedTest: 'wrapper fails closed for missing credentials, unsafe URL, and NODE_DEBUG',
  },
];

try {
  let killed = 0;
  for (const mutant of mutants) {
    const original = originals[mutant.source];
    const occurrences = original.split(mutant.from).length - 1;
    assert.equal(occurrences, 1, `${mutant.id}: replacement anchor count must be exactly 1, got ${occurrences}`);

    const marker = `pw-${mutant.id}`;
    const changed = original.replace(mutant.from, mutant.to(marker));
    assert.notEqual(changed, original, `${mutant.id}: mutant was not applied`);
    const mutantPath = path.join(probeRoot, `${mutant.id}.mjs`);
    writeFileSync(mutantPath, changed);

    const env = {
      ...process.env,
      BRIDGE_EXPECT_MUTANT_MARKER: marker,
      [mutant.source === 'init' ? 'BRIDGE_INIT_UNDER_TEST' : 'BRIDGE_WRAPPER_UNDER_TEST']: mutantPath,
    };
    const result = spawnSync(process.execPath, [
      '--test',
      '--test-concurrency=1',
      '--test-reporter=tap',
      '--test-name-pattern', `^${escapeRegExp(mutant.expectedTest)}$`,
      BRIDGE_TEST,
    ], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      timeout: 60_000,
      windowsHide: true,
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;

    if (result.error) throw new Error(`${mutant.id}: test process failed: ${result.error.message}`);
    if (result.signal) throw new Error(`${mutant.id}: test process ended by ${result.signal}`);
    if (!output.includes(`BRIDGE_MUTANT_EXECUTED:${marker}`)) {
      throw new Error(`${mutant.id}: execution marker missing; refusing a fail-open kill`);
    }
    if (/cancelled [1-9]/i.test(output)) {
      throw new Error(`${mutant.id}: test cancellation is not a valid mutation kill\n${output}`);
    }
    if (result.status === 0) throw new Error(`${mutant.id}: SURVIVED\n${output}`);
    if (!hasIntendedTapFailure(output, mutant.expectedTest)) {
      throw new Error(`${mutant.id}: intended test was not the failing TAP entry\n${output}`);
    }

    killed += 1;
    console.log(`KILLED ${mutant.id}`);
  }

  console.log(`bridge mutation: ${killed}/${mutants.length} killed`);
} finally {
  const resolvedProbe = path.resolve(probeRoot);
  const resolvedTemp = path.resolve(tmpdir());
  assert.ok(resolvedProbe.startsWith(resolvedTemp + path.sep), `unsafe mutation cleanup target: ${resolvedProbe}`);
  rmSync(resolvedProbe, { recursive: true, force: true });
}

function hasIntendedTapFailure(output, testName) {
  return new RegExp(`^not ok \\d+ - ${escapeRegExp(testName)}$`, 'm').test(output);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

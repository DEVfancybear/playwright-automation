#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const releaseIndexTree = indexFingerprint();
inspectIndexState('initial staged release state');
assert.equal(indexFingerprint(), releaseIndexTree, 'index changed during initial release-state inspection');
run('syntax: installer', process.execPath, ['--check', 'bin/install.mjs']);
run('syntax: auth helper', process.execPath, ['--check', 'scripts/auth-login.mjs']);
run('syntax: MCP auth bridge', process.execPath, ['--check', 'scripts/mcp-auth-bridge.mjs']);
run('syntax: MCP init adapter', process.execPath, ['--check', 'scripts/mcp-auth-init.cjs']);
run('syntax: MCP init page', process.execPath, ['--check', 'scripts/mcp-auth-init.mjs']);
run('syntax: explorer', process.execPath, ['--check', 'scripts/explore.mjs']);
run('syntax: standalone runner', process.execPath, ['--check', 'tools/standalone.mjs']);
runNpm('full test suite', ['test']);
run('manual auth mutation', process.execPath, ['tools/mutate-auth-tests.mjs']);
run('manual bridge mutation', process.execPath, ['tools/mutate-bridge-tests.mjs']);
run('git whitespace gate', 'git', ['diff', '--cached', '--check']);
inspectSkill();
inspectTrackedAndPendingFiles();
inspectPackage();
runNpm('dependency audit', ['audit', '--audit-level=high']);
inspectIndexState('final staged release state');
assert.equal(
  indexFingerprint(),
  releaseIndexTree,
  'Git index changed while the gauntlet was running; stage intentionally and rerun from the beginning',
);

console.log('\nGAUNTLET_OK');

function run(label, command, args) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit ${result.status}`);
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

function inspectIndexState(label) {
  console.log(`\n== ${label} ==`);
  const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (status.error) throw status.error;
  assert.equal(status.status, 0, status.stderr);

  const lines = status.stdout.split(/\r?\n/).filter(Boolean);
  const outsideIndex = lines.filter(line => line.startsWith('??') || line[1] !== ' ');
  assert.deepEqual(
    outsideIndex,
    [],
    `release files must be staged with no unstaged/untracked remainder:\n${outsideIndex.join('\n')}`,
  );

  const critical = [
    'AGENTS.md',
    'CLAUDE.md',
    'package.json',
    'package-lock.json',
    'SKILL.md',
    'agents/openai.yaml',
    'bin/install.mjs',
    'references/autonomous-execution.md',
    'scripts/auth-login.mjs',
    'scripts/mcp-auth-bridge.mjs',
    'scripts/mcp-auth-init.cjs',
    'scripts/mcp-auth-init.mjs',
    'scripts/explore.mjs',
    'tests/auth-login.integration.test.mjs',
    'tests/mcp-auth-bridge.integration.test.mjs',
    'tests/standalone.integration.test.mjs',
    'tests/installer.test.mjs',
    'tests/skill-contract.test.mjs',
    'tools/mutate-auth-tests.mjs',
    'tools/mutate-bridge-tests.mjs',
    'tools/release-gauntlet.mjs',
    'tools/standalone.mjs',
    'verification/3.0.1-BRIDGE-SPEC.md',
    'verification/3.0.0-SPEC.md',
  ];
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '--', ...critical], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (tracked.error) throw tracked.error;
  assert.equal(tracked.status, 0, `critical release files missing from index:\n${tracked.stderr}`);
  console.log(`staged release state: ${lines.length} changed paths, ${critical.length} critical files indexed`);
}

function indexFingerprint() {
  const result = spawnSync('git', ['write-tree'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function inspectSkill() {
  console.log('\n== skill contract ==');
  const skill = readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8');
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(frontmatter, 'SKILL.md frontmatter is missing');
  assert.match(frontmatter[1], /^name:\s*playwright-automation\s*$/m);
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1];
  assert.ok(description, 'skill description is missing');
  assert.ok(description.normalize('NFC').length <= 1024, `description exceeds 1024 chars: ${description.length}`);
  assert.match(skill, /`relaxed`/);
  assert.match(skill, /`guarded`/);
  console.log(`skill contract: description ${description.length} chars`);
}

function inspectTrackedAndPendingFiles() {
  console.log('\n== secret/artifact filename gate ==');
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const files = result.stdout.split('\0').filter(Boolean);
  const forbidden = files.filter(file =>
    /(^|\/)(\.env(?:\..+)?|\.auth)(\/|$)/i.test(file)
    || /(^|\/)__pycache__(\/|$)|\.py[co]$/i.test(file),
  );
  assert.deepEqual(forbidden, [], `secret/cache artifacts found: ${forbidden.join(', ')}`);
  console.log(`filename gate: ${files.length} files checked`);
}

function inspectPackage() {
  console.log('\n== npm package ==');
  const invocation = npmInvocation(['pack', '--dry-run', '--json']);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const pack = JSON.parse(result.stdout)[0];
  const files = pack.files.map(file => file.path);
  const required = [
    'SKILL.md',
    'agents/openai.yaml',
    'references/autonomous-execution.md',
    'references/live-browser-investigation.md',
    'bin/install.mjs',
    'scripts/auth-login.mjs',
    'scripts/mcp-auth-bridge.mjs',
    'scripts/mcp-auth-init.cjs',
    'scripts/mcp-auth-init.mjs',
    'scripts/explore.mjs',
  ];
  const missing = required.filter(file => !files.includes(file));
  const forbidden = files.filter(file => /(^|\/)__pycache__(\/|$)|\.py[co]$/i.test(file));
  assert.equal(pack.version, '3.0.1');
  assert.deepEqual(missing, [], `package missing: ${missing.join(', ')}`);
  assert.deepEqual(forbidden, [], `package contains Python bytecode: ${forbidden.join(', ')}`);
  console.log(`package ${pack.name}@${pack.version}: ${files.length} files, required payload present`);
}

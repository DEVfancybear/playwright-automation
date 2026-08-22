import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTALLER = path.join(ROOT, 'bin', 'install.mjs');

function runInstaller(args, envPatch = {}, cwd = ROOT) {
  const env = { ...process.env, ...envPatch };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  return spawnSync(process.execPath, [INSTALLER, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
}

test('Codex global path honors CODEX_HOME and keeps project .agents path', () => {
  const configuredHome = path.resolve(ROOT, '..', 'codex-home-fixture');
  const result = runInstaller(['where', '--codex'], { CODEX_HOME: configuredHome });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(escapeRegExp(path.join(configuredHome, 'skills', 'playwright-automation'))));
  assert.match(result.stdout, new RegExp(escapeRegExp(path.join(ROOT, '.agents', 'skills', 'playwright-automation'))));
});

test('CODEX_HOME path resolution holds across generated absolute paths', () => {
  let seed = 0x3c0d3;
  for (let index = 0; index < 8; index += 1) {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    const configuredHome = path.resolve(ROOT, '..', `codex home ${index}-${seed.toString(16)}`);
    const result = runInstaller(['where', '--codex'], { CODEX_HOME: configuredHome });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(escapeRegExp(path.join(configuredHome, 'skills', 'playwright-automation'))));
  }
});

test('Codex global path falls back to ~/.codex/skills', () => {
  const result = runInstaller(['where', '--codex'], { CODEX_HOME: undefined });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(escapeRegExp(path.join(homedir(), '.codex', 'skills', 'playwright-automation'))));
});

test('Claude Code keeps ~/.claude globally and .claude/skills per project', () => {
  const result = runInstaller(['where', '--claude']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(escapeRegExp(path.join(homedir(), '.claude', 'skills', 'playwright-automation'))));
  assert.match(result.stdout, new RegExp(escapeRegExp(path.join(ROOT, '.claude', 'skills', 'playwright-automation'))));
});

test('Codex and Claude flags remain mutually exclusive', () => {
  const result = runInstaller(['where', '--codex', '--claude']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Chỉ chọn một trong hai/);
});

test('Claude install copies the shared autonomous payload', () => {
  const probeRoot = mkdtempSync(path.join(tmpdir(), 'pw-skill-claude-install-'));
  const target = path.join(probeRoot, 'playwright-automation');
  try {
    const result = runInstaller(['install', '--claude', '--dir', target]);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    for (const relative of [
      'SKILL.md',
      path.join('agents', 'openai.yaml'),
      path.join('references', 'autonomous-execution.md'),
      path.join('scripts', 'auth-login.mjs'),
    ]) {
      assert.ok(existsSync(path.join(target, relative)), `missing Claude payload: ${relative}`);
    }
    assert.equal(existsSync(path.join(target, 'scripts', '__pycache__')), false, 'Claude payload must exclude Python cache');

    const duplicate = runInstaller(['install', '--claude', '--dir', target]);
    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /uninstall --claude --dir/);

    const forced = runInstaller(['install', '--claude', '--dir', target, '--force']);
    assert.equal(forced.status, 0, `${forced.stdout}\n${forced.stderr}`);
    assert.ok(existsSync(path.join(target, 'SKILL.md')));

    const removed = runInstaller(['uninstall', '--claude', '--dir', target]);
    assert.equal(removed.status, 0, `${removed.stdout}\n${removed.stderr}`);
    assert.equal(existsSync(target), false);
  } finally {
    cleanupTemp(probeRoot);
  }
});

test('Codex global install, force update, and uninstall honor CODEX_HOME', () => {
  const probeRoot = mkdtempSync(path.join(tmpdir(), 'pw-skill-codex-global-'));
  const target = path.join(probeRoot, 'skills', 'playwright-automation');
  try {
    const env = { CODEX_HOME: probeRoot };
    const installed = runInstaller(['install', '--codex'], env);
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);
    assert.ok(existsSync(path.join(target, 'SKILL.md')));

    const duplicate = runInstaller(['install', '--codex'], env);
    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /uninstall --codex/);

    const forced = runInstaller(['install', '--codex', '--force'], env);
    assert.equal(forced.status, 0, `${forced.stdout}\n${forced.stderr}`);

    const removed = runInstaller(['uninstall', '--codex'], env);
    assert.equal(removed.status, 0, `${removed.stdout}\n${removed.stderr}`);
    assert.equal(existsSync(target), false);
  } finally {
    cleanupTemp(probeRoot);
  }
});

test('Claude global install, force update, and uninstall honor the user home', () => {
  const probeRoot = mkdtempSync(path.join(tmpdir(), 'pw-skill-claude-global-'));
  const target = path.join(probeRoot, '.claude', 'skills', 'playwright-automation');
  try {
    const env = { HOME: probeRoot, USERPROFILE: probeRoot };
    const installed = runInstaller(['install', '--claude'], env);
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);
    assert.ok(existsSync(path.join(target, 'SKILL.md')));

    const forced = runInstaller(['install', '--claude', '--force'], env);
    assert.equal(forced.status, 0, `${forced.stdout}\n${forced.stderr}`);

    const removed = runInstaller(['uninstall', '--claude'], env);
    assert.equal(removed.status, 0, `${removed.stdout}\n${removed.stderr}`);
    assert.equal(existsSync(target), false);
  } finally {
    cleanupTemp(probeRoot);
  }
});

test('no host flag remains a Claude-compatible global lifecycle', () => {
  const probeRoot = mkdtempSync(path.join(tmpdir(), 'pw-skill-claude-default-'));
  const target = path.join(probeRoot, '.claude', 'skills', 'playwright-automation');
  const env = { HOME: probeRoot, USERPROFILE: probeRoot };
  try {
    const located = runInstaller(['where'], env);
    assert.equal(located.status, 0, located.stderr);
    assert.match(located.stdout, /Claude Code/);
    assert.match(located.stdout, new RegExp(escapeRegExp(target)));

    const installed = runInstaller(['install'], env);
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);
    assert.ok(existsSync(path.join(target, 'SKILL.md')));

    const removed = runInstaller(['uninstall'], env);
    assert.equal(removed.status, 0, `${removed.stdout}\n${removed.stderr}`);
    assert.equal(existsSync(target), false);
  } finally {
    cleanupTemp(probeRoot);
  }
});

test('project-scoped lifecycle works for Codex and Claude Code', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'pw-skill-project-'));
  try {
    for (const [flag, relativeBase] of [
      ['--codex', path.join('.agents', 'skills')],
      ['--claude', path.join('.claude', 'skills')],
    ]) {
      const target = path.join(projectRoot, relativeBase, 'playwright-automation');
      const installed = runInstaller(['install', flag, '--project'], {}, projectRoot);
      assert.equal(installed.status, 0, `${flag}: ${installed.stdout}\n${installed.stderr}`);
      assert.ok(existsSync(path.join(target, 'SKILL.md')), `${flag}: project payload missing`);

      const duplicate = runInstaller(['install', flag, '--project'], {}, projectRoot);
      assert.equal(duplicate.status, 1);
      assert.match(duplicate.stderr, new RegExp(`uninstall ${escapeRegExp(flag)} --project`));

      const forced = runInstaller(['install', flag, '--project', '--force'], {}, projectRoot);
      assert.equal(forced.status, 0, `${flag}: ${forced.stdout}\n${forced.stderr}`);

      const removed = runInstaller(['uninstall', flag, '--project'], {}, projectRoot);
      assert.equal(removed.status, 0, `${flag}: ${removed.stdout}\n${removed.stderr}`);
      assert.equal(existsSync(target), false, `${flag}: project target should be removed`);
    }
  } finally {
    cleanupTemp(projectRoot);
  }
});

test('custom directory force and uninstall refuse unrelated data', () => {
  const probeRoot = mkdtempSync(path.join(tmpdir(), 'pw-skill-unrelated-'));
  const target = path.join(probeRoot, 'unrelated-data');
  const sentinel = path.join(target, 'keep-me.txt');
  try {
    mkdirSync(target, { recursive: true });
    writeFileSync(sentinel, 'must survive');
    writeFileSync(path.join(target, 'SKILL.md'), '# unrelated notes\n\n```yaml\nname: playwright-automation\n```\n');

    const forced = runInstaller(['install', '--claude', '--dir', target, '--force']);
    assert.equal(forced.status, 1);
    assert.match(forced.stderr, /Từ chối xoá\/ghi đè/);
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive');

    const removed = runInstaller(['uninstall', '--claude', '--dir', target]);
    assert.equal(removed.status, 1);
    assert.match(removed.stderr, /Từ chối xoá\/ghi đè/);
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive');

    const duplicate = runInstaller(['install', '--claude', '--dir', target]);
    assert.equal(duplicate.status, 1);
    assert.doesNotMatch(duplicate.stderr, /uninstall --claude --dir/);
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive');
  } finally {
    cleanupTemp(probeRoot);
  }
});

test('uninstall refuses the current working directory even with a forged skill name', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'pw-skill-protected-cwd-'));
  const sentinel = path.join(projectRoot, 'keep-me.txt');
  try {
    writeFileSync(path.join(projectRoot, 'SKILL.md'), '---\nname: playwright-automation\n---\n');
    writeFileSync(sentinel, 'must survive');

    const result = runInstaller(['uninstall', '--claude', '--dir', projectRoot], {}, projectRoot);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /bao phủ home, thư mục hiện tại hay source package/);
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive');
  } finally {
    cleanupTemp(projectRoot);
  }
});

test('an explicitly empty custom directory cannot fall back to the global target', () => {
  const probeRoot = mkdtempSync(path.join(tmpdir(), 'pw-skill-empty-dir-'));
  const target = path.join(probeRoot, '.claude', 'skills', 'playwright-automation');
  const env = { HOME: probeRoot, USERPROFILE: probeRoot };
  try {
    const installed = runInstaller(['install', '--claude'], env);
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);
    const sentinel = path.join(target, 'SKILL.md');
    assert.ok(existsSync(sentinel));

    for (const empty of ['', '   ']) {
      const result = runInstaller(['uninstall', '--claude', '--dir', empty], env);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /--dir không được rỗng/);
      assert.ok(existsSync(sentinel), 'invalid custom scope must leave the global install intact');
    }

    const removed = runInstaller(['uninstall', '--claude'], env);
    assert.equal(removed.status, 0, `${removed.stdout}\n${removed.stderr}`);
  } finally {
    cleanupTemp(probeRoot);
  }
});

test('npm-installed host update instructions use force install, while git pull is clone-only', () => {
  const installDoc = readFileSync(path.join(ROOT, 'docs', 'INSTALL.md'), 'utf8');

  assert.match(installDoc, /Cài bằng npm[\s\S]*install --codex --force/);
  assert.match(installDoc, /Cài bằng npm[\s\S]*install --claude --force/);
  assert.match(installDoc, /Chỉ với bản clone bằng git[\s\S]*git pull/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanupTemp(directory) {
  const resolved = path.resolve(directory);
  const tempRoot = path.resolve(tmpdir());
  assert.ok(resolved.startsWith(tempRoot + path.sep), `unsafe temp cleanup target: ${resolved}`);
  rmSync(resolved, { recursive: true, force: true });
}

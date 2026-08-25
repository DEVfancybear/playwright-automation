import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('npm package includes only the empty dotenv example and no local auth material', () => {
  const invocation = npmInvocation(['pack', '--dry-run', '--json']);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);

  const pack = JSON.parse(result.stdout)[0];
  const files = pack.files.map(entry => entry.path.replaceAll('\\', '/'));
  const dotenvOrAuth = files.filter(file => /(^|\/)(\.env(?:\..+)?|\.auth)(\/|$)/i.test(file));
  assert.deepEqual(dotenvOrAuth, ['.env.example']);
  assert.ok(files.includes('scripts/auth-env.mjs'));
  assert.ok(files.includes('scripts/runtime-safety.mjs'));
});

function npmInvocation(args) {
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  }
  if (process.platform === 'win32') {
    return { command: process.env.ComSpec, args: ['/d', '/s', '/c', 'npm.cmd', ...args] };
  }
  return { command: 'npm', args };
}

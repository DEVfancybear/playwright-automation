import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STANDALONE = path.join(ROOT, 'tools', 'standalone.mjs');

test('terminal URL help succeeds without installing or opening a browser', async () => {
  const result = await spawnNode([STANDALONE, 'url', '--help']);

  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /npm run test:url|explore\.mjs/);
  assert.doesNotMatch(result.stdout, /Cài Chromium|Test URL độc lập/);
});

test('terminal URL mode fails closed when the target is missing', async () => {
  const result = await spawnNode([STANDALONE, 'url']);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Thiếu --url/);
  assert.doesNotMatch(result.stdout, /Dependency Playwright|Test URL độc lập/);
});

test('fresh-clone terminal smoke drives Chromium against the bundled local fixture', async () => {
  const probeRoot = mkdtempSync(path.join(tmpdir(), 'pw-skill-standalone-'));
  const outputDir = path.join(probeRoot, 'evidence');
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
      <html lang="vi">
        <head><title>Playwright standalone fixture</title></head>
        <body>
          <main>
            <h1>Skill chạy độc lập</h1>
            <label>Email <input type="email" /></label>
            <button type="button">Chạy smoke test</button>
          </main>
        </body>
      </html>`);
  });

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    const result = await spawnNode([
      STANDALONE,
      'url',
      `--url=http://127.0.0.1:${address.port}`,
      '--out', outputDir,
      '--wait', '0',
      '--max', '20',
    ]);

    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /TERMINAL_TEST_OK/);
    assert.match(result.stdout, /Playwright standalone fixture/);
    assert.match(result.stdout, /getByRole\('button', \{ name: 'Chạy smoke test' \}\)/);

    const pageInfo = JSON.parse(readFileSync(path.join(outputDir, 'page-info.json'), 'utf8'));
    assert.equal(pageInfo.title, 'Playwright standalone fixture');
    assert.match(readFileSync(path.join(outputDir, 'elements.md'), 'utf8'), /Skill chạy độc lập/);
    assert.ok(existsSync(path.join(outputDir, 'screenshot.png')), 'smoke phải tạo screenshot evidence');
    assert.ok(existsSync(path.join(outputDir, 'console.log')), 'smoke phải tạo console evidence');
    assert.ok(existsSync(path.join(outputDir, 'network-errors.log')), 'smoke phải tạo network evidence');
  } finally {
    await new Promise(resolve => server.close(resolve));
    cleanupTemp(probeRoot);
  }
});

function spawnNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout, stderr }));
  });
}

function cleanupTemp(directory) {
  const resolved = path.resolve(directory);
  const tempRoot = path.resolve(tmpdir());
  assert.ok(resolved.startsWith(tempRoot + path.sep), `unsafe temp cleanup target: ${resolved}`);
  rmSync(resolved, { recursive: true, force: true });
}

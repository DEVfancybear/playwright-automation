import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(path.join(ROOT, relative), 'utf8');

test('relaxed mode codifies automatically and uses Inconclusive for missing non-core oracle', () => {
  const skill = read('SKILL.md');
  const live = read(path.join('references', 'live-browser-investigation.md'));
  const autonomous = read(path.join('references', 'autonomous-execution.md'));

  assert.doesNotMatch(live, /hỏi có cần chốt thành regression/i);
  assert.match(live, /tự chốt thành regression spec/i);
  assert.match(skill, /business verdict `Inconclusive/);
  assert.match(skill, /trusted helper[\s\S]*được phép và bắt buộc/);
  assert.match(autonomous, /Kiểm technical invariant[\s\S]*`Inconclusive`/);
  assert.match(autonomous, /helper process được phép tự nạp secret/);
});

test('explore CLI has no value-bearing username or password flags', () => {
  const explore = read(path.join('scripts', 'explore.mjs'));

  assert.doesNotMatch(explore, /['"]username['"]\s*:/);
  assert.doesNotMatch(explore, /['"]password['"]\s*:/);
  assert.doesNotMatch(explore, /--save-auth|--username|--password/);
  assert.match(explore, /auth-login\.mjs/);
});

test('runtime-blocked auth uses the local MCP bridge before asking for manual login', () => {
  const skill = read('SKILL.md');
  const auth = read(path.join('references', 'auth-and-data.md'));
  const autonomous = read(path.join('references', 'autonomous-execution.md'));
  const bridge = read(path.join('scripts', 'mcp-auth-bridge.mjs'));
  const combined = `${skill}\n${auth}\n${autonomous}`;

  assert.match(combined, /runtime[^\n]*bị chặn[^\n]*browser[^\n]*tới được[\s\S]*mcp-auth-bridge\.mjs/i);
  assert.match(combined, /không[^\n]*(?:suy diễn|đoán)[^\n]*credential[^\n]*(?:định dạng|hình dạng)/i);
  assert.match(combined, /chỉ[^\n]*(?:kết quả|phản hồi)[^\n]*đăng nhập[^\n]*(?:thật|thực)/i);
  assert.match(combined, /exact[^\n]*login URL/i);
  assert.match(bridge, /@playwright\/mcp@0\.0\.79/);
  assert.match(bridge, /'--extension'/);
  assert.match(bridge, /'--init-page'/);
  assert.match(bridge, /'--secrets'/);
  assert.doesNotMatch(bridge, /--username|--password/);
});

test('release metadata supports both hosts without runtime dependencies', () => {
  const manifest = JSON.parse(read('package.json'));
  const installer = read(path.join('bin', 'install.mjs'));
  const readme = read('README.md');
  const installDoc = read(path.join('docs', 'INSTALL.md'));
  const live = read(path.join('references', 'live-browser-investigation.md'));
  const openai = read(path.join('agents', 'openai.yaml'));

  assert.equal(manifest.version, '3.0.1');
  assert.equal(manifest.engines.node, '>=20');
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.match(installer, /claude:[\s\S]*userDir: \['\.claude', 'skills'\]/);
  assert.match(installer, /codex:[\s\S]*projectDir: \['\.agents', 'skills'\]/);
  assert.match(`${readme}\n${installDoc}\n${live}\n${installer}`, /Node(?:\.js)? (?:\| )?≥ 20/);
  assert.doesNotMatch(`${readme}\n${installDoc}\n${live}\n${installer}`, /Node(?:\.js)? (?:\| )?≥ 18/);
  assert.match(openai, /classify the target first/);
  assert.match(openai, /guarded mode on production or unknown targets/);
});

test('a generic URL plus test request expands to zero-touch workflow without product hard-coding', () => {
  const skill = read('SKILL.md');
  const autonomous = read(path.join('references', 'autonomous-execution.md'));
  const installDoc = read(path.join('docs', 'INSTALL.md'));
  const combined = `${skill}\n${autonomous}\n${installDoc}`;

  assert.match(skill, /mở <staging-login-url> và test màn hình đơn hàng[\s\S]*toàn bộ pipeline/);
  assert.match(autonomous, /launch browser → ensure auth[\s\S]*execute\/heal → report/);
  assert.match(combined, /Không hard-code domain|không biến chúng thành domain/i);
  assert.doesNotMatch(combined, /viettel/i);
  assert.match(combined, /Codex và Claude Code/);
  assert.match(skill, /“chỉ mở URL”[\s\S]*không phải một yêu cầu kiểm thử/);
  assert.match(skill, /URL cùng ý định test\/kiểm tra\/reproduce\/verify[\s\S]*mục tiêu đầu-cuối/);
  assert.match(installDoc, /mở trình duyệt trước[\s\S]*plan → generate → execute\/heal → verdict/);
  assert.match(installDoc, /“chỉ mở”[\s\S]*mới dừng mà không codify test/);
});

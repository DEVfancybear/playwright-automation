# playwright-automation

[![npm](https://img.shields.io/npm/v/@duong.dev/playwright-automation)](https://www.npmjs.com/package/@duong.dev/playwright-automation)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)](https://nodejs.org)

> Skill cho Codex và Claude biến mọi yêu cầu kiểm thử thành một **pipeline tự chủ**: tự đăng nhập → quan sát app thật → lập kế hoạch có truy vết → tự duyệt phần an toàn → sinh spec Playwright + TypeScript → chạy qua cổng ổn định → tự sửa bằng cách quan sát lại → **verdict có số**. Chế độ `relaxed` giúp tester không phải gật đầu sau từng bước; production và side effect thật vẫn dùng `guarded`.

Đây là một Agent Skill theo chuẩn mở, dùng được trong [Codex](https://learn.chatgpt.com/docs/build-skills) và Claude Code. Skill đóng gói hướng dẫn, reference và script để agent tự nạp khi bạn nhờ tái hiện bug hoặc làm automation test. Bạn nói bằng tiếng Việt như nói với đồng nghiệp; agent lo phần trinh sát, selector, cấu hình và code.

Phát triển dựa trên ý tưởng của [`anthropics/skills/webapp-testing`](https://github.com/anthropics/skills/tree/main/skills/webapp-testing), viết lại cho stack TypeScript và cho quy trình làm việc thực tế của tester Việt Nam.

---

## Chạy ngay sau khi clone — không cần project khác

Cách dễ nhất cho tester không rành terminal:

1. Clone/mở repository này bằng Codex hoặc Claude Code.
2. Chỉ cần nói: **“Test repo này.”**

`AGENTS.md` và `CLAUDE.md` sẽ buộc Agent tự chạy smoke `npm run test:standalone`, tự cài dependency/browser còn thiếu và theo tới marker `STANDALONE_OK`. Agent không được đẩy các bước `npm install`/`playwright install` về cho tester. Chỉ yêu cầu “full regression” mới dùng `npm test`.

Nếu tester muốn tự chạy terminal, chỉ cần **Node.js ≥ 20** rồi dùng:

```bash
git clone https://github.com/DEVfancybear/playwright-automation.git
cd playwright-automation
npm run test:standalone
```

Lần đầu, lệnh tự chạy `npm ci` theo `package-lock.json` và chỉ tải Chromium nếu máy chưa có đúng browser. Với `test:url -- --browser firefox|webkit`, runner tải browser được chọn khi thiếu. Sau đó smoke mặc định mở một trang fixture local bằng Chromium thật, chạy contract và kết thúc bằng:

```text
STANDALONE_OK
```

Luồng này **không** cài skill vào Codex/Claude, không ghi `.agents/` hay `.claude/`, không scaffold project con và không cần credential. Muốn chạy toàn bộ regression suite của repository:

```bash
npm test
# tương đương: npm run test:standalone:full
```

Muốn dùng ngay tool của skill với một URL thật, vẫn từ chính terminal đó:

```bash
npm run test:url -- --url https://playwright.dev
# Thêm --headed nếu muốn nhìn browser; mặc định evidence nằm ở ./recon-output
```

`test:url` là smoke/trinh sát kỹ thuật: nó lưu screenshot, console, request lỗi và locator thật; `TERMINAL_TEST_OK` có nghĩa tool đã chạy xong, **không tự suy diễn business verdict**. Với yêu cầu tự hiểu nghiệp vụ rồi generate/heal test bằng ngôn ngữ tự nhiên, cài skill vào Codex/Claude theo phần dưới.

---

## Skill này giải quyết vấn đề gì

Tester chuyển sang automation thường vấp mấy chỗ này:

| Vấn đề | Skill xử lý thế nào |
|---|---|
| **Kiểm thử không có quy trình, mỗi lần một kiểu** | Một pipeline bắt buộc, tám bước, áp cho mọi yêu cầu — từ "xem hộ trang này" tới cả workbook bug log |
| **Agent cứ dừng hỏi sau mỗi bước** | `relaxed` mặc định trên local/dev/QA/staging/UAT: tự resolve config, login, duyệt plan, chạy, heal và cleanup dữ liệu riêng; chỉ hỏi khi thiếu secret/oracle/quyền thật sự |
| **Đoán selector** → test lúc chạy lúc không | Bước EXPLORE bắt buộc chạy trên app thật trước khi được lập plan hay sinh code (cây accessibility cho element có thật) |
| **Kiểm xong rồi để đó, lần sau kiểm lại từ đầu** | Mọi lượt kết thúc bằng spec commit được đã qua cổng ổn định, kèm verdict có số |
| **File test case Excel nằm một nơi, code nằm một nơi** | `scripts/excel_to_spec.py` đọc file UAT có sẵn, sinh khung spec + bảng truy vết `test-map.json` |
| **Bug tester mô tả nhanh, DEV cần verify lại sau fix** | Chuẩn hóa full row + evidence → tái hiện baseline → verify đúng build fix → targeted regression |
| **Log dài, đi qua nhiều màn hình rồi Agent bỏ sót state/bước** | Compile từng raw clause thành scenario map có actor, context/page, from/to state, timing, branch và observation point; báo coverage `x/y` |
| **Phải bấm nhanh/liên tục mới ra bug** | Tách `setup → critical burst → oracle`, chạy cadence/attempt matrix, đo timing thực tế và không chèn wait làm trigger biến mất |

Nguyên tắc xuyên suốt: **quan sát thật trước, chốt thành test sau — và luôn chốt.** Bằng chứng thu trực tiếp (ảnh, console, network) trả lời câu hỏi ngay; nhưng nó là *bằng chứng*, không phải *sản phẩm bàn giao*. Chưa có test chạy được là chưa xong.

## Pipeline bắt buộc

Mọi yêu cầu kiểm thử đi qua đúng tám bước này. Không bước nào tuỳ chọn.

Lệnh thuần thao tác như “chỉ mở URL”/“chỉ chụp ảnh” và không yêu cầu kiểm tra thì giữ đúng scope đó. Ngược lại, URL + ý định test/kiểm tra một màn hình hay feature mặc định là mục tiêu đầu-cuối: tự đăng nhập, explore, plan, generate, execute/heal và report.

```
0. FRAME    → chốt target, build/môi trường, role/state, nguồn grounding
1. EXPLORE  → mở app THẬT bằng công cụ browser, quan sát. Không đoán, không nhớ.
2. PLAN     → bảng scenario có tầng + truy vết + phần ngoài phạm vi
3. CONFIRM  → relaxed: Agent tự duyệt phần an toàn; guarded/rủi ro: bạn duyệt
4. GENERATE → spec + Page Object commit được, một scenario một file
5. EXECUTE  → chạy qua cổng ổn định (3 lượt, flaky bị quarantine)
6. HEAL     → fail thì quay lại trình duyệt thật, re-observe, sửa, chạy lại
7. VERDICT  → PASS/FAIL kèm số ca — hoặc Reproduced / Verified fixed với bug log
```

Bốn luật: **không bước nào tuỳ chọn** · **không đảo thứ tự** (không sinh code trước khi EXPLORE, không chạy trước khi quyết định CONFIRM được ghi lại) · **bỏ bước phải khai báo** là `Blocked` kèm điều kiện mở khoá · **chưa có test chạy được là chưa xong**. Trong `relaxed`, CONFIRM là `agent-self-approved`, không phải một vòng chờ.

Ngoại lệ duy nhất: bạn **nói rõ** không muốn file — agent dừng sau bước chạy tay và ghi `Codify skipped — theo yêu cầu người dùng` vào verdict. Agent không bao giờ tự quyết điều này.

**Trả lời sớm, chốt muộn.** EXPLORE thường đã đủ để biết app đúng hay sai, và agent báo kết luận sơ bộ đó ngay — bạn không phải chờ hết pipeline. Nhưng verdict chính thức chỉ có ở bước 7, sau khi test đã qua cổng ổn định.

Bug log không phải quy trình riêng — nó là **biến thể** của cùng tám bước: EXPLORE = decode row + evidence + recon, PLAN = fingerprint + kịch bản tái hiện + oracle, EXECUTE = replay đo `x/y`, VERDICT = reproduction outcome. Xem [`references/bug-reproduction.md`](references/bug-reproduction.md).

## Case khó: log dài, luồng stateful, race

Bug phức tạp có protocol riêng, nằm ở [`references/complex-flow-race-reproduction.md`](references/complex-flow-race-reproduction.md):

- **Log văn bản dài → scenario map:** giữ raw anchor của từng clause, actor/session/tab, state trước–sau, bước lặp/nhánh và từ khóa timing như “ngay”, “liên tục”, “lần thứ hai”. Agent phải báo `raw_clause_coverage: x/y`, không được tóm tắt mất bước.
- **Luồng stateful xuyên màn hình:** giữ toàn bộ causal chain trong một test/attempt, nhưng chia code sạch bằng `test.step`, Page Object và flow helper. Tab/popup cùng session dùng chung `BrowserContext`; hai role độc lập dùng hai context.
- **Critical burst:** setup được chờ readiness bình thường; đoạn trigger chỉ chứa action nguồn theo đúng thứ tự/cadence; oracle chạy sau burst. Agent không được thêm toast wait/screenshot/assertion ở giữa rồi vô tình “stabilize away” bug.
- **Cadence và tần suất:** timing không rõ được ghi `Unknown` rồi khám phá bằng speed ladder. Mỗi profile báo requested/observed timing và `reproduced x/y`; baseline intermittent không mặc định chỉ chạy hai lượt.
- **Evidence có thể ảnh hưởng race:** tách profile low-overhead và evidence-rich khi trace/video làm thay đổi tỷ lệ. Không gộp denominator và không kết luận `Not reproduced` chỉ vì bật trace thì bug ít xuất hiện hơn.
- **Fix verification có căn cứ:** giữ cùng build fingerprint, state, cadence và instrumentation profile giữa baseline/target; chỉ `Verified fixed` khi symptom cũ không còn, KQMM + persistence đạt và targeted regression không lỗi.

Các pattern kỹ thuật bám theo tài liệu chính thức của Playwright về [auto-waiting/actionability](https://playwright.dev/docs/actionability), [events](https://playwright.dev/docs/events), [pages/contexts](https://playwright.dev/docs/pages), [input](https://playwright.dev/docs/input), [trace viewer](https://playwright.dev/docs/trace-viewer) và [retries](https://playwright.dev/docs/test-retries).

## Dành cho ai

- Tester thủ công đang chuyển sang automation — biết rõ *cần test gì*, chưa rành *selector, async, CI*.
- QA lead cần dựng khung automation chuẩn cho team trong vài phút thay vì vài ngày.
- Dev muốn có bộ E2E mà không phải tự nghiên cứu từ đầu.

## Phạm vi bao phủ

| Mảng | Nội dung |
|---|---|
| **Quan sát trực tiếp (bước EXPLORE)** | Mở app thật, đọc cây accessibility, click/điền, chạy JS trong trang, đọc console + network, chụp bằng chứng |
| **Web UI E2E** | Locator theo vai trò, Page Object, form, bảng dữ liệu, upload/download, iframe, tab mới, dialog |
| **API testing** | `request` fixture, kiểm tra status/schema, chain token, tạo dữ liệu qua API cho test UI |
| **Visual regression** | `toHaveScreenshot`, che vùng động, quản lý ảnh baseline theo OS |
| **Responsive & cross-browser** | Đa viewport, giả lập thiết bị, Chromium/Firefox/WebKit |
| **Accessibility** | `@axe-core/playwright`, WCAG 2.1 AA, kiểm tra bàn phím |
| **Mock & giả lập lỗi** | `page.route`, HAR, lỗi 500, timeout, offline, mạng 3G |
| **Đăng nhập tự động** | Agent tự đăng nhập bằng credential trong `.env` — không bắt tester gõ mật khẩu, không đưa mật khẩu vào hội thoại. Tự dò form, role dropdown, TOTP 2FA, tái dùng phiên. Runtime bị chặn egress thì local MCP bridge gắn vào Chrome/Edge qua Playwright Extension và login ngay phía người dùng |
| **Vận hành zero-touch** | Hai mode `relaxed`/`guarded`, auto-plan, auto-start local server, auto-install dependency, heal/re-run và cleanup theo exact ID |
| **Dữ liệu & xác thực** | `storageState` đăng nhập một lần, đa role, sinh dữ liệu duy nhất, dọn dữ liệu |
| **Từ Excel sang script** | Đọc mẫu KỊCH BẢN NGHIỆM THU / UAT, sinh spec + truy vết |
| **Report & CI/CD** | HTML report, Allure, JUnit cho TestRail/Xray, GitHub Actions, Jenkins, GitLab, sharding |
| **Hiệu năng** | Core Web Vitals, Lighthouse, ranh giới khi nào phải dùng k6 |
| **Chẩn đoán** | Test flaky, timeout, lỗi chỉ xảy ra trên CI, locator gãy |
| **Bug reproduction & fix verification** | Đọc bug log nhiều tab/evidence, tái hiện baseline, phân loại nguyên nhân, verify fix và đề xuất Close/Reopen |
| **Complex flow & race reproduction** | Scenario map, multi-screen/tab/role, critical burst, cadence matrix, attempt rate và observer effect |
| **Kế hoạch test & truy vết** | Thứ tự tin cậy của nguồn (SRS → test case → nghiệp vụ → code → quan sát), plan có tầng, ma trận truy vết, "ngoài phạm vi", verdict |
| **Artefact & tài liệu test case** | Ghi lại phiên EXPLORE để lần sau chạy rẻ hơn; ghi use case → sinh tài liệu test case thủ công `Pre`/bước/`KQMM`; `.testagent.yaml` để khỏi hỏi lại |

## Cài đặt nhanh

**Trên Codex** — cài cho tài khoản hiện tại:

```bash
npx @duong.dev/playwright-automation install --codex
```

Installer dùng `$CODEX_HOME/skills/` khi biến này có sẵn, nếu không dùng `~/.codex/skills/`. Chạy lại với `--force` để thay bản đã cài.

Cài theo repo để team dùng chung; Codex tự quét `.agents/skills/` từ thư mục làm việc lên repo root:

```bash
npx @duong.dev/playwright-automation install --codex --project
```

Sau đó gõ `/skills` hoặc nhắc trực tiếp `$playwright-automation`.

**Trên Claude Code** — giữ nguyên lệnh cũ:

```bash
npx @duong.dev/playwright-automation install
```

Cài cho riêng dự án hiện tại để cả team dùng chung (commit `.claude/skills/` vào repo):

```bash
npx @duong.dev/playwright-automation install --project
```

Gỡ hoặc xem đang cài ở đâu:

```bash
npx @duong.dev/playwright-automation where --codex
npx @duong.dev/playwright-automation uninstall --codex
npx @duong.dev/playwright-automation uninstall
npx @duong.dev/playwright-automation where
```

**Trên claude.ai** — tự đóng gói file `.skill` từ mã nguồn (3 dòng lệnh, xem [docs/INSTALL.md](docs/INSTALL.md#cách-3--claudeai-web--desktop)), rồi vào **Settings → Capabilities → Skills → Upload skill**.

Chi tiết đầy đủ (clone bằng git, cài theo dự án, cập nhật, gỡ, kiểm tra đã nhận skill chưa): [docs/INSTALL.md](docs/INSTALL.md)

## Dùng thế nào

Không có cú pháp gì phải nhớ. Cứ nói việc cần làm:

```
Test giúp tôi chức năng đăng nhập ở https://staging.example.com, tài khoản test
để trong .env (TEST_USER/TEST_PASS). Dùng relaxed, tự chạy tới verdict; chỉ hỏi nếu bị chặn thật.
```

Fresh clone tự tạo `.env` rỗng ở root (đã gitignore). Tester điền credential local một lần; Agent không đọc giá trị và không lấy nhầm `.env` trong `assets/template`, examples hay fixtures.

```
Dựng khung automation cho dự án, staging ở https://staging.example.com,
API ở https://api-staging.example.com. Cần cả test API và visual.
```

```
Đây là file KỊCH BẢN NGHIỆM THU.xlsx của tôi. Chuyển sheet "Đăng nhập"
thành script Playwright.
```

```
Test này lúc pass lúc fail trên Jenkins mà chạy máy tôi thì luôn xanh. Sao vậy?
```

```
Bug log này dài và đi qua nhiều màn hình. Hãy map đủ từng clause, giữ nguyên state
giữa các màn hình, rồi tự tái hiện. Lỗi chỉ ra khi bấm Lưu → Quay lại thật nhanh;
hãy đo cadence, chạy nhiều attempts và đừng chờ toast ở giữa hai action.
```

Nhiều kịch bản hơn kèm output mẫu: [docs/USAGE.md](docs/USAGE.md)

## Cấu trúc kho

```
playwright-automation/
├── AGENTS.md                   # Codex/Agent vào repo: tự bootstrap và test khi tester chỉ nói “test”
├── CLAUDE.md                   # Claude Code nạp cùng contract tự động
├── .env.example               # Tên biến an toàn; npm run auth:setup tạo .env thật đã gitignore
├── SKILL.md                    # Điểm vào — pipeline 8 bước, định tuyến, nguyên tắc chống flaky
├── CHANGELOG.md                # Lịch sử phiên bản
├── agents/openai.yaml          # Metadata UI và prompt mặc định cho Codex/ChatGPT
├── references/                 # Tài liệu chuyên sâu, agent chỉ đọc file cần dùng
│   ├── live-browser-investigation.md # Bước EXPLORE: accessibility tree, console, network
│   ├── autonomous-execution.md # relaxed/guarded, zero-touch loop và decision table
│   ├── explore-artifacts.md    # Ghi lại & dùng lại phiên EXPLORE, sinh tài liệu test case
│   ├── bug-reproduction.md     # Tái hiện bug, verify fix, evidence và verdict
│   ├── complex-flow-race-reproduction.md # Log dài, multi-flow, cadence/race
│   ├── test-plan-and-traceability.md # Trust order, plan có tầng, truy vết, verdict
│   ├── project-setup.md        # Cài đặt, playwright.config.ts, đa môi trường
│   ├── ui-e2e.md               # Locator, Page Object, form, bảng, iframe
│   ├── api-testing.md          # request fixture, schema, checklist test API
│   ├── visual-responsive.md    # Screenshot, viewport, cross-browser
│   ├── accessibility.md        # axe-core, WCAG
│   ├── network-mocking.md      # page.route, HAR, giả lập lỗi
│   ├── auth-and-data.md        # storageState, đa role, dữ liệu test
│   ├── excel-to-spec.md        # Chuyển test case Excel sang code
│   ├── reporting-ci.md         # Reporter, Allure, GitHub Actions, Jenkins
│   ├── performance.md          # Web Vitals, Lighthouse, k6
│   └── troubleshooting.md      # Chẩn đoán flaky, timeout, lỗi CI
├── scripts/                    # Gọi trực tiếp, đọc --help trước
│   ├── auth-login.mjs          # Đăng nhập tự động bằng .env, lưu phiên, hỗ trợ TOTP 2FA
│   ├── auth-env.mjs            # Tạo .env root rỗng một lần, không overwrite/template fallback
│   ├── runtime-safety.mjs      # Guard TLS non-production và nguồn credential
│   ├── mcp-auth-bridge.mjs      # MCP local: nối Claude/Codex vào Chrome và auto-login khi runtime bị chặn
│   ├── mcp-auth-init.cjs        # Adapter init-page CommonJS theo contract của Playwright MCP
│   ├── mcp-auth-init.mjs        # Hook nội bộ của bridge: exact URL, role, form hai bước, TOTP
│   ├── explore.mjs             # Trinh sát trang, sinh locator có thật
│   ├── scaffold.mjs            # Dựng khung dự án Playwright TS
│   └── excel_to_spec.py        # Excel test case → spec + test-map.json
└── assets/template/            # Bộ khung dự án mà scaffold.mjs sinh ra
```

Skill dùng cơ chế **progressive disclosure**: `SKILL.md` luôn được nạp (ngắn gọn), còn `references/` chỉ nạp khi cần. Nhờ vậy skill phủ rộng mà không làm nặng context.

## Script dùng độc lập

Các script chạy được ngoài Codex/Claude, hữu ích cho tester muốn tự thao tác:

```bash
# Từ repository vừa clone: tự bootstrap dependency/browser rồi smoke ngay
npm run test:standalone

# Tuỳ chọn tường minh; standalone/auth helper cũng tự tạo khi thiếu
npm run auth:setup

# Trinh sát URL thật ngay trong repository, không cần import project khác
npm run test:url -- --url https://staging.example.com --headed

# Bảo đảm phiên đăng nhập: còn sống thì dùng lại, hết hạn thì tự login từ .env
node scripts/auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json

# Certificate lỗi trên staging/non-production đã xác nhận: Agent tự dùng context riêng
node scripts/auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json \
  --ignore-https-errors --confirm-non-production

# Runtime Agent bị chặn nhưng Chrome/Edge máy người dùng tới được staging:
# kiểm local MCP bridge mà không in credential
node scripts/mcp-auth-bridge.mjs --env .env --login-url https://staging.example.com/login --dry-run

# Trinh sát trang, lấy locator có thật thay vì đoán
node scripts/explore.mjs --url https://staging.example.com/login --out ./recon

# Dựng khung dự án đầy đủ
node scripts/scaffold.mjs --dir ./e2e --base-url https://staging.example.com --features ui,api,visual

# Đọc file test case Excel, sinh khung spec
python scripts/excel_to_spec.py --file "KỊCH BẢN NGHIỆM THU.xlsx" --dry-run
```

Mỗi script đều có `--help` mô tả đầy đủ tham số.

## Yêu cầu hệ thống

| Thành phần | Yêu cầu | Dùng cho |
|---|---|---|
| Node.js | ≥ 20 | `explore.mjs`, `scaffold.mjs`, chạy Playwright |
| Playwright | Tự bootstrap với `npm run test:standalone`; project ngoài dùng `npm i -D @playwright/test` | Chạy test và trinh sát |
| Python | ≥ 3.9 + `openpyxl` | `excel_to_spec.py` (chỉ khi cần đọc Excel) |

Không cài trước cũng được — Codex hoặc Claude sẽ hướng dẫn cài đúng lúc cần.

## Ghi chú thiết kế

Vài quyết định có chủ ý, nếu bạn định sửa skill thì nên biết lý do:

- **Pipeline bắt buộc, cổng tương tác có mode.** Bản 1.x cho phép dừng ở lượt quan sát; bản 2.0 bắt buộc đầu ra chạy lại được; bản 3.0 giữ đủ tám bước nhưng `relaxed` tự duyệt phần an toàn để tester không phải tương tác liên tục. `guarded` vẫn dùng cho production/side effect thật.
- **Khung spec sinh từ Excel cố tình FAIL** (`expect(true, ...).toBe(false)`). Một khung test luôn xanh nguy hiểm hơn không có test, vì nó tạo cảm giác đã kiểm tra trong khi chưa kiểm tra gì.
- **`retries: 2` chỉ bật trên CI.** Retry ở local sẽ giấu lỗi thật của script. Test mới thì phải qua cổng ổn định (`--repeat-each=3 --workers=1 --retries=0`) mới được nhận vào suite; ca lẫn lộn bị tách `@quarantine`, không bao giờ được làm xanh bằng `retries`.
- **App đang chạy không phải oracle.** Hành vi hiện tại chỉ nói app *đang* làm gì. Khi chưa có acceptance criterion, skill vẫn tự kiểm technical invariant và ghi verdict nghiệp vụ `Inconclusive`; chỉ hỏi nếu thiếu/mâu thuẫn expected result khiến chính ca trọng tâm không thể định nghĩa. Không đóng băng hành vi hiện tại thành `expect` — nếu không, bug hôm nay sẽ thành "chuẩn" của ngày mai.
- **Sửa test gãy thì không được hạ chuẩn assertion.** Đổi `toHaveText(...)` thành `toBeVisible()` cho xanh là xoá phần kiểm, không phải sửa test.
- **Race baseline chạy `retries=0`, thường `workers=1`.** Retry làm sai denominator `x/y`; parallel load chỉ được thêm như một biến thử nghiệm riêng.
- **`waitForTimeout` không dùng để chờ readiness.** Nó chỉ được chấp nhận khi delay chính là test input cadence, được đặt tên, đo và đưa vào ma trận.
- **`force`/`dispatchEvent` là nhánh chẩn đoán.** Bằng chứng chính vẫn phải dùng action user-like với actionability mặc định.
- **Locator trong `assets/template/pages/LoginPage.ts` là phỏng đoán.** Cố ý — quy trình bắt buộc chạy `explore.mjs` lấy locator thật rồi thay vào.
- **Nội dung viết bằng tiếng Việt**, thuật ngữ kỹ thuật giữ tiếng Anh. Tester đọc được thì vẫn sửa được test khi agent không có mặt.

## Lịch sử thay đổi

Phiên bản hiện tại: **3.0.1** — chế độ `relaxed` zero-touch trên non-production, `guarded` cho ranh giới rủi ro; auth một lệnh idempotent và local MCP bridge khi runtime bị chặn, hỗ trợ form hai bước/role/TOTP; pipeline tám bước bắt buộc từ 2.0.0.
Toàn bộ lịch sử: [CHANGELOG.md](CHANGELOG.md).

## Đóng góp

Sửa nội dung trong `references/` hoặc `assets/template/` rồi mở pull request. Nếu sửa `scripts/`, chạy thử trước:

```bash
node scripts/explore.mjs --url <trang bất kỳ> --out /tmp/recon
node scripts/auth-login.mjs --help
node scripts/mcp-auth-bridge.mjs --help
node scripts/scaffold.mjs --dir /tmp/e2e --dry-run
python scripts/excel_to_spec.py --file <file.xlsx> --dry-run
```

## Giấy phép

[Apache License 2.0](LICENSE) — Copyright 2026 DuongLT.

Bạn được tự do dùng, sửa, phân phối và dùng cho mục đích thương mại. Điều kiện: giữ lại thông báo bản quyền và giấy phép, đồng thời ghi rõ những file bạn đã sửa. Giấy phép cũng cấp quyền sử dụng bằng sáng chế (patent grant) và không đi kèm bảo hành nào.

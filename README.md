# playwright-automation

[![npm](https://img.shields.io/npm/v/@duong.dev/playwright-automation)](https://www.npmjs.com/package/@duong.dev/playwright-automation)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)](https://nodejs.org)

> Skill cho Codex và Claude giúp tester trả lời câu hỏi kiểm thử bằng **bằng chứng thu trực tiếp trên trình duyệt** — tái hiện bug, verify fix, đọc console/network ngay tại chỗ — và chỉ kết tinh thành test Playwright + TypeScript khi thật sự cần chạy lại. Kể cả log dài, luồng nhiều màn hình/role và bug chỉ xuất hiện khi thao tác nhanh.

Đây là một Agent Skill theo chuẩn mở, dùng được trong [Codex](https://learn.chatgpt.com/docs/build-skills) và Claude Code. Skill đóng gói hướng dẫn, reference và script để agent tự nạp khi bạn nhờ tái hiện bug hoặc làm automation test. Bạn nói bằng tiếng Việt như nói với đồng nghiệp; agent lo phần trinh sát, selector, cấu hình và code.

Phát triển dựa trên ý tưởng của [`anthropics/skills/webapp-testing`](https://github.com/anthropics/skills/tree/main/skills/webapp-testing), viết lại cho stack TypeScript và cho quy trình làm việc thực tế của tester Việt Nam.

---

## Skill này giải quyết vấn đề gì

Tester chuyển sang automation thường vấp ba chỗ:

| Vấn đề | Skill xử lý thế nào |
|---|---|
| **Dựng cả dự án test chỉ để trả lời một câu hỏi** | Mặc định thao tác trực tiếp trên trình duyệt: mở app, bấm, đọc console + network → kết luận kèm bằng chứng. 0 file, 0 dependency |
| **Đoán selector** → test lúc chạy lúc không | Bắt buộc trinh sát app thật trước khi viết code (cây accessibility cho element có thật; `scripts/explore.mjs` khi cần dump một lượt) |
| **Script dùng một lần rồi bỏ** | Khi thật sự cần chạy lại: kết tinh thành dự án có cấu trúc — Page Object, fixture, config đa môi trường, CI |
| **File test case Excel nằm một nơi, code nằm một nơi** | `scripts/excel_to_spec.py` đọc file UAT có sẵn, sinh khung spec + bảng truy vết `test-map.json` |
| **Bug tester mô tả nhanh, DEV cần verify lại sau fix** | Chuẩn hóa full row + evidence → tái hiện baseline → verify đúng build fix → targeted regression |
| **Log dài, đi qua nhiều màn hình rồi Agent bỏ sót state/bước** | Compile từng raw clause thành scenario map có actor, context/page, from/to state, timing, branch và observation point; báo coverage `x/y` |
| **Phải bấm nhanh/liên tục mới ra bug** | Tách `setup → critical burst → oracle`, chạy cadence/attempt matrix, đo timing thực tế và không chèn wait làm trigger biến mất |

Nguyên tắc xuyên suốt: **LIVE trước, CODIFY sau — và chỉ codify khi cần.** Mặc định là mở trình duyệt làm thật để trả lời ngay; chỉ viết spec khi cần chạy lại lâu dài (regression/CI) hoặc khi kịch bản vượt khả năng thao tác tay (nhịp bấm dưới 500 ms, tỷ lệ `x/y`, cookie HttpOnly, mock, hai session song song). Không có file spec không có nghĩa là chưa xong việc.

## Ba pha: FRAME → LIVE → CODIFY

Mặc định của skill không phải là viết file test, mà là **mở trình duyệt làm thật**:

- **Pha 0 — FRAME**: chốt URL/build/môi trường, role/state và đích đến (một lần hay chạy lại lâu dài).
- **Pha 1 — LIVE**: điều hướng, đọc cây accessibility, click/điền, chạy JS trong trang, đọc console + network. Phần lớn yêu cầu kết thúc ở đây.
- **Pha 2 — CODIFY**: chỉ khi có ít nhất một dấu — **LẶP** (cần chạy lại lâu dài), **NHỊP** (gap < ~500 ms), **SỐ** (tỷ lệ `x/y` trên ≥10 lượt), **QUYỀN** (cookie HttpOnly, mock, hai context, baseline snapshot), **YÊU CẦU** (người dùng nói rõ muốn có file).

**Không có file spec KHÔNG phải là chưa hoàn thành.** Chi tiết chế độ mặc định: [`references/live-browser-investigation.md`](references/live-browser-investigation.md).

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
| **Điều tra trực tiếp (mặc định)** | Mở app thật, đọc cây accessibility, click/điền, chạy JS trong trang, đọc console + network, chụp bằng chứng |
| **Web UI E2E** | Locator theo vai trò, Page Object, form, bảng dữ liệu, upload/download, iframe, tab mới, dialog |
| **API testing** | `request` fixture, kiểm tra status/schema, chain token, tạo dữ liệu qua API cho test UI |
| **Visual regression** | `toHaveScreenshot`, che vùng động, quản lý ảnh baseline theo OS |
| **Responsive & cross-browser** | Đa viewport, giả lập thiết bị, Chromium/Firefox/WebKit |
| **Accessibility** | `@axe-core/playwright`, WCAG 2.1 AA, kiểm tra bàn phím |
| **Mock & giả lập lỗi** | `page.route`, HAR, lỗi 500, timeout, offline, mạng 3G |
| **Dữ liệu & xác thực** | `storageState` đăng nhập một lần, đa role, sinh dữ liệu duy nhất, dọn dữ liệu |
| **Từ Excel sang script** | Đọc mẫu KỊCH BẢN NGHIỆM THU / UAT, sinh spec + truy vết |
| **Report & CI/CD** | HTML report, Allure, JUnit cho TestRail/Xray, GitHub Actions, Jenkins, GitLab, sharding |
| **Hiệu năng** | Core Web Vitals, Lighthouse, ranh giới khi nào phải dùng k6 |
| **Chẩn đoán** | Test flaky, timeout, lỗi chỉ xảy ra trên CI, locator gãy |
| **Bug reproduction & fix verification** | Đọc bug log nhiều tab/evidence, tái hiện baseline, phân loại nguyên nhân, verify fix và đề xuất Close/Reopen |
| **Complex flow & race reproduction** | Scenario map, multi-screen/tab/role, critical burst, cadence matrix, attempt rate và observer effect |

## Cài đặt nhanh

**Trên Codex** — cài cho tài khoản hiện tại:

```bash
npx @duong.dev/playwright-automation install --codex
```

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
để trong .env (TEST_USER/TEST_PASS). Xem có bug gì không.
```

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
├── SKILL.md                    # Điểm vào — quy trình, định tuyến, nguyên tắc chống flaky
├── CHANGELOG.md                # Lịch sử phiên bản
├── agents/openai.yaml          # Metadata UI và prompt mặc định cho Codex/ChatGPT
├── references/                 # Tài liệu chuyên sâu, agent chỉ đọc file cần dùng
│   ├── live-browser-investigation.md # (mặc định) Điều tra trực tiếp: accessibility tree, console, network
│   ├── bug-reproduction.md     # Tái hiện bug, verify fix, evidence và verdict
│   ├── complex-flow-race-reproduction.md # Log dài, multi-flow, cadence/race
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
│   ├── explore.mjs             # Trinh sát trang, sinh locator có thật
│   ├── scaffold.mjs            # Dựng khung dự án Playwright TS
│   └── excel_to_spec.py        # Excel test case → spec + test-map.json
└── assets/template/            # Bộ khung dự án mà scaffold.mjs sinh ra
```

Skill dùng cơ chế **progressive disclosure**: `SKILL.md` luôn được nạp (ngắn gọn), còn `references/` chỉ nạp khi cần. Nhờ vậy skill phủ rộng mà không làm nặng context.

## Script dùng độc lập

Ba script chạy được ngoài Codex/Claude, hữu ích cho tester muốn tự thao tác:

```bash
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
| Node.js | ≥ 18 | `explore.mjs`, `scaffold.mjs`, chạy Playwright |
| Playwright | `npm i -D @playwright/test` | Chạy test và trinh sát |
| Python | ≥ 3.9 + `openpyxl` | `excel_to_spec.py` (chỉ khi cần đọc Excel) |

Không cài trước cũng được — Codex hoặc Claude sẽ hướng dẫn cài đúng lúc cần.

## Ghi chú thiết kế

Vài quyết định có chủ ý, nếu bạn định sửa skill thì nên biết lý do:

- **Khung spec sinh từ Excel cố tình FAIL** (`expect(true, ...).toBe(false)`). Một khung test luôn xanh nguy hiểm hơn không có test, vì nó tạo cảm giác đã kiểm tra trong khi chưa kiểm tra gì.
- **`retries: 2` chỉ bật trên CI.** Retry ở local sẽ giấu lỗi thật của script.
- **Race baseline chạy `retries=0`, thường `workers=1`.** Retry làm sai denominator `x/y`; parallel load chỉ được thêm như một biến thử nghiệm riêng.
- **`waitForTimeout` không dùng để chờ readiness.** Nó chỉ được chấp nhận khi delay chính là test input cadence, được đặt tên, đo và đưa vào ma trận.
- **`force`/`dispatchEvent` là nhánh chẩn đoán.** Bằng chứng chính vẫn phải dùng action user-like với actionability mặc định.
- **Locator trong `assets/template/pages/LoginPage.ts` là phỏng đoán.** Cố ý — quy trình bắt buộc chạy `explore.mjs` lấy locator thật rồi thay vào.
- **Nội dung viết bằng tiếng Việt**, thuật ngữ kỹ thuật giữ tiếng Anh. Tester đọc được thì vẫn sửa được test khi agent không có mặt.

## Lịch sử thay đổi

Phiên bản hiện tại: **1.4.1** — ưu tiên trình duyệt mang profile thật của người dùng ở Pha 1, kèm bước xác minh xem công cụ đang lái binary/profile nào.
Toàn bộ lịch sử: [CHANGELOG.md](CHANGELOG.md).

## Đóng góp

Sửa nội dung trong `references/` hoặc `assets/template/` rồi mở pull request. Nếu sửa `scripts/`, chạy thử trước:

```bash
node scripts/explore.mjs --url <trang bất kỳ> --out /tmp/recon
node scripts/scaffold.mjs --dir /tmp/e2e --dry-run
python scripts/excel_to_spec.py --file <file.xlsx> --dry-run
```

## Giấy phép

[Apache License 2.0](LICENSE) — Copyright 2026 DuongLT.

Bạn được tự do dùng, sửa, phân phối và dùng cho mục đích thương mại. Điều kiện: giữ lại thông báo bản quyền và giấy phép, đồng thời ghi rõ những file bạn đã sửa. Giấy phép cũng cấp quyền sử dụng bằng sáng chế (patent grant) và không đi kèm bảo hành nào.

# playwright-automation

[![npm](https://img.shields.io/npm/v/@duong.dev/playwright-automation)](https://www.npmjs.com/package/@duong.dev/playwright-automation)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)](https://nodejs.org)

> Skill cho Claude giúp tester biến yêu cầu kiểm thử thành test tự động **chạy được và bảo trì được**, bằng Playwright + TypeScript.

Đây là một [Agent Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) — một gói hướng dẫn + script mà Claude tự nạp khi bạn nhờ nó làm automation test. Bạn nói bằng tiếng Việt như nói với đồng nghiệp; Claude lo phần selector, cấu hình và code.

Phát triển dựa trên ý tưởng của [`anthropics/skills/webapp-testing`](https://github.com/anthropics/skills/tree/main/skills/webapp-testing), viết lại cho stack TypeScript và cho quy trình làm việc thực tế của tester Việt Nam.

---

## Skill này giải quyết vấn đề gì

Tester chuyển sang automation thường vấp ba chỗ:

| Vấn đề | Skill xử lý thế nào |
|---|---|
| **Đoán selector** → test lúc chạy lúc không | Bắt buộc trinh sát app thật trước khi viết code (`scripts/explore.mjs` đọc DOM và sinh locator có thật, cảnh báo locator dính nhiều phần tử) |
| **Script dùng một lần rồi bỏ** | Kết tinh thành dự án có cấu trúc: Page Object, fixture, config đa môi trường, CI — commit vào repo được |
| **File test case Excel nằm một nơi, code nằm một nơi** | `scripts/excel_to_spec.py` đọc file UAT có sẵn, sinh khung spec + bảng truy vết `test-map.json` |

Nguyên tắc xuyên suốt: **Recon → Codify**. Trinh sát app thật trước, rồi mới kết tinh thành suite.

## Dành cho ai

- Tester thủ công đang chuyển sang automation — biết rõ *cần test gì*, chưa rành *selector, async, CI*.
- QA lead cần dựng khung automation chuẩn cho team trong vài phút thay vì vài ngày.
- Dev muốn có bộ E2E mà không phải tự nghiên cứu từ đầu.

## Phạm vi bao phủ

| Mảng | Nội dung |
|---|---|
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

## Cài đặt nhanh

**Trên Claude Code** — một lệnh, không cần clone:

```bash
npx @duong.dev/playwright-automation install
```

Cài cho riêng dự án hiện tại để cả team dùng chung (commit `.claude/skills/` vào repo):

```bash
npx @duong.dev/playwright-automation install --project
```

Gỡ hoặc xem đang cài ở đâu:

```bash
npx @duong.dev/playwright-automation uninstall
npx @duong.dev/playwright-automation where
```

**Trên claude.ai** — tải file `.skill` ở [Releases](../../releases) (hoặc tự đóng gói, xem [docs/INSTALL.md](docs/INSTALL.md)), rồi vào **Settings → Capabilities → Skills → Upload skill**.

Chi tiết đầy đủ (clone bằng git, cài theo dự án, cập nhật, gỡ, kiểm tra đã nhận skill chưa): [docs/INSTALL.md](docs/INSTALL.md)

## Dùng thế nào

Không có cú pháp gì phải nhớ. Cứ nói việc cần làm:

```
Test giúp tôi chức năng đăng nhập ở https://staging.congty.vn, tài khoản test là
tester@congty.vn / Abc@12345. Xem có bug gì không.
```

```
Dựng khung automation cho dự án, staging ở https://staging.congty.vn,
API ở https://api-staging.congty.vn. Cần cả test API và visual.
```

```
Đây là file KỊCH BẢN NGHIỆM THU.xlsx của tôi. Chuyển sheet "Đăng nhập"
thành script Playwright.
```

```
Test này lúc pass lúc fail trên Jenkins mà chạy máy tôi thì luôn xanh. Sao vậy?
```

Nhiều kịch bản hơn kèm output mẫu: [docs/USAGE.md](docs/USAGE.md)

## Cấu trúc kho

```
playwright-automation/
├── SKILL.md                    # Điểm vào — quy trình, định tuyến, nguyên tắc chống flaky
├── references/                 # Tài liệu chuyên sâu, Claude chỉ đọc file cần dùng
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

Ba script chạy được ngoài Claude, hữu ích cho tester muốn tự thao tác:

```bash
# Trinh sát trang, lấy locator có thật thay vì đoán
node scripts/explore.mjs --url https://staging.congty.vn/login --out ./recon

# Dựng khung dự án đầy đủ
node scripts/scaffold.mjs --dir ./e2e --base-url https://staging.congty.vn --features ui,api,visual

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

Không cài trước cũng được — Claude sẽ hướng dẫn cài đúng lúc cần.

## Ghi chú thiết kế

Vài quyết định có chủ ý, nếu bạn định sửa skill thì nên biết lý do:

- **Khung spec sinh từ Excel cố tình FAIL** (`expect(true, ...).toBe(false)`). Một khung test luôn xanh nguy hiểm hơn không có test, vì nó tạo cảm giác đã kiểm tra trong khi chưa kiểm tra gì.
- **`retries: 2` chỉ bật trên CI.** Retry ở local sẽ giấu lỗi thật của script.
- **Locator trong `assets/template/pages/LoginPage.ts` là phỏng đoán.** Cố ý — quy trình bắt buộc chạy `explore.mjs` lấy locator thật rồi thay vào.
- **Nội dung viết bằng tiếng Việt**, thuật ngữ kỹ thuật giữ tiếng Anh. Tester đọc được thì mới sửa được test khi Claude không có mặt.

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

# Changelog

Mọi thay đổi đáng chú ý của skill này đều ghi ở đây.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/); phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [1.4.0] — 2026-08-18

### Changed

- **Chrome thật của người dùng là trình duyệt ưu tiên** ở Pha 1 — LIVE, khi môi trường có nhiều bộ công cụ browser. Chrome thật mang sẵn phiên đăng nhập, ngoại lệ cert và proxy/VPN nội bộ, nên vào được staging/UAT mà trình duyệt sandbox bị chặn ngay từ bước điều hướng.
- Trình duyệt sandbox trong app xuống hàng dự phòng: chỉ dùng khi không có Chrome thật, hoặc khi cần đúng một profile sạch không session (kiểm luồng của người dùng mới, ép state đăng xuất).

### Added

- Mục **Chọn trình duyệt** trong [`references/live-browser-investigation.md`](references/live-browser-investigation.md): bảng so sánh hai loại công cụ, tiêu chí chọn, và luật an toàn riêng khi thao tác trên profile thật của người dùng.
- Cạm bẫy cert: sandbox trả `navigation denied` cho cả server chết, DNS sai lẫn cert không hợp lệ — dễ bị kết luận nhầm là site chết. Thêm cách phân biệt bằng `curl -sk` + `openssl s_client -dates`, và lưu ý timezone lệch không ảnh hưởng validate TLS.

## [1.3.0] — 2026

### Changed

- **Mặc định của skill không còn là viết file test, mà là mở trình duyệt làm thật.** Quy trình chia ba pha: Pha 0 — FRAME (chốt URL/build/môi trường, role/state, đích đến), Pha 1 — LIVE (điều hướng, đọc cây accessibility, click/điền, chạy JS trong trang, đọc console + network), Pha 2 — CODIFY (chỉ khi cần).
- Thêm **cổng CODIFY**: chỉ viết file spec khi có ít nhất một dấu — **LẶP** (chạy lại lâu dài), **NHỊP** (gap < ~500 ms), **SỐ** (tỷ lệ `x/y` trên ≥10 lượt), **QUYỀN** (cookie HttpOnly, mock, hai context, baseline snapshot), **YÊU CẦU** (người dùng nói rõ muốn có file).
- Chốt nguyên tắc: **không có file spec KHÔNG phải là chưa hoàn thành.**

### Added

- [`references/live-browser-investigation.md`](references/live-browser-investigation.md) — tài liệu cho chế độ mặc định: bảng năng lực và cách ánh xạ tên công cụ, quy đổi `role + name` → `getByRole`, luật điều hướng SPA, bốn kiểu hỏng im lặng, vòng đời `ref`, cách biết trang đã render xong khi không có `networkidle`, giới hạn cookie HttpOnly, mẫu báo cáo LIVE.

### Removed

- Phần trùng lặp giữa `SKILL.md` và các file `references/` — gộp lại để giữ context nhẹ.

## [1.2.0] — 2026

### Added

- [`references/complex-flow-race-reproduction.md`](references/complex-flow-race-reproduction.md) — protocol riêng cho bug phức tạp:
  - **Log dài → scenario map**: giữ raw anchor từng clause, actor/session/tab, state trước–sau, bước lặp/nhánh, từ khóa timing; bắt buộc báo `raw_clause_coverage: x/y`.
  - **Luồng stateful xuyên màn hình**: giữ nguyên causal chain trong một attempt, chia code bằng `test.step` + Page Object; tab/popup cùng session dùng chung `BrowserContext`, hai role độc lập dùng hai context.
  - **Critical burst**: setup chờ readiness bình thường, đoạn trigger chỉ chứa action nguồn đúng thứ tự/cadence, oracle chạy sau burst — không chèn wait/screenshot làm bug biến mất.
  - **Cadence và tần suất**: timing không rõ ghi `Unknown` rồi khám phá bằng speed ladder; mỗi profile báo requested/observed timing và `reproduced x/y`.
  - **Evidence có thể ảnh hưởng race**: tách profile low-overhead và evidence-rich, không gộp denominator.
  - **Fix verification có căn cứ**: giữ cùng build fingerprint, state, cadence, instrumentation profile giữa baseline và target.

## [1.1.0] — 2026

### Added

- Workflow tái hiện bug và verify fix: Decode → Reproduce baseline → Classify → Verify fix → *(tùy chọn)* Codify regression, ở [`references/bug-reproduction.md`](references/bug-reproduction.md).
- Hỗ trợ Codex/ChatGPT qua `agents/openai.yaml`.
- CI publish npm bằng trusted publishing.

## [1.0.0] — 2026

### Added

- Bản đầu tiên: skill automation testing Playwright + TypeScript cho tester.
- `references/` phủ project setup, UI/E2E, API, visual/responsive, accessibility, network mocking, auth & data, Excel → spec, reporting/CI, performance, troubleshooting.
- `scripts/explore.mjs`, `scripts/scaffold.mjs`, `scripts/excel_to_spec.py` và bộ khung dự án ở `assets/template/`.
- Đóng gói npm kèm trình cài đặt `npx`, giấy phép Apache-2.0.

[1.4.0]: https://github.com/DEVfancybear/playwright-automation/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/DEVfancybear/playwright-automation/compare/v1.1.0...v1.3.0
[1.2.0]: https://github.com/DEVfancybear/playwright-automation/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/DEVfancybear/playwright-automation/releases/tag/v1.1.0
[1.0.0]: https://github.com/DEVfancybear/playwright-automation/releases/tag/v1.0.0

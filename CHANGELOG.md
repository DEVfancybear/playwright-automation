# Changelog

Mọi thay đổi đáng chú ý của skill này đều ghi ở đây.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/); phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Unreleased]

### Added

- Luồng fresh-clone một lệnh `npm run test:standalone`: tự bootstrap dependency/browser, chạy Chromium thật với fixture local và trả marker `STANDALONE_OK` mà không cần cài skill hay dựng project ngoài.
- `.env` root được tạo rỗng tự động (hoặc bằng `npm run auth:setup`), không overwrite; helper từ chối mọi credential source dưới template/example/fixture/sample.
- TLS escape hatch có guard kép `--ignore-https-errors --confirm-non-production` cho auth, recon và local MCP bridge; credential không được điền sau redirect khác origin khi bypass đang bật.
- `npm run test:url -- --url <url>` để tester trinh sát URL thật và thu screenshot/console/network/locator ngay từ repository; `npm run test:standalone:full` chạy toàn bộ regression.
- Workflow GitHub Actions chạy đúng lệnh fresh-clone trên Windows và Ubuntu, cùng integration test khóa browser/evidence contract.
- Root `AGENTS.md` và `CLAUDE.md`: tester mở clone bằng Agent rồi chỉ nói “test”; Agent tự chạy standalone smoke, còn full suite chỉ chạy khi được yêu cầu, và không yêu cầu import skill hay cài dependency/browser thủ công.

### Changed

- `npm test` giờ cũng đi qua standalone bootstrap trước khi chạy full regression; commit `package-lock.json` để clone sạch dùng `npm ci` tái lập. `explore.mjs --help` trả exit code `0`.
- Agent gặp native certificate warning trên target non-production đã xác nhận giờ tự chuyển sang Playwright context riêng thay vì yêu cầu tester click qua cảnh báo; báo cáo phải ghi TLS validation đã bị bypass.

### Safety

- Npm package loại mọi `.env`/`.auth` kể cả khi nằm trong thư mục `assets/` được whitelist; source gate chỉ cho phép `.env.example` rỗng trong Git clone.

## [3.0.1] — 2026-08-24

### Added

- Local MCP auth bridge cho topology runtime bị chặn egress nhưng Chrome/Edge phía người dùng tới được target: wrapper pin `@playwright/mcp@0.0.79`, gắn tab hiện có qua Playwright Extension và auto-login từ `.env` trong process local.
- Bridge hỗ trợ form một/hai bước, dropdown role/tenant và TOTP; exact login URL allowlist chặn điền credential trên origin/path/query/fragment gần giống.
- Browser integration suite 9 case và manual bridge mutation gate 5 mutant cho URL boundary, init-page contract, role selection, TOTP, MCP redaction và `NODE_DEBUG` fail-closed.

### Changed

- Runtime bị chặn nhưng browser tới được và `.env` đủ credential giờ ưu tiên local MCP bridge; file phiên/password manager là fallback. Agent không được suy diễn quyền tài khoản từ định dạng username/PIN rồi hỏi login tay — chỉ auth response thật mới là bằng chứng.

### Safety

- MCP bridge không đưa secret lên command/tool argument, dùng `--secrets` cho redaction, fail closed khi `NODE_DEBUG` bật và chỉ điền trên exact URL đã cấu hình.

## [3.0.0] — 2026-08-22

**Breaking change về interaction gate.** Pipeline vẫn đủ tám bước, nhưng non-production không còn mặc định dừng ở FRAME/CONFIRM/VERDICT để hỏi tester. Chế độ `relaxed` tự chạy từ target tới verdict; `guarded` giữ cổng duyệt cho production và side effect thật.

### Added

- `references/autonomous-execution.md`: zero-touch loop, decision table "tự tiếp tục / phải dừng", ask budget một blocker message, cấu hình `autonomy` và luật sở hữu process/dữ liệu.
- `autonomy.mode: relaxed | guarded` trong `.testagent.yaml`, cùng `auto_start_dev_server`, `auto_install_dependencies` và `max_heal_attempts`.
- Auto-login hỗ trợ form hai bước `username → Tiếp tục → password` và tự dùng `TEST_TOTP_SECRET` khi trang yêu cầu TOTP.
- Regression coverage bằng browser thật cho session/form render trễ, TOTP, form hai bước và trang có business-code input.
- Installer và tài liệu hỗ trợ tường minh cả Codex (`--codex`) lẫn Claude Code (`--claude`) ở phạm vi global/project/custom, gồm cả force-update và uninstall.
- Contract ý định tổng quát: prompt `URL + test feature/màn hình` tự mở rộng thành browser → auto-login → explore → plan → generate → execute/heal → report; không hard-code sản phẩm mẫu.

### Changed

- `relaxed` là mặc định cho local/dev/QA/staging/UAT: Agent tự resolve config, dùng/gia hạn phiên, tự duyệt plan an toàn, scaffold/cài dependency cần thiết, execute → heal → re-run và cleanup đúng record do lượt test tạo.
- `CONFIRM` trở thành decision record: `agent-self-approved (relaxed)` hoặc user approval ở ranh giới rủi ro, thay vì luôn là một vòng chờ.
- `auth-login.mjs` mặc định là lệnh ensure idempotent; pipeline chỉ gọi một lần, không cần `--check || login`. Output không còn in username hay một phần mật khẩu.
- Auth helper chờ đúng auth surface trên SPA thay vì kiểm ngay sau `DOMContentLoaded`, và chỉ nhận selector OTP đặc hiệu để không nhầm `promoCode`/`postalCode`.
- `explore.mjs` bỏ các cờ inline `--username`/`--password`/`--save-auth`; phiên phải được tạo an toàn bằng `auth-login.mjs` rồi nạp qua `--auth`.
- Installer Codex global ghi đúng vào `$CODEX_HOME/skills` (fallback `~/.codex/skills`) thay vì `~/.agents/skills`; cài theo dự án vẫn dùng `.agents/skills` và installer cảnh báo nếu còn bản global legacy.
- Runtime tối thiểu tăng từ Node 18 lên Node 20 để khớp toolchain Playwright 1.62.1 của bản phát hành.
- VERDICT tự ghi target config nếu không xung đột và không hỏi hai câu hành chính ở cuối lượt.

### Safety

- `relaxed` không cấp thêm quyền và không hạ chất lượng test. Production vẫn read-only khi chưa có quyền cụ thể; tiền/gửi ra ngoài/gateway chưa xác minh, dữ liệu người khác, CAPTCHA/MFA người dùng và secret còn thiếu vẫn là hard gate.
- Agent chỉ được tự xoá exact ID mang dấu `AUTOTEST-` do chính lượt chạy tạo và chỉ dừng server/process do chính nó khởi động.
- Auth helper che username, password, TOTP secret và mã OTP sinh ra khỏi cả lỗi Playwright lẫn thông báo lỗi do app echo; URL log bị bỏ userinfo/query/fragment.
- Helper tắt debug mode có thể log `fill(secret)`, từ chối trang xác minh trả HTTP 4xx/5xx và chỉ tin sidecar session khi nó thuộc đúng login target hiện tại.
- `install --force`/`uninstall` từ chối root/home/cwd/source repo và mọi target không có `SKILL.md` nhận diện đúng skill, tránh xoá nhầm thư mục tuỳ ý qua `--dir`.

## [2.5.0] — 2026-08-21

Bịt nốt lỗ hổng cuối của chuỗi 2.3–2.4: kiểm được topology rồi, bắc cầu phiên rồi, nhưng **phiên hết hạn nhanh hơn một lượt chạy** thì mọi thứ trên vẫn vô nghĩa. Gặp CMS đặt TTL 15–30 phút, "đăng nhập một lần trong profile" không cứu được và người dùng lại bị kéo vào vòng lặp gõ mật khẩu.

### Added

- Mục **"Phiên hết hạn nhanh hơn một lượt chạy"** trong `SKILL.md` và `auth-and-data.md`, ba cách theo thứ tự nên thử:
  - **Trình quản lý mật khẩu của Chrome** điền hộ — biến "gõ mật khẩu" thành "bấm một nút", mà nút thì agent bấm được. Mật khẩu không đi qua agent, không qua hội thoại, không nằm trong `.env`: nó ở trong password manager, đúng chỗ của nó.
  - **Kéo dài TTL ở nguồn** — tick "Ghi nhớ đăng nhập", hoặc xin BE/DevOps nâng session TTL trên staging, hoặc tài khoản service TTL dài.
  - **Đổi sang Playwright MCP + `--storage-state`** — phiên chết thì chạy lại một lệnh, không gõ tay.
- Luật mới: **TTL ngắn phải được báo lên như một finding về môi trường**, đưa vào mục ngoài phạm vi / bị chặn kèm điều kiện mở khoá. Nó phá mọi lượt chạy dài (regression đầy đủ, bug race cần vài chục attempt) chứ không chỉ gây phiền, và nó ăn thời gian của mọi tester chứ không riêng agent.

Bản 2.4.x mặc định ngầm rằng phiên sống đủ lâu để "đăng nhập một lần" có nghĩa. Với môi trường TTL ngắn thì giả định đó sai, và bản này nói rõ ra.

## [2.4.1] — 2026-08-21

### Fixed

- Bảng "bắc cầu bằng file phiên" ở 2.4.0 chỉ liệt kê ba cách của Playwright MCP, bỏ sót ca phổ biến nhất: **agent lái Chrome thật của người dùng**. Với Chrome thật thì không cần file phiên gì cả — đăng nhập một lần trong chính profile đó là xong, phiên sống qua nhiều lượt. Đưa nhầm ba lệnh MCP cho ca này sẽ khiến người dùng loay hoay với thứ không áp dụng được.
- Thêm bước xác định agent đang lái Playwright MCP hay Chrome thật trước khi chọn cách nạp phiên.

## [2.4.0] — 2026-08-21

Vá một giả định sai của 2.3.0: `auth-login.mjs` chỉ giải quyết được khi **runtime chạy script của agent cũng là nơi tới được target**. Agent chạy trong container bị chặn egress vẫn lái được trình duyệt trên máy người dùng — script thì không tới được staging, còn trình duyệt thì tới được. Bản 2.3.0 nhầm hai thứ đó là một, nên trong topology này nó vẫn bắt người dùng đăng nhập tay từng lượt.

### Added

- **Kiểm topology trước khi bàn chuyện đăng nhập.** Một lệnh `curl --max-time 8 <target>` chạy từ runtime agent, rồi phân ba nhánh: runtime tới được → `auth-login.mjs` thẳng; runtime tắc nhưng trình duyệt mở được → bắc cầu file phiên; cả hai tắc → `Blocked` kèm điều kiện mở khoá. Nêu rõ: đừng suy ra topology từ cảm giác.
- **Bắc cầu bằng file phiên.** Thứ đi qua ranh giới là file `storageState`, không phải kết nối mạng. Người dùng chạy `auth-login.mjs` một lần trên máy mình, rồi nạp vào trình duyệt agent lái bằng một trong ba cách của Playwright MCP:
  - `--storage-state .auth/<target>.json` — mọi tab agent mở đều đã đăng nhập
  - `--user-data-dir <profile>` — đăng nhập một lần trong profile, sống qua nhiều phiên
  - `--caps=storage` + tool `browser_set_storage_state` — nạp giữa chừng khi cần đổi role
  Sau bước một-lần đó agent không phải nhờ người dùng đăng nhập nữa, kể cả lượt cần soi DOM/network trực tiếp.

### Changed

- Mục "Đăng nhập: tự động, không hỏi" trong `SKILL.md` ghi rõ nó chỉ áp cho nhánh runtime-tới-được-target, thay vì ngầm định mọi môi trường.
- `live-browser-investigation.md` thêm luật kiểm topology vào phần an toàn: đừng bảo người dùng chạy script rồi tưởng là xong.

`storageState` do `auth-login.mjs` sinh ra đúng định dạng Playwright nên nạp thẳng vào Playwright MCP được. Ba tuỳ chọn CLI ở trên đối chiếu từ README chính thức của `microsoft/playwright-mcp`; phần chạy thật qua MCP chưa kiểm được trong môi trường này.

## [2.3.0] — 2026-08-21

Đăng nhập trở thành việc của agent, không phải của tester. Trước bản này skill dừng ở ô mật khẩu và bắt người dùng gõ tay mỗi lượt — vừa phá luồng tự động, vừa không giải quyết được gì về bảo mật.

### Added

- **`scripts/auth-login.mjs`** — đăng nhập tự động, lưu `storageState`, dùng lại cho mọi lượt sau. Đọc credential từ `.env` hoặc biến môi trường; agent chỉ truyền **tên biến**, không bao giờ đọc giá trị mật khẩu.
  - **Tự dò form** theo nhãn/role/type, chạy được ngay trên phần lớn trang đăng nhập mà không cần khai selector. Dò sai thì `--user-selector` / `--pass-selector` / `--submit-selector`.
  - **`--check`** trả exit 0/3 để pipeline biết có cần đăng nhập lại không — đây là thứ biến đăng nhập từ "mỗi lượt một lần" thành "một lần cho cả tuần".
  - **TOTP 2FA** tự cài theo RFC 6238 (HMAC-SHA1, không thêm dependency), qua `--totp-env`. Đã kiểm với cả 4 test vector SHA-1 chính thức của RFC.
  - **Xác minh sau khi lưu**: mở lại bằng context sạch để chứng minh phiên dùng được thật, thay vì tin là "file đã tồn tại".
  - **Sidecar `.meta.json`** nhớ trang đích sau đăng nhập, để lần kiểm sau xác minh đúng chỗ.
  - Che mật khẩu trong mọi output; bắt và hiển thị thông báo lỗi của app khi sai credential.
- Mục **"Đăng nhập: tự động, không hỏi"** trong `SKILL.md` (bước EXPLORE), kèm bảng xử lý cho SSO, nhiều role, 2FA và OTP SMS.
- `TEST_TOTP_SECRET` trong `_env.example` của khung scaffold.

### Changed

- **Gỡ luật "không tự điền mật khẩu"** khỏi `SKILL.md`, `live-browser-investigation.md` và `auth-and-data.md`. Thay bằng: **đăng nhập tự động, nhưng agent không cầm mật khẩu.** Ba điều cấm giữ nguyên tinh thần bảo mật cũ mà không chặn tự động hoá — không hỏi mật khẩu trong hội thoại (transcript được lưu), không truyền qua tham số dòng lệnh (nằm trong `ps` và shell history), không hard-code trong spec.
- Ví dụ pipeline trong `SKILL.md` đổi bước EXPLORE từ "dừng ở ô mật khẩu, nhờ người dùng nhập" thành "`--check` → hết phiên → tự đăng nhập bằng `.env`".

### Fixed

- Tuỳ chọn `--env-file` xung đột với cờ CLI cùng tên của Node — Node ≥20 nuốt nó kể cả khi đứng sau tên script, làm process thoát mã 9 trước khi script chạy. Đổi thành `--env`.
- README kẹt ở "Phiên bản hiện tại: 2.1.0" từ lần phát hành 2.2.0.

Đã chạy thật trên SauceDemo: tự dò form không cần selector, đăng nhập, xác minh trên `/inventory.html`, lượt sau bỏ qua đăng nhập; sai mật khẩu báo đúng thông báo của app và thoát mã 1.

## [2.2.0] — 2026-08-20

Đối chiếu với một file test case thật đang dùng trong dự án (mẫu **KBKTCN — Kịch bản kiểm thử chức năng**) và bổ sung template + sửa parser cho khớp. Mẫu này khác hẳn mẫu UAT phẳng mà `excel_to_spec.py` được viết cho: có sheet tổng hợp, khối metadata, dải tiêu đề ba dòng gộp ô, dòng phân suite, và cột ID là công thức.

### Added

- **`assets/testcase-template/KBKTCN.xlsx`** — template trắng đúng cấu trúc KBKTCN: sheet `Tổng hợp` với bộ đếm liên kết sang sheet chi tiết, khối metadata (tên màn hình, tiền tố mã, đếm Manual/Automation), dải tiêu đề ba dòng, dòng nhóm `SUITE …` + dòng suite, dropdown `P/F/PE` phủ **toàn bộ** cột kết quả, dropdown ưu tiên và mức độ nghiêm trọng, một dòng ví dụ và chú thích ô cần điền.
- **Bộ đếm là công thức, không phải số cứng** — `COUNTIF` theo cột `Kết quả test (M)` và `(AT)`, tự cập nhật khi tester điền kết quả.
- **`excel_to_spec.py` nhận diện thêm 4 cột KBKTCN**: `Mục đích kiểm thử`, `Thứ tự ưu tiên`, `Mức độ nghiêm trọng`, `ID BUG`. Ưu tiên đổi thành tag Playwright (`HIGH/HIGHEST → @p0`, `MEDIUM → @p1`, còn lại `@p2`) để lọc bằng `--grep @p0`.
- **Dòng suite thành `test.describe` lồng nhau**, giữ đúng cấu trúc `SUITE GIAO DIỆN › Suite 1: …` trong report.
- **Tự đọc tiền tố mã** từ ô `Mã trường hợp kiểm thử` trong khối metadata — khỏi truyền `--id-prefix` bằng tay.
- **Soát mã test case** (`audit_ids`): cảnh báo mã trùng và dãy mã bị thủng, kèm gợi ý nguyên nhân là công thức `COUNTBLANK` trôi tham chiếu.

### Fixed

- **Sheet tổng hợp bị đọc thành test case.** Sheet không có cột kết quả mong đợi giờ bị bỏ qua — trước đây nó sinh ra các ca rác kiểu `Total — Total`.
- **Dải tiêu đề ba dòng bị đọc thành test case.** Sau khi bung ô gộp, dòng 16–17 mang lại giá trị của dòng 15 nên vẫn khớp bộ nhận diện cột; thêm `header_band_end()` để bỏ trọn dải.
- **Dòng suite bị đọc thành test case ma.** Ô gộp ngang `C:G` làm cả năm cột nội dung mang cùng một chuỗi, nên nhãn suite bị hiểu thành "kết quả mong muốn"; thêm `section_label()` nhận diện và chuyển chúng thành `describe`.
- **Hai test case trùng mã bị gộp làm một, nuốt mất một ca.** Logic "trùng ID dòng trước = dòng tiếp nối" vốn để xử lý ô gộp dọc, nhưng gặp mã trùng do lỗi công thức thì làm mất dữ liệu. Giờ chỉ gộp khi dòng đó không có tiêu đề riêng.
- **Số dòng Excel trong `test-map.json` lệch 1.**

Trên file thật (113 test case): trước bản này đọc ra 115 mục — gồm 2 ca rác từ sheet tổng hợp, 1 ca rác từ dải tiêu đề, và **thiếu 1 ca thật** do gộp nhầm mã trùng. Sau bản này: đúng 113 ca, 9 suite, kèm cảnh báo mã `QLĐH_31` trùng ở dòng 50–51 và dãy mã thủng số 34.

## [2.1.0] — 2026-08-20

Review lại độ phủ của việc apply `aidlc-testagent` sau 2.0.0 và bù các phần còn thiếu. Trọng tâm: **manual explore mode** — tính năng chủ lực của aidlc v0.6.0 mà 2.0.0 bỏ sót hoàn toàn — cùng ba việc làm skill dễ dùng hơn.

### Added

- **`references/explore-artifacts.md`** — định nghĩa cái gì được ghi, ghi ở đâu, dùng lại thế nào. Thư mục chuẩn `.testagent/<target>/` gồm `journey.md`, `test-plan.md`, `checkpoints/`, `use-cases/`, `network/*.har`.
- **Ghi use case → sinh tài liệu test case thủ công.** Người dùng đi một luồng nghiệp vụ trọn vẹn, agent viết ra tài liệu theo đúng format `Pre` / bước / `KQMM` / tiêu chí pass — thứ tester vẫn phải ngồi gõ tay. Bốn luật đi kèm: chỉ viết những gì đã quan sát, KQMM lấy từ nguồn hạng cao chứ không từ màn hình, giữ nguyên exact UI copy nhưng che PII, dùng đúng từ vựng của team.
- **Điểm chốt (checkpoint)** — trạng thái nhiều scenario dùng chung ("đã đăng nhập", "đã có đơn nháp") ghi riêng ra để PLAN tham chiếu bằng `Phụ thuộc:` và GENERATE dựng lại bằng `storageState`, thay vì lặp chuỗi click ở mọi test.
- **`.testagent.yaml`** — config target ở gốc repo (url, auth, grounding theo thứ tự tin cậy, scope, success, output_dir, allow_hosts). Bước FRAME đọc file này trước khi hỏi bất cứ điều gì; có file rồi thì FRAME rút xuống một câu xác nhận. Ba luật: không bao giờ đặt giá trị credential vào đây, `allow_hosts` là cổng an toàn chứ không phải tiện ích, `success` là hợp đồng của bước VERDICT.
- **Luật dùng lại / explore lại.** Bảng năm dấu hiệu bắt buộc phải explore lại (đổi build, đang verify fix, spec fail ở HEAL, đổi role/môi trường/data class, journey quá 7 ngày). Mỗi lần dùng lại artefact cũ phải khai trong VERDICT — kết luận dựa trên journey tuần trước và dựa trên quan sát vừa xong là hai mức tin cậy khác nhau.
- **Thu hẹp phạm vi ở bước PLAN** khi target quá lớn: theo một file requirement, theo `scope.feature`, hoặc theo `git diff --name-only <base>`. Cách thứ ba khai rõ là ước lượng best-effort và phải liệt kê file nào không map được sang màn hình nào.
- **Mục "Một lượt chạy trông thế nào"** trong `SKILL.md` — một lượt hoàn chỉnh từ FRAME tới VERDICT trên ví dụ cụ thể, cho thấy câu trả lời tới ở bước 1 còn sản phẩm tới ở bước 7, và **test đỏ là kết quả đúng khi app sai**.
- **Mục lục cho `SKILL.md`** (các reference đã có sẵn từ trước).
- `.testagent/` thêm vào `_gitignore` của khung scaffold và `.gitignore` của repo skill, kèm ghi chú rằng tài liệu use case và test-plan nên chuyển ra `docs/` để commit chứ đừng bỏ ignore cả thư mục.

### Changed

- Bước **EXPLORE** đổi từ danh sách "giữ lại gì" thành bảng ba cột **giữ lại → ghi vào đâu → dùng ở bước nào**, kèm ba lưu ý hay bị bỏ (login trả 204 chứ không phải 200, `ref` chết theo phiên nên phải ghi `role + name`, cây accessibility quy thẳng thành `toMatchAriaSnapshot`).
- Mẫu **VERDICT** thêm dòng `EXPLORE` (quan sát mới hay dùng lại artefact), `Suite gate` (`--grep-invert @quarantine`) và `Artefact`. Kết thúc lượt phải hỏi người dùng hai việc: có ghi `.testagent.yaml` không, và có chuyển tài liệu use case ra `docs/test-cases/` không — agent không tự chuyển file ra khỏi `.testagent/`.
- Bảng định tuyến thêm hai dòng: "ghi lại luồng này / viết hộ test case" và "chỉ test phần vừa sửa".
- Checklist thêm ba mục: VERDICT khai rõ nguồn quan sát, lệnh chạy suite gate, và hỏi trước khi chuyển artefact.

## [2.0.0] — 2026-08-20

**Breaking change.** Pipeline của [`aidlc-io/aidlc-testagent`](https://github.com/aidlc-io/aidlc-testagent) trở thành **điều kiện bắt buộc** của skill, không còn là năng lực tuỳ chọn. Trước 2.0, skill mặc định dừng ở lượt quan sát trực tiếp và chỉ viết spec khi qua cổng CODIFY. Từ 2.0, mọi yêu cầu kiểm thử đều chạy đủ tám bước và kết thúc bằng bộ test commit được.

### Changed — BREAKING

- **Gỡ cổng CODIFY** (`LẶP` / `NHỊP` / `SỐ` / `QUYỀN` / `YÊU CẦU`). Không còn điều kiện nào để được phép không viết test.
- **Gỡ nguyên tắc "Không có file spec KHÔNG phải là chưa hoàn thành"** (đưa vào ở 1.3.0). Thay bằng: **chưa có test chạy được là chưa xong**. Bằng chứng trực tiếp giờ là *bằng chứng*, không phải *sản phẩm bàn giao*.
- **Ba pha FRAME → LIVE → CODIFY trở thành pipeline tám bước** `FRAME → EXPLORE → PLAN → CONFIRM → GENERATE → EXECUTE → HEAL → VERDICT`, với bốn luật: không bước nào tuỳ chọn · không đảo thứ tự · bỏ bước phải khai báo `Blocked` kèm điều kiện mở khoá · chưa có test chạy được là chưa xong.
- **Bug log gộp vào cùng xương sống**, không còn protocol song song. `Decode → Reproduce → Classify → Verify` ánh xạ thành EXPLORE/PLAN/EXECUTE/VERDICT của cùng pipeline. Regression spec cho bug trở thành đầu ra **bắt buộc**; bug chưa tái hiện được vẫn để lại spec `test.fixme` kèm bước và oracle đã biết.
- **PLAN không còn điều kiện kích hoạt.** 1.5.0 chỉ lập plan khi "phải viết nhiều hơn một spec"; 2.0 lập plan cho mọi lượt — yêu cầu nhỏ nhất thì plan có một scenario chốt lại đúng điều vừa quan sát.
- **Câu hỏi "chạy một lần hay chạy lại lâu dài" bị bỏ khỏi bước FRAME.** Thay bằng câu hỏi *nơi đặt test*: repo đã có khung Playwright chưa, spec nên nằm ở thư mục nào.
- **`references/project-setup.md`**: mục "Khi nào mới scaffold" (bốn điều kiện) thay bằng "Scaffold hay dùng khung có sẵn" — câu hỏi không còn là *có nên dựng khung không* mà là *dựng mới hay viết vào khung có sẵn*.
- Mọi reference đổi khung tham chiếu từ "chế độ mặc định / vùng bắt buộc spec" sang tên bước trong pipeline: `live-browser-investigation.md` là bước EXPLORE (và công cụ chẩn đoán của HEAL), `test-plan-and-traceability.md` là PLAN + VERDICT, `ui-e2e.md` là GENERATE, `troubleshooting.md` là HEAL, `reporting-ci.md` là sau VERDICT.
- `agents/openai.yaml` và mô tả gói đổi theo: prompt mặc định giờ yêu cầu chạy đủ pipeline thay vì "chỉ viết test khi tôi nhờ".

### Added

- **Ngoại lệ được khai báo rõ**: người dùng **nói rõ** không muốn file thì agent dừng sau bước chạy tay và ghi `Codify skipped — theo yêu cầu người dùng` vào verdict. Đây là ngoại lệ duy nhất, và agent không bao giờ tự quyết.
- **"Trả lời sớm, chốt muộn"**: EXPLORE báo *kết luận sơ bộ* ngay khi có, để tester không phải chờ hết pipeline; verdict chính thức vẫn chỉ có ở bước 7.
- **Đầu ra bắt buộc của EXPLORE** thành bảng: nhật ký hành trình · cây accessibility tại điểm chốt · endpoint + status · `storageState` · HAR — kèm cột nói rõ mỗi thứ đi vào bước nào.
- **Bảng "Kịch bản cần năng lực chỉ spec mới có"** thay cho bảng "Thao tác tay KHÔNG làm được". Cùng nội dung, đổi vai trò: nó không còn là cổng cho phép viết file, mà là lời nhắc đừng cắt những scenario này khỏi PLAN.
- Checklist gộp lại thành bốn nhóm theo pipeline: A. Pipeline · B. Test bàn giao · C. Bằng chứng và an toàn · D. Thêm cho bug log.

## [1.5.0] — 2026-08-20

Rút ra từ việc đọc [`aidlc-io/aidlc-testagent`](https://github.com/aidlc-io/aidlc-testagent) — một AI test agent tự sinh/chạy/heal bộ E2E. Skill này không đổi mục tiêu (vẫn LIVE-first, vẫn cho tester), nhưng lấy về những kỷ luật mà bên đó đã hình thức hoá và skill còn thiếu.

### Added

- **`references/test-plan-and-traceability.md`** — thứ tự tin cậy của nguồn, kế hoạch có tầng `setup → smoke → core → edge → teardown`, bảng plan để người dùng duyệt, ma trận truy vết hai chiều, phần "ngoài phạm vi" bắt buộc, definition of done và mẫu verdict.
- **Thứ tự tin cậy của nguồn** ở Pha 0: SRS/acceptance criteria → test case thủ công → quy tắc nghiệp vụ → source code → quan sát app đang chạy. Kèm hai luật: **app đang chạy không phải oracle** (chưa có acceptance criterion thì ghi `Unknown` rồi hỏi, đừng đóng băng hành vi hiện tại thành `expect`), và **ý định lệch hiện thực thì báo, đừng lặng lẽ viết theo code**.
- **Chốt kế hoạch trước khi viết spec** ở Pha 2, khi phải viết nhiều hơn một spec: trình bảng scenario có tầng, ưu tiên, truy vết và phần ngoài phạm vi để người dùng duyệt — sửa một dòng bảng rẻ hơn sửa mười file. Kèm luật **một scenario, một file spec**.
- **Cổng ổn định cho test mới**: `--repeat-each=3 --workers=1 --retries=0`, chỉ nhận vào suite khi cả ba lượt pass; ca lẫn lộn bị tách `@quarantine` kèm tỷ lệ quan sát được. Nêu rõ `retries` giấu flaky chứ không sửa flaky. Ghi rõ cổng này **không** áp cho baseline race/intermittent — nhóm đó vẫn đo `x/y`.
- **Luật chữa test gãy**: mở lại trang thật, đi đúng bước đang fail, đọc DOM hiện tại rồi mới sửa. Hai luật cứng — không hạ chuẩn assertion để test xanh, và trả lời "app đổi hay app hỏng" trước khi động vào code. Bảng phân nhánh đầy đủ trong `references/troubleshooting.md`.
- **Playwright MCP làm đường khôi phục Pha 1**: host chạy được lệnh mà thiếu công cụ browser thì cắm `npx @playwright/mcp@latest` trước, chỉ khi không cắm được mới hạ xuống `scripts/explore.mjs`. Trước đây skill nhảy thẳng sang script trinh sát và mất luôn chế độ LIVE.
- **Giữ lại lượt LIVE**: bảng bốn thứ nên chốt trước khi đóng trình duyệt (nhật ký hành trình, cây accessibility tại điểm chốt, `storageState`, HAR) và chúng đi tiếp vào đâu ở Pha 2.
- **`toMatchAriaSnapshot`** trong `references/ui-e2e.md` — chốt cả cấu trúc màn hình thay vì từng phần tử, bền hơn `toHaveScreenshot` vì bám role + tên chứ không bám pixel.
- **HAR như bằng chứng bug** trong `references/bug-reproduction.md`: DEV mở thẳng bằng DevTools mà không cần dựng lại môi trường; kèm cảnh báo che secret trước khi đính kèm.

### Changed

- **Luật an toàn** thêm hai mục: host chỉ được coi là staging khi là `localhost`/IP nội bộ, tên có `staging`/`stg`/`test`/`qa`/`dev`/`uat`, hoặc người dùng nói rõ — còn lại mặc định coi như production; và **dừng lại trước động từ phá huỷ** (xoá, thanh toán/chuyển tiền, gửi đi, huỷ đăng ký, vô hiệu hoá, ghi đè dữ liệu người khác) kể cả trên staging, ưu tiên tự tạo dữ liệu nháp rồi phá dữ liệu đó.
- **Mẫu báo cáo** thêm dòng `Oracle` (đã dựa vào nguồn nào), mục **ngoài phạm vi** bắt buộc, và một dòng **verdict** `PASS`/`FAIL` bằng con số đo được khi có chạy cả bộ.
- Checklist B: thay "chạy được hai lần liên tiếp đều pass" bằng cổng ổn định ba lượt + quarantine, thêm mục giữ nguyên ý định assertion và mục mỗi spec phải truy vết được về một requirement/mã test case.
- Bảng định tuyến thêm một dòng cho "cần test những gì / đưa SRS + test case hỏi phạm vi / bộ test đã phủ đủ chưa".

## [1.4.1] — 2026-08-18

### Fixed

- Sửa nhận định sai ở 1.4.0: mục "Chọn trình duyệt" coi bộ công cụ tên có chữ "chrome" là đang lái Chrome thật của người dùng. Thực tế còn tuỳ cấu hình host — gặp ca một bộ như vậy đang lái Chromium của Playwright, chạy headless, `--user-data-dir` trỏ vào `Temp`, kèm `--ignore-certificate-errors`: không có cửa sổ để người dùng nhìn, không có session nào của họ, và qua được site cert hỏng nhờ cờ dòng lệnh chứ không nhờ ngoại lệ đã lưu.

### Changed

- Đổi mục thành **"Chọn trình duyệt: xác minh trước, đừng tin tên công cụ"**, thêm bước kiểm dòng lệnh tiến trình (Windows + macOS/Linux) và bảng ba dấu hiệu nhận biết: đường dẫn binary (`ms-playwright`, `puppeteer`, `.cache/chromium`), `--user-data-dir` trỏ `Temp`/`tmp`, và `--headless` / `MainWindowHandle = 0`.
- Bắt buộc nói rõ trong báo cáo đã chạy trên profile thật hay profile tạm — "đăng nhập được" trên hai loại là hai kết luận khác nhau.
- Cạm bẫy cert giờ nêu **cả hai chiều**: chặn thẳng (`navigation denied` cho cả server chết, DNS sai lẫn cert hỏng) và âm thầm bỏ qua (`--ignore-certificate-errors` vào tuốt → không được kết luận "cert bình thường").

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

[1.4.1]: https://github.com/DEVfancybear/playwright-automation/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/DEVfancybear/playwright-automation/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/DEVfancybear/playwright-automation/compare/v1.1.0...v1.3.0
[1.2.0]: https://github.com/DEVfancybear/playwright-automation/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/DEVfancybear/playwright-automation/releases/tag/v1.1.0
[1.0.0]: https://github.com/DEVfancybear/playwright-automation/releases/tag/v1.0.0

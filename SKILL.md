---
name: playwright-automation
description: Test agent cho tester/QA — chạy pipeline bắt buộc explore → plan → duyệt → sinh spec → chạy (cổng ổn định) → heal → verdict; mọi lượt trả về test Playwright + TypeScript commit được kèm verdict có số. Dùng khi muốn kiểm tra trang đang chạy, console/network báo gì, nhờ bấm thử một luồng, đọc bug log/issue sheet, hiểu KQMM/KQTT/EVD, xử lý log dài, luồng stateful nhiều màn hình/tab/role, bug chỉ ra khi thao tác nhanh/liên tục hoặc có race, tái hiện bug trước khi DEV sửa, verify/retest sau fix trên STG/UAT/prod, phân biệt lỗi code với config/data/infra, dựng framework, lập kế hoạch test từ SRS/test case và chứng minh độ phủ, test E2E/API/visual/responsive/accessibility, mock API, chuyển Excel thành script, xử lý flaky, tích hợp CI/CD. Cũng kích hoạt khi nhắc Playwright, Selenium, Cypress, E2E, POM, smoke/regression, reproduce bug, dev đã fix, race/flaky/intermittent, test tự động, kế hoạch test, độ phủ/traceability, hoặc đưa link/localhost kèm yêu cầu kiểm tra, tiếng Việt hoặc Anh.
---

# Playwright Test Agent cho Tester

Skill này không trả lời bằng cảm nhận và không dừng lại ở một ảnh chụp màn hình. **Mọi yêu cầu kiểm thử** — từ "xem hộ trang này lỗi gì" tới cả một workbook bug log — đều chạy qua **cùng một pipeline tám bước**, và kết thúc bằng hai thứ:

1. **Một bộ test `@playwright/test` + TypeScript commit được vào repo.**
2. **Một verdict có số** — không phải "hầu hết đều ổn".

Đối tượng dùng skill này thường là tester thủ công đang chuyển sang automation. Họ biết rất rõ *nghiệp vụ cần test gì*, nhưng chưa chắc rành *selector, async, CI*. Vì vậy: giải thích ngắn gọn bằng tiếng Việt, trình bảng kế hoạch cho họ duyệt trước khi sinh code, và nói rõ cách chạy lại bộ test bàn giao.

Mục lục: [Pipeline](#pipeline-bắt-buộc) · [Một lượt chạy trông thế nào](#một-lượt-chạy-trông-thế-nào) · [Định tuyến](#bước-1--định-tuyến) · [0 FRAME](#0--frame) · [1 EXPLORE](#1--explore) · [2 PLAN](#2--plan) · [3 CONFIRM](#3--confirm) · [4 GENERATE](#4--generate) · [5 EXECUTE](#5--execute) · [6 HEAL](#6--heal) · [7 VERDICT](#7--verdict) · [An toàn](#luật-an-toàn) · [Chống flaky](#7-nguyên-tắc-để-test-không-flaky) · [Chạy & debug](#chạy-và-debug) · [Checklist](#checklist-trước-khi-coi-là-xong) · [Bản đồ tài liệu](#bản-đồ-tài-liệu)

## Pipeline bắt buộc

```
0. FRAME    → chốt target, build/môi trường, role/state, nguồn grounding
1. EXPLORE  → mở app THẬT bằng công cụ browser, quan sát. Không đoán, không nhớ.
2. PLAN     → bảng scenario có tầng + truy vết + phần ngoài phạm vi
3. CONFIRM  → trình bảng cho người dùng duyệt
4. GENERATE → spec + Page Object commit được, một scenario một file
5. EXECUTE  → chạy qua cổng ổn định (N lượt, flaky bị quarantine)
6. HEAL     → fail thì quay lại trình duyệt thật, re-observe, sửa, chạy lại
7. VERDICT  → PASS/FAIL kèm số ca — hoặc Reproduced / Verified fixed với bug log
```

**Bốn luật của pipeline:**

| Luật | Nghĩa là |
|---|---|
| **Không bước nào tuỳ chọn** | Kể cả câu hỏi nhỏ nhất cũng đi đủ tám bước. "Câu này đơn giản, khỏi lập plan" không phải lý do hợp lệ |
| **Không đảo thứ tự** | Không sinh code trước khi EXPLORE. Không chạy trước khi CONFIRM. Không kết luận trước khi EXECUTE |
| **Bỏ bước phải khai báo** | Bị chặn thật (thiếu build, thiếu tài khoản, guardrail production) thì ghi vào VERDICT là `Blocked` kèm lý do và điều kiện mở khoá — không im lặng bỏ qua |
| **Chưa có test chạy được = chưa xong** | Ảnh chụp và log console là *bằng chứng*, không phải *sản phẩm bàn giao* |

**Ngoại lệ duy nhất**: người dùng **nói rõ** không muốn file. Khi đó dừng sau EXECUTE-bằng-thao-tác-tay, và ghi trong verdict `Codify skipped — theo yêu cầu người dùng`. Ngoại lệ này do người dùng nói ra, agent không bao giờ tự quyết.

**Trả lời sớm, chốt muộn.** EXPLORE thường đã đủ để biết app đúng hay sai. Báo kết luận sơ bộ đó ngay khi có, đừng bắt tester chờ hết pipeline — nhưng gọi nó đúng tên là *kết luận sơ bộ*. Verdict chính thức chỉ có ở bước 7, sau khi đã có test chạy qua cổng ổn định.

## Một lượt chạy trông thế nào

Người dùng nói: *"Test giúp tôi luồng đặt hàng ở https://staging.example.com, tài khoản qa_user01."*

```
0 FRAME     Đọc .testagent.yaml → có target "checkout-staging" rồi. Xác nhận một dòng.
            Grounding: docs/requirements/checkout.md + test-cases/checkout.xlsx.

1 EXPLORE   auth-login.mjs --check → hết phiên → tự đăng nhập bằng .env (5s),
            rồi đi hết luồng: trang chủ → thêm giỏ → thanh toán → xác nhận.
            Ghi journey.md: URL, role+name từng element, endpoint + status.
            ⚠ Badge giỏ hàng chậm ~1,2 s. POST /api/auth/login trả 204 chứ không phải 200.

            → Báo ngay: "Luồng đặt hàng chạy được. Có một điểm nghi ngờ ở badge giỏ hàng
               (chậm ~1,2 s). Đây là kết luận sơ bộ, tôi chốt lại bằng test."

2 PLAN      5 scenario: auth-login(setup) · cart-badge(smoke) · checkout-happy(core)
            checkout-total(core) · checkout-no-postal(edge).
            Ngoài phạm vi: thanh toán thật (mock) · OTP SMS (không tự động được).

3 CONFIRM   Trình bảng. Người dùng cắt checkout-no-postal, thêm "giỏ hàng trống".

4 GENERATE  5 file spec + CheckoutPage.ts, locator lấy từ journey.md, không đoán.

5 EXECUTE   --repeat-each=3 --workers=1 --retries=0
            4 pass · cart-badge 7/10 → @quarantine.

6 HEAL      checkout-total đỏ: mở lại trang, đọc DOM → tổng lệch 1đ thật.
            Requirement nói tổng = tiền hàng + thuế ⇒ đây là BUG, giữ test đỏ.
            Không hạ assertion.

7 VERDICT   FAIL — 4 nhận, 1 fail (checkout-total, truy vết SRS §4.4, p0),
            1 tách vì flaky. Bàn giao e2e/tests/*.spec.ts. Lệnh chạy lại + report.
```

Điểm cần thấy: câu trả lời tới ở bước 1, sản phẩm tới ở bước 7, và **test đỏ là kết quả đúng** khi app sai.

## Bước 1 — Định tuyến

Pipeline không đổi; chỉ **nội dung từng bước** đổi theo loại yêu cầu. Đọc bảng này để biết mình đang chạy biến thể nào và mở đúng file `references/`. **Chỉ đọc file thật sự cần** — đọc hết sẽ làm loãng context.

| Người dùng nói gì | Biến thể | Đọc thêm |
|---|---|---|
| "Xem hộ trang này", "đang lỗi gì", "console/network báo gì", "bấm thử giúp", đưa link/localhost kèm câu hỏi | EXPLORE trả lời câu hỏi ngay; PLAN tối thiểu một scenario chốt đúng điều vừa quan sát để nó không tái phát | `references/live-browser-investigation.md` |
| "Test giúp chức năng X xem chạy đúng không" | Biến thể chuẩn, đủ tám bước | `references/live-browser-investigation.md`, `references/test-plan-and-traceability.md`, `references/ui-e2e.md` |
| "Đọc bug log", "reproduce bug", KQMM/KQTT/EVD, issue STG/UAT/prod | **Biến thể bug**: EXPLORE = decode row + evidence + recon · PLAN = fingerprint + kịch bản tái hiện · VERDICT = reproduction outcome. GENERATE sinh regression spec cho bug đó | `references/bug-reproduction.md` |
| "Verify fix", "xác nhận DEV đã fix", "retest để Close/Reopen" | Biến thể bug, target là build đã fix. Bắt buộc có baseline do chính agent tái hiện trước đó | `references/bug-reproduction.md`, mục **Verify bug sau khi DEV fix** |
| "Đọc kỹ" workbook bug nhiều tab | FRAME mở rộng: inventory cả visible/hidden tab + filtered row trước khi vào EXPLORE | `references/bug-reproduction.md` |
| Log dài; nhiều màn hình/tab/role; "ngay", "nhanh", "liên tục", double-click; race/intermittent | Biến thể race: PLAN có cadence matrix + attempt budget · EXECUTE đo `x/y` thay vì cổng ổn định | `references/bug-reproduction.md`, rồi `references/complex-flow-race-reproduction.md` |
| Đưa SRS/test case rồi hỏi phạm vi, "cần test những gì", "bộ test đã phủ đủ chưa" | Trọng tâm dồn vào PLAN: nạp nguồn theo thứ tự tin cậy, dựng ma trận truy vết | `references/test-plan-and-traceability.md` |
| "Dựng khung automation cho dự án" | GENERATE bắt đầu bằng `scripts/scaffold.mjs` | `references/project-setup.md` |
| "Ép token hết hạn / mất phiên / xoá cookie đăng nhập" | Cookie HttpOnly không xoá được bằng JS trong trang → oracle nằm ở spec: `context.clearCookies()` | `references/auth-and-data.md` |
| "Test API", "kiểm tra endpoint" | EXPLORE gọi `fetch` bằng session đang mở; GENERATE dùng `request` fixture | `references/api-testing.md` |
| "So sánh giao diện", "responsive" | EXPLORE đổi kích thước cửa sổ; GENERATE dùng `toHaveScreenshot` + projects đa viewport | `references/visual-responsive.md` |
| "Test accessibility", "WCAG" | EXPLORE soi cây accessibility; GENERATE dùng `@axe-core/playwright` | `references/accessibility.md` |
| "Giả lập API lỗi / mạng chậm / offline" | `page.route`, HAR | `references/network-mocking.md` |
| "Đăng nhập sẵn cho mọi test", "test nhiều role", "sao phải tự gõ mật khẩu" | `scripts/auth-login.mjs` ở EXPLORE, `storageState` + setup project ở GENERATE | `references/auth-and-data.md` |
| "Ghi lại luồng này", "viết hộ test case cho chức năng này", team chưa có tài liệu test case | EXPLORE ghi use case → sinh tài liệu `Pre` / bước / `KQMM` / tiêu chí pass, rồi tiếp tục pipeline như thường | `references/explore-artifacts.md` |
| "Chỉ test phần vừa sửa", đưa commit/branch | PLAN thu hẹp theo `git diff`, khai rõ đây là ước lượng best-effort | `references/test-plan-and-traceability.md` |
| "Chuyển file test case Excel thành script", "team chưa có file test case" | PLAN lấy thẳng từ Excel qua `scripts/excel_to_spec.py`; chưa có file thì nhân bản `assets/testcase-template/KBKTCN.xlsx` | `references/excel-to-spec.md` |
| "Chạy trên Jenkins/GitHub", "xuất report" | Sau VERDICT: cắm bộ test vào CI làm gate | `references/reporting-ci.md` |
| "Test bị lúc pass lúc fail", "local ok mà CI fail" | Trọng tâm dồn vào EXECUTE + HEAL | `references/troubleshooting.md` |
| "Đo tốc độ trang", "test hiệu năng / tải" | EXPLORE đo `performance.getEntriesByType('navigation')`; GENERATE dùng Lighthouse/k6 | `references/performance.md` |

Yêu cầu chạm nhiều mảng ("test luồng đặt hàng, có cả API và ảnh chụp") vẫn chỉ một pipeline: gom hết vào một PLAN, phân tầng và ưu tiên trong đó, đừng chạy ba pipeline song song.

---

## 0 — FRAME

Thu đủ điều kiện trước khi chạm vào app. Đầu ra của bước này là: **target + build/môi trường + role/state + nguồn grounding**.

**Đọc `.testagent.yaml` ở gốc repo trước khi hỏi bất cứ điều gì.** Nếu file đó đã có target khớp yêu cầu, bước FRAME rút xuống một câu xác nhận: *"Chạy trên target `checkout-staging` (staging.example.com, scope checkout) như config, đúng chứ?"*. Chưa có file thì hỏi như dưới, rồi **ghi lại thành config ở bước VERDICT** để lần sau khỏi hỏi lại. Cấu trúc file: `references/explore-artifacts.md`.

Nếu đầu vào là bug log/issue sheet, **không hỏi lại những gì row đã nói**. Đọc full row và evidence trước, chuẩn hóa thành environment/platform, precondition, test data/state, actions, actual, expected và unknown. Chỉ hỏi phần thật sự chặn: URL/build đích, tài khoản hoặc seed data an toàn, evidence nằm ngoài sheet, acceptance criterion còn mâu thuẫn. Xem `references/bug-reproduction.md`.

Nếu đầu vào là yêu cầu kiểm thử mới, chỉ hỏi những mục chưa có — đừng phỏng vấn dài dòng:

1. **URL** app cần test (staging/local/prod?) và có cần đăng nhập không → nếu có, xin tài khoản test.
2. **Phạm vi**: một chức năng, cả luồng nghiệp vụ, hay cả bộ regression?
3. **Nơi đặt test**: repo đã có khung Playwright chưa, hay cần dựng mới; spec nên nằm ở thư mục nào.

Câu hỏi "chạy một lần hay chạy lại lâu dài" **không còn được hỏi nữa** — đầu ra luôn là bộ test chạy lại được.

### Thứ tự tin cậy của nguồn

Khi nhiều nguồn cùng nói về một hành vi, chúng không ngang nhau. Xếp hạng: **SRS/acceptance criteria → test case thủ công (Excel, KQMM) → quy tắc nghiệp vụ → source code → quan sát app đang chạy**. Bốn hạng đầu nói *điều gì phải đúng*; hạng cuối chỉ nói *cách thao tác và định vị*.

Hai luật, áp dụng xuyên suốt pipeline:

- **App đang chạy không phải là oracle.** "Bấm ra như vậy" không chứng minh "như vậy là đúng". Không có nguồn hạng cao nào nói tới hành vi đang xét thì ghi `Unknown — chưa có acceptance criterion` rồi hỏi, đừng lấy hành vi hiện tại làm chuẩn rồi đóng băng nó thành `expect`.
- **Ý định lệch hiện thực thì báo, đừng lặng lẽ theo code.** Requirement nói tổng = tiền hàng + thuế mà màn hình trả lệch 1 đồng: đó là một finding, không phải con số để chép vào assertion. Viết assertion theo requirement, để test đỏ, rồi báo.

Nếu người dùng đưa file test case Excel/SRS, đọc file đó thay vì hỏi. Chi tiết: `references/test-plan-and-traceability.md`.

---

## 1 — EXPLORE

**Bắt buộc mở app thật.** Cấm lập plan từ trí nhớ, từ tài liệu, hoặc từ source code mà chưa nhìn màn hình. Đây là lý do số một khiến test tự sinh bị flaky: selector đoán ra từ tưởng tượng.

Công cụ browser điều khiển một trình duyệt thật và **giữ nguyên session giữa các bước**, nên đi được luồng nhiều màn hình mà không cần cài gì trước.

Năng lực cần dùng: điều hướng · đọc cây accessibility (mỗi element có `ref` — **đã là element có thật, không cần đoán selector**) · click/gõ/cuộn/chụp ảnh · điền form · chạy JS trong trang · đọc console · đọc network · đổi kích thước cửa sổ · quản lý tab. **Tên công cụ khác nhau tuỳ môi trường** (Claude Code, Codex, claude.ai, IDE…) — tra danh sách công cụ đang có rồi ánh xạ theo năng lực, đừng tìm đúng chữ. Nếu phải nạp công cụ trước khi dùng, nạp **một lượt duy nhất** cho cả bộ.

**Có nhiều bộ công cụ browser thì ưu tiên bộ mang profile thật của người dùng** — có sẵn phiên đăng nhập, ngoại lệ cert, proxy/DNS nội bộ. **Nhưng tên công cụ không cho biết nó lái cái gì**: một bộ tên có chữ "chrome" vẫn có thể là Chromium tự động hoá chạy headless với profile tạm và `--ignore-certificate-errors`. Xác minh bằng dòng lệnh tiến trình trước khi kết luận, và nói rõ trong báo cáo mình đã chạy trên cái nào.

Vòng quan sát: mở đúng URL người dùng nói → đọc cây để biết đang ở state nào → thao tác **đúng các bước tester mô tả, không rút gọn** → sau mỗi bước quan trọng đọc network + console + chụp ảnh → cần state phía server thì gọi API bằng chính session đang mở.

**Đọc `references/live-browser-investigation.md`** cho chi tiết: bảng năng lực đầy đủ, cách xác minh đang lái trình duyệt nào, quy đổi `role + name` → `getByRole`, luật điều hướng SPA, bốn kiểu hỏng im lặng (overlay che, tab mới, element ngoài viewport, dialog gốc), `ref` hết hạn sau mỗi lần DOM đổi, cách biết trang đã render xong khi không có `networkidle`, và giới hạn cookie HttpOnly.

### Ai tới được target? Kiểm trước khi bàn chuyện đăng nhập

**Runtime chạy script của agent và trình duyệt agent lái không phải lúc nào cũng cùng một máy.** Agent chạy trong container bị chặn egress vẫn lái được Chrome trên máy người dùng — script thì không tới được target, còn trình duyệt thì tới được. Nhầm hai thứ này là lý do khiến mọi hướng dẫn "chạy script đi" trở thành vô nghĩa.

Kiểm bằng một lệnh, **từ chính runtime của agent**:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" --max-time 8 <target-url>
```

| Kết quả | Topology | Đăng nhập thế nào |
|---|---|---|
| Ra mã HTTP (kể cả 401/403) | Runtime agent tới được target | `auth-login.mjs` chạy thẳng — tự động hoàn toàn, xem mục dưới |
| Timeout / DNS fail, **nhưng** trình duyệt agent lái mở được target | Runtime bị chặn egress, trình duyệt nằm phía người dùng | **Bắc cầu bằng file phiên** — xem mục ngay sau |
| Cả hai đều không mở được | Không tới được target | `Blocked`. Điều kiện mở khoá: mở egress tới host đó, hoặc chạy agent trên máy có VPN |

Đừng suy ra topology từ cảm giác — chạy `curl` rồi thử điều hướng trình duyệt tới target. Hai kết quả đó mới quyết định.

### Bắc cầu bằng file phiên (khi runtime agent bị chặn egress)

Thứ đi qua ranh giới là **file phiên**, không phải kết nối mạng. Agent không cần tới được target; chỉ trình duyệt cần.

Người dùng chạy **một lần** trên máy mình:

```bash
node scripts/auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json
```

Rồi nạp file đó vào trình duyệt agent lái — chọn một trong ba:

| Cách | Lệnh | Khi nào dùng |
|---|---|---|
| Nạp lúc khởi động MCP | `npx @playwright/mcp@latest --storage-state .auth/staging.json` | Gọn nhất; mọi tab agent mở đều đã đăng nhập sẵn |
| Profile bền | `npx @playwright/mcp@latest --user-data-dir ~/.pw-profile-staging` | Đăng nhập một lần trong profile đó, sống qua nhiều phiên, không cần file phiên |
| Agent tự nạp lúc chạy | `--caps=storage`, rồi gọi `browser_set_storage_state` | Khi cần đổi role giữa chừng một lượt |

Sau bước này agent **không phải nhờ người dùng đăng nhập nữa**, kể cả những lượt cần nhìn tận mắt DOM và network. Trước đó thì có: lượt đầu tiên vẫn cần người dùng chạy một lệnh.

Nếu trình duyệt cũng nằm trong container bị chặn thì không có cách nào cứu — đó là `Blocked` thật, đừng vòng vo.

### Đăng nhập: tự động, không hỏi

*(Áp dụng khi runtime agent tới được target — dòng đầu của bảng topology trên.)*

App cần đăng nhập thì **agent tự lo, không dừng lại bắt tester gõ mật khẩu**. Chạy đúng ba bước này trước khi thao tác gì khác:

```bash
# 1. Còn phiên cũ dùng được không? exit 0 = còn, khỏi đăng nhập lại.
node scripts/auth-login.mjs --url <trang login> --out .auth/<target>.json --check

# 2. Hết phiên (exit 3) thì đăng nhập lại. Credential đọc từ .env, agent không cầm.
node scripts/auth-login.mjs --url <trang login> --out .auth/<target>.json

# 3. Mở app bằng phiên đó và thao tác bình thường.
```

Script tự dò form theo nhãn/role, tự xác minh phiên dùng được thật (mở lại bằng context sạch), và nhớ trang đích để lần sau kiểm đúng chỗ. Chạy `--help` trước, không đọc source.

| Tình huống | Xử lý |
|---|---|
| `.env` chưa có `TEST_USER`/`TEST_PASS` | Script in ra đúng tên biến cần điền. Chuyển nguyên hướng dẫn đó cho người dùng, chờ họ điền vào **file** rồi báo lại. Tuyệt đối không hỏi mật khẩu trong hội thoại |
| Tên biến khác (`ADMIN_USER`, `QLDH_PASS`…) | `--user-env` / `--pass-env`, hoặc khai `credentials_env` trong `.testagent.yaml` |
| Dò sai form (SSO, nhiều bước, iframe) | Đọc cây accessibility lấy selector thật rồi truyền `--user-selector` / `--pass-selector` / `--submit-selector` |
| App bật 2FA bằng Authenticator | `--totp-env TEST_TOTP_SECRET` — script tự sinh mã TOTP |
| OTP qua SMS thật | Không tự động được. Ghi vào **ngoài phạm vi** và xin tài khoản test được miễn OTP — xem `references/auth-and-data.md` |
| Nhiều role | Mỗi role một file `.auth/<target>-<role>.json` |

`.auth/` chứa cookie thật — đã nằm sẵn trong `.gitignore` của khung scaffold. Không đính kèm vào ticket, không dán vào chat.

### Đầu ra bắt buộc của EXPLORE

EXPLORE là bước đắt nhất của pipeline — phải đăng nhập, đi wizard, chờ dữ liệu. Ghi lại để không phải trả cái giá đó mỗi lần:

| Giữ lại | Ghi vào | Dùng ở bước nào |
|---|---|---|
| **Nhật ký hành trình** — mỗi màn hình: URL, `role + name` element đã chạm, endpoint + status | `.testagent/<target>/journey.md` | PLAN (dựng scenario), GENERATE (biên `test.step`) |
| **Điểm chốt** — trạng thái nhiều scenario dùng chung ("đã đăng nhập", "đã có đơn nháp") | `.testagent/<target>/checkpoints/` | PLAN (`Phụ thuộc:`), GENERATE (`storageState`/`beforeEach`) |
| **Use case đã ghi** — một luồng nghiệp vụ trọn vẹn → tài liệu test case thủ công | `.testagent/<target>/use-cases/` | PLAN, GENERATE, **và bàn giao cho tester** |
| **Phiên đăng nhập** (`storageState`) | `.auth/<target>.json` (gitignored) | GENERATE — khỏi login lại qua UI |
| **HAR** khi có API liên quan | `.testagent/<target>/network/` | Bằng chứng nộp DEV, input cho `routeFromHAR` |

Ba lưu ý hay bị bỏ: endpoint login chỉ set cookie thường trả **204** chứ không phải 200 (chốt cứng `toBe(200)` là fail giả); `ref` chết theo phiên nên phải ghi `role + name`, không ghi `ref`; cây accessibility tại điểm chốt quy thẳng thành `toMatchAriaSnapshot`.

**Ghi use case là sản phẩm phụ đáng giá nhất.** Người dùng đi một luồng nghiệp vụ trọn vẹn → agent viết ra tài liệu test case thủ công của luồng đó theo đúng format `Pre` / bước / `KQMM` / tiêu chí pass. Tester nhận được thứ họ vẫn phải ngồi gõ tay. Chủ động đề nghị khi thấy một chuỗi bước tạo thành nghiệp vụ hoàn chỉnh.

**Dùng lại artefact cũ thay vì explore mới** khi cùng build, cùng role, chỉ bổ sung scenario cho vùng đã quan sát. **Bắt buộc explore lại** khi: đổi build, đang verify fix, spec fail ở bước HEAL, đổi role/môi trường/data class, hoặc journey đã quá 7 ngày. Mỗi lần dùng lại phải nói rõ trong VERDICT.

Mẫu đầy đủ của từng artefact, cách sinh tài liệu use case, và cấu trúc `.testagent.yaml`: **`references/explore-artifacts.md`**.

**Kết luận sơ bộ báo ngay tại đây.** Nếu EXPLORE đã cho thấy app hỏng ở đâu, nói luôn — đừng bắt tester chờ tới bước 7. Nhưng ghi rõ đó là kết luận sơ bộ.

### Nếu môi trường không có công cụ browser nào

- **Host chạy được lệnh** (Claude Code, Codex, IDE): khôi phục EXPLORE bằng cách cắm Playwright MCP rồi nạp lại danh sách công cụ:
  ```bash
  claude mcp add playwright npx @playwright/mcp@latest
  ```
  Không cắm được — chặn mạng, không chạy được `npx`, người dùng từ chối — thì dùng `scripts/explore.mjs` trinh sát một lượt. Nó chạy headless một phát rồi thoát: không giữ session, không click nối tiếp, không đọc network theo thời gian thực. **Chạy `--help` trước, không đọc source code của script.**
  ```bash
  node scripts/explore.mjs --help
  node scripts/explore.mjs --url https://staging.example.com/login --out ./recon
  ```
- **Host không chạy được lệnh** (ví dụ claude.ai): EXPLORE bị chặn. Báo `Blocked: không có công cụ browser và không chạy được script`, rồi (a) nhờ người dùng dán ảnh chụp / log console / log network / HTML, hoặc (b) soạn sẵn các bước để người dùng tự thao tác và báo lại quan sát. Tuyệt đối không suy đoán hành vi app rồi báo như đã kiểm, và không sinh spec từ phỏng đoán.

---

## 2 — PLAN

Đầu ra là **một bảng scenario**, không phải một đoạn văn. Kể cả yêu cầu nhỏ nhất cũng phải có ít nhất một scenario — chính là scenario chốt lại điều vừa quan sát ở EXPLORE.

```
TẦNG     ID                  LAYER  ƯU TIÊN  TRUY VẾT             TIÊU ĐỀ
setup    auth-login          ui     p0       TC-LOGIN-01          Đăng nhập tài khoản hợp lệ
smoke    cart-badge          ui     p0       TC-ORD-03            Badge giỏ hàng đếm đúng số món
core     checkout-happy      ui     p0       SRS §4.2, TC-ORD-01  Đặt hàng thành công
core     checkout-total      ui     p0       SRS §4.4             Tổng = tiền hàng + thuế
edge     checkout-no-postal  ui     p1       TC-ORD-07            Thiếu mã bưu chính bị chặn
teardown cleanup-orders      api    p2       —                    Xoá đơn agent tạo ra

Ngoài phạm vi: thanh toán thật (sẽ mock) · OTP qua SMS (không tự động được) · hoàn tiền (chưa có AC)
```

Ba luật:

- Xếp scenario theo tầng **setup → smoke → core → edge → teardown**.
- Mỗi scenario **truy vết được** về một requirement hoặc mã test case. Không truy vết được thì ghi `exploration` và nói rõ đây là ca dựng từ quan sát, chưa có yêu cầu chống lưng.
- Phần **ngoài phạm vi phải viết ra** — im lặng bỏ qua sẽ bị đọc thành "đã kiểm và ổn".

### Thu hẹp phạm vi khi target quá lớn

App lớn thì "cover tất cả" vừa tốn vừa vô dụng. Ba cách thu hẹp, chọn theo cái người dùng đưa:

| Người dùng đưa | Thu hẹp bằng | PLAN chỉ chứa |
|---|---|---|
| Một file requirement / một mục SRS | Nội dung file đó là oracle authoritative cho lượt này | Scenario truy vết về đúng requirement đó |
| Tên một chức năng ("checkout", "duyệt hồ sơ") | `scope.feature` trong `.testagent.yaml` | Luồng thuộc chức năng đó |
| Một commit/branch vừa sửa | `git diff --name-only <base>` → map file sang màn hình/route | Luồng đi qua vùng vừa đổi + smoke quanh nó |

Dù thu hẹp cách nào, phần **ngoài phạm vi vẫn phải liệt kê** những gì bị cắt — người đọc cần biết bộ test này *không* nói gì về phần còn lại của app.

Cách thứ ba (theo diff) là ước lượng, không phải phân tích tĩnh chính xác: nói rõ đây là best-effort và liệt kê file nào không map được sang màn hình nào.

**Biến thể bug**: PLAN là fingerprint môi trường + kịch bản tái hiện đúng bước tester mô tả + oracle (KQMM) + attempt budget. Với bug race/intermittent, PLAN phải chốt cadence matrix và instrumentation profile *trước* khi chạy — xem `references/complex-flow-race-reproduction.md`.

Chi tiết, ma trận truy vết hai chiều và cách chấm độ phủ: `references/test-plan-and-traceability.md`.

---

## 3 — CONFIRM

Trình bảng PLAN cho người dùng duyệt **trước khi sinh code và trước khi chạm dữ liệu**. Tester biết nghiệp vụ hơn agent; sửa một dòng bảng rẻ hơn sửa mười file spec.

- **Có người trả lời**: chờ duyệt. Họ sửa/cắt/thêm dòng thì cập nhật bảng rồi mới đi tiếp.
- **Không ai trả lời** (chạy tự động, CI, non-interactive): tự duyệt để pipeline không treo, **nhưng phải in bảng ra** để lại vết trong log.
- **Bộ test đủ lớn để tester muốn sửa tay**: ghi bảng ra `test-plan.md` rồi đọc lại file đó khi họ trả về.

Cổng này cũng là chỗ xin phép cho **thao tác phá huỷ** và **thao tác trên production** — xem [Luật an toàn](#luật-an-toàn).

---

## 4 — GENERATE

Sinh spec + Page Object **commit được vào repo**. Mọi route, label, locator và oracle phải lấy từ EXPLORE — không tự bịa.

**Repo chưa có khung Playwright** → dựng trước:

```bash
node scripts/scaffold.mjs --help
node scripts/scaffold.mjs --dir ./e2e --base-url https://staging.example.com --features ui,api,visual --ci github
```

Khung sinh ra gồm `playwright.config.ts` (đa môi trường, reporter, retry, trace), `pages/`, `tests/{ui,api,visual}/`, `fixtures/`, `utils/`, `.auth/` và `.env.example`. Chi tiết: `references/project-setup.md`.

**Repo đã có khung** → đọc `playwright.config.ts` và một spec có sẵn trước, rồi viết theo đúng phong cách đó. Đừng áp khung mới đè lên convention của họ.

Luật viết spec:

- **Một scenario một file.** Dồn cả bộ vào một file thì fail một ca phải chạy lại cả cụm, và không quarantine riêng được.
- **Dùng `test.step`** để report hiện đúng từng bước như trong test case thủ công.
- **Tên test theo mã test case + mô tả nghiệp vụ**, không theo kỹ thuật — tester đọc report phải nhận ra ngay đây là ca nào trong file test case của họ.

```typescript
test('TC-LOGIN-01: đăng nhập thành công với tài khoản hợp lệ', async ({ page }) => {
  const login = new LoginPage(page);
  await test.step('Mở trang đăng nhập', async () => login.goto());
  await test.step('Nhập tài khoản hợp lệ và bấm Đăng nhập', async () =>
    login.signIn(process.env.TEST_USER!, process.env.TEST_PASS!));
  await test.step('Kết quả mong đợi: vào được trang chủ', async () => {
    await expect(page.getByRole('heading', { name: 'Trang chủ' })).toBeVisible();
  });
});
```

Locator, Page Object, form, bảng, upload/download, iframe, dialog: `references/ui-e2e.md`.

### Kịch bản cần năng lực chỉ spec mới có

Những scenario dưới đây không thể kiểm bằng thao tác tay — đây chính là phần spec trả lại giá trị lớn nhất, nên đừng cắt chúng khỏi PLAN:

| Kịch bản | Vì sao tay không làm được | Dùng gì |
|---|---|---|
| Bug phụ thuộc cadence: double-click, spam nút, hai request đua nhau | Mỗi lời gọi công cụ browser tốn hàng trăm ms và không lặp lại cùng một gap | `waitForTimeout(cadenceMs)` như test input + cadence matrix |
| Tỷ lệ `x/y` cho bug intermittent | Cần ≥10–20 lượt có reset state sạch, cùng đồng hồ đo | `--repeat-each=N --workers=1 --retries=0` |
| Ép hết phiên / xoá cookie HttpOnly / bơm sẵn state | `document.cookie` không thấy cookie HttpOnly | `context.clearCookies({ name })`, `storageState` |
| Hai actor/role chạy đồng thời (maker–checker) | Một phiên trình duyệt thủ công chỉ có một session | hai `browserContext` |
| Chặn/sửa response, mạng chậm, offline | Công cụ browser chỉ **đọc** request đã xảy ra | `page.route`, `routeFromHAR`, `context.setOffline` |
| Download, `alert`/`confirm`, filechooser | Phải arm listener **trước** cú bấm | `page.waitForEvent('download')`, `page.once('dialog', …)` |
| Visual regression so pixel | Cần baseline snapshot lưu trong repo | `toHaveScreenshot` |

---

## 5 — EXECUTE

Chạy bộ vừa sinh qua **cổng ổn định**: mỗi test mới chạy N lượt liên tiếp (N = 3 đủ cho hầu hết case), chỉ nhận vào suite khi **cả N lượt đều pass**.

```bash
npx playwright test tests/ui/checkout.spec.ts --repeat-each=3 --workers=1 --retries=0
```

Kết quả lẫn lộn (vài lần pass, vài lần fail) là **flaky, và flaky bị tách riêng chứ không nhập vào suite xanh** — gắn `@quarantine` kèm một dòng ghi rõ tỷ lệ quan sát được, rồi báo cho người dùng. **Đừng thêm `retries` để nó xanh**: `retries` giấu flaky chứ không sửa flaky, và một suite xanh giả còn tệ hơn suite đỏ thật.

**Biến thể race/intermittent thì ngược lại.** Mục tiêu là *đo tỷ lệ*, không phải đạt "N lượt đều pass" — "ba lần đều pass" ở đây chính là bằng chứng chưa tái hiện được. Dùng attempt budget đã chốt ở PLAN, `--workers=1 --retries=0` để denominator không bị trộn, và báo requested/observed timing. Xem `references/complex-flow-race-reproduction.md`.

**Nếu EXPLORE bị chặn nên chưa có spec** (host không chạy được lệnh, người dùng từ chối file): EXECUTE nghĩa là đi lại kịch bản PLAN bằng thao tác tay, ghi bằng chứng từng bước. Verdict phải nói rõ đây là kết quả chạy tay, chưa có test tự động chốt lại.

---

## 6 — HEAL

Test fail thì **quay lại trình duyệt thật**: mở app, đi đúng bước đang fail, đọc DOM hiện tại, rồi mới sửa. Thử mù hết selector này tới selector khác là cách nhanh nhất để có một test xanh nhưng không còn kiểm cái gì.

Trả lời câu hỏi này **trước** khi động vào code:

| Quan sát trên trang thật | Kết luận | Hành động |
|---|---|---|
| Phần tử còn đó, chỉ đổi label/role/vị trí | App đổi hợp lệ | Sửa locator theo DOM vừa đọc |
| Phần tử biến mất hẳn, luồng cụt | **Bug của app** | Báo bug, giữ test đỏ — đừng sửa test cho khớp |
| Giá trị hiển thị khác expected | Kiểm requirement trước | Requirement đổi → đổi expected và nói rõ; requirement không đổi → bug |
| Chỉ đỏ khi chạy cả bộ | Test phụ thuộc nhau | Cho test tự tạo dữ liệu của nó |

Hai luật cứng:

- **Không hạ chuẩn assertion để test xanh.** Đổi `toHaveText('1.250.000 ₫')` thành `toBeVisible()`, bỏ bớt `expect`, nới `timeout` lên 120s cho khỏi fail — đó không phải sửa test, đó là xoá phần kiểm.
- **Giới hạn số lần sửa** (mặc định 2). Hết lượt mà vẫn đỏ thì dừng, đưa ca đó vào verdict là `fail` kèm chẩn đoán — đừng sửa vô hạn tới khi nó xanh bằng mọi giá.

**Biến thể bug**: không tái hiện được thì **đổi giả thuyết, không đổi kết luận**. Thử lại với state/role/data class/cadence/build khác, mỗi lần ghi lại đã đổi biến nào. Hết attempt budget thì verdict là `Not reproduced` hoặc `Inconclusive` kèm danh sách biến đã thử — không được im lặng chuyển thành "không có bug".

Bảng chẩn đoán đầy đủ: `references/troubleshooting.md`.

---

## 7 — VERDICT

Không phải chỗ dán log thô. Verdict là con số, và phải tách khỏi status của ticket nguồn.

**Bộ test:**

```
Verdict: FAIL

  Scenario lập kế hoạch : 6
  Nhận vào suite        : 4
  Fail                  : 1  (checkout-total — tổng lệch 1đ, nghi bug làm tròn phía BE)
  Tách vì flaky         : 1  (cart-badge — 7/10 lượt pass, badge cập nhật chậm)
  Đã sửa test           : 2  (đổi locator sau khi app đổi label; không đổi assertion nào)

  EXPLORE  : quan sát mới trên build 2.4.1 lúc 14:32 (+07), Chrome profile thật
  Bàn giao : e2e/tests/ui/*.spec.ts (4 file) + e2e/pages/CheckoutPage.ts
  Chạy lại : npx playwright test --config e2e/playwright.config.ts
  Suite gate: npx playwright test --grep-invert @quarantine
  Report   : npx playwright show-report
  Artefact : .testagent/checkout-staging/ (journey, test-plan, use-cases, HAR)

  Lý do FAIL : còn 1 ca fail, truy vết về SRS §4.4 (p0).
  Ngoài phạm vi : thanh toán thật · OTP SMS · hoàn tiền (chưa có AC).
```

Dòng `EXPLORE` bắt buộc nói rõ **quan sát mới hay dùng lại artefact cũ** — kết luận dựa trên journey ghi tuần trước và kết luận dựa trên quan sát vừa xong là hai mức tin cậy khác nhau.

**Chốt lại để lần sau rẻ hơn.** Trước khi kết thúc, hỏi người dùng hai việc: (1) ghi `.testagent.yaml` cho target này chưa — có rồi thì lần sau bước FRAME chỉ còn một câu xác nhận; (2) tài liệu use case vừa sinh có muốn chuyển vào `docs/test-cases/` để commit không — nó là tài liệu nghiệp vụ, không phải rác tạm. Đừng tự chuyển file ra khỏi `.testagent/`.

**Bug log:** giữ đúng giọng tester — tách rõ `Pre`, bước, `KQTT`, `KQMM`, evidence và tần suất tái hiện. Báo riêng ba dòng: `Reproduction outcome`, `Fix-verification verdict` (`Verified fixed`/`Failed`/`Partial`/`Regression`/`Not reproduced`/`Blocked`/`Inconclusive`) và `Status recommendation`. `Closed`, `Resolved` hay `Notbug` chỉ là trạng thái nguồn, không thay cho kết quả độc lập; không sửa status nguồn nếu người dùng chưa yêu cầu rõ. Giữ nguyên exact UI copy/test value cần đối chiếu, nhưng che PII, account ID, business/transaction ID. Mẫu đầy đủ: `references/bug-reproduction.md`.

Với mỗi ca fail, trả lời câu hỏi tester cần nhất: đây là **bug của app** hay **lỗi của script**? Chưa chắc thì nói rõ là chưa chắc và nêu bằng chứng, đừng kết luận bừa.

**Tuyệt đối không kết luận "không có bug" khi phần chưa kiểm được nằm ngoài tầm.** Đúng verdict cho phần đó là `Inconclusive`, kèm cách kiểm tiếp.

---

## Luật an toàn

Áp dụng cho EXPLORE và EXECUTE, không có ngoại lệ:

- **Không tự khởi động dev server khi cổng đã có tiến trình chạy.** Lấy cổng từ URL người dùng đưa (hoặc từ script `dev` trong `package.json`), rồi kiểm tra trước: `netstat -ano | findstr :<PORT>` (Windows) / `lsof -i :<PORT>` (macOS/Linux). Có sẵn thì dùng tiến trình đang chạy và nói rõ điều đó.
- **Đăng nhập tự động — nhưng agent không cầm mật khẩu.** Credential luôn nằm ở `.env` hoặc biến môi trường; agent chỉ truyền **tên biến**, không đọc giá trị. Chạy `scripts/auth-login.mjs` để đăng nhập và lưu phiên, đừng gõ mật khẩu vào form bằng tay. Ba điều cấm: **không hỏi mật khẩu trong hội thoại** (transcript được lưu lại), **không truyền mật khẩu qua tham số dòng lệnh** (lộ trong `ps` và shell history), **không hard-code trong spec**. Thiếu `.env` thì hướng dẫn người dùng tự tạo file rồi báo lại — họ gõ vào file, không gõ vào chat.
- **Xác minh backend thật sự là gì trước khi kết luận.** Một cổng localhost có thể là mock, cũng có thể là tunnel tới môi trường thật — đọc response header (`server`, `via`, gateway). Kết luận "không tái hiện được" trên mock gần như vô giá trị.
- **Thao tác trên staging/UAT tạo ra dữ liệu thật; production thì chỉ đọc.** Ghi lại mọi bản ghi agent tạo ra và đưa vào bằng chứng; scenario `teardown` phải dọn chúng. Không suy ra "đây là staging" từ cảm giác: host chỉ coi là an toàn khi là `localhost`/IP nội bộ, tên có `staging`/`stg`/`test`/`qa`/`dev`/`uat`, hoặc chính người dùng nói rõ. Còn lại mặc định coi như production.
- **Dừng lại trước động từ phá huỷ, kể cả trên staging.** Xoá · thanh toán/chuyển tiền · gửi đi (SMS, email, thông báo, duyệt hồ sơ) · huỷ đăng ký · vô hiệu hoá tài khoản · ghi đè dữ liệu người khác. Nêu rõ ở bước CONFIRM sắp làm gì lên bản ghi nào và chờ người dùng đồng ý. Ưu tiên **tự tạo dữ liệu nháp rồi phá dữ liệu đó**, đừng đụng bản ghi có sẵn.

## 7 nguyên tắc để test không flaky

Test chạy lúc được lúc không sẽ bị cả team mất niềm tin và bỏ xó. Đây là phần quan trọng nhất của bước GENERATE.

1. **Locator theo cách người dùng nhìn thấy, không theo cách dev viết code.** Thứ tự ưu tiên: `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId` → CSS/XPath (cuối cùng, hạn chế). Class và cấu trúc DOM đổi liên tục theo mỗi lần refactor; nhãn và vai trò gắn với nghiệp vụ nên bền hơn. Node `role + name` đọc được ở EXPLORE quy đổi thẳng thành `getByRole(role, { name })`.
   ```typescript
   await page.getByRole('button', { name: 'Thanh toán' }).click();   // ✅
   await page.locator('.btn.btn-primary.mt-3').click();               // ❌
   ```
   Locator dính nhiều phần tử thì thu hẹp bằng `filter()` hoặc vùng cha, đừng dùng `.nth(3)`. Tên khớp lỏng cũng dính nhầm: `{ name: 'Đăng nhập' }` trúng cả "Lưu thông tin đăng nhập"; dùng `exact: true` khi cần.

2. **Dùng assertion tự chờ (web-first).** `await expect(locator).toBeVisible()` tự retry tới khi hết timeout; `expect(await locator.isVisible()).toBe(true)` chỉ kiểm đúng một khoảnh khắc và sẽ fail ngẫu nhiên.

3. **Không `waitForTimeout` để đồng bộ readiness.** Chờ đúng thứ cần: `await expect(...).toBeVisible()`, `page.waitForURL()`, `page.waitForResponse()`. Ngoại lệ riêng của bug timing-sensitive: delay có tham số được dùng như **test input cadence**, phải ghi requested/actual timing và nằm trong ma trận. Cũng đừng dùng `networkidle` với app có websocket/HMR.

4. **Mỗi test tự đứng được.** Không phụ thuộc test trước để lại dữ liệu hay trạng thái. Một causal flow nhiều màn hình vẫn phải nằm trọn trong **một test/attempt**, chia bằng `test.step`/Page Object chứ không thành chuỗi test phụ thuộc nhau.

5. **Dữ liệu test tự sinh, không hard-code.** `user_${Date.now()}@test.com` thay vì `test01@test.com` bị trùng khi chạy song song. Test nào tạo dữ liệu thì tự dọn ở `afterEach` (nhanh nhất là gọi API xóa).

6. **Đăng nhập một lần rồi tái sử dụng.** Dùng `storageState` — xem `references/auth-and-data.md`. Ngoại lệ: test về chính vòng đời phiên đăng nhập thì phải tự login từ đầu.

7. **Mock những gì mình không kiểm soát.** Cổng thanh toán, SMS OTP, API bên thứ ba: chặn bằng `page.route` và trả response cố định — xem `references/network-mocking.md`.

## Chạy và debug

| Việc cần làm | Lệnh |
|---|---|
| Chạy toàn bộ | `npx playwright test` |
| Chạy 1 file / 1 test | `npx playwright test tests/ui/login.spec.ts -g "TC-LOGIN-01"` |
| Cổng ổn định cho test mới | `npx playwright test <file> --repeat-each=3 --workers=1 --retries=0` |
| Suite xanh dùng làm gate | `npx playwright test --grep-invert @quarantine` |
| Xem trình duyệt khi chạy | `npx playwright test --headed` |
| Chế độ UI (tester rất thích cái này) | `npx playwright test --ui` |
| Debug từng bước | `npx playwright test --debug` |
| Xem report sau khi chạy | `npx playwright show-report` |
| Mổ xẻ test fail trên CI | `npx playwright show-trace trace.zip` |

Khi một test fail: **mở trace trước khi đoán nguyên nhân.** Trace có timeline, DOM snapshot từng bước, network và console — nhìn là biết fail ở đâu, khỏi suy diễn. Rồi mới sang bước HEAL.

`npx playwright codegen <url>` chỉ dùng khi cần chuyển một luồng **đã chốt** ở EXPLORE thành spec, không dùng để khảo sát (nó hay đẻ locator CSS rác).

## Checklist trước khi coi là xong

### A. Pipeline

- [ ] Đã đi đủ tám bước; bước nào bị chặn đã ghi `Blocked` kèm lý do và điều kiện mở khoá
- [ ] EXPLORE chạy trên đúng URL/build/môi trường, đúng role, đúng state và data class mà yêu cầu nói tới
- [ ] Đã xác minh backend phía sau là thật hay mock, và đã nói rõ chạy trên trình duyệt profile thật hay profile tạm
- [ ] Đã đọc lại state 2–3 lần khi màn hình còn đang đổi, không kết luận từ một snapshot duy nhất
- [ ] PLAN đã trình ra và được duyệt (hoặc đã in bảng khi tự duyệt); phần ngoài phạm vi đã viết rõ
- [ ] Mỗi scenario truy vết được về requirement/mã test case, hoặc được đánh dấu `exploration`
- [ ] Không lấy hành vi hiện tại của app làm chuẩn đúng/sai khi chưa có acceptance criterion
- [ ] VERDICT nói rõ EXPLORE là quan sát mới hay dùng lại artefact cũ (kèm build + thời điểm ghi)

### B. Test bàn giao

- [ ] Locator lấy từ DOM thật ở EXPLORE, không phải đoán
- [ ] Một scenario một file spec; tên test khớp mã test case của tester
- [ ] Không còn `waitForTimeout` cứng nào không có lý do
- [ ] Qua cổng ổn định `--repeat-each=3 --workers=1 --retries=0`; ca lẫn lộn đã tách `@quarantine` kèm tỷ lệ, không dùng `retries` để giấu
- [ ] Baseline intermittent/race dùng attempts + tỷ lệ `x/y` — **không** áp cổng ổn định lên nhóm này
- [ ] Mọi lần HEAL đều giữ nguyên ý định assertion; có đổi expected thì đổi theo requirement và đã nói rõ
- [ ] Không có mật khẩu / token hard-code — nằm ở `.env`, và `.env` đã `.gitignore`
- [ ] Đã nói rõ đường dẫn file bàn giao, cách chạy lại, lệnh chạy suite gate (`--grep-invert @quarantine`) và cách xem report
- [ ] Đã hỏi người dùng có ghi `.testagent.yaml` và có chuyển tài liệu use case ra `docs/test-cases/` không — không tự chuyển file ra khỏi `.testagent/`

### C. Bằng chứng và an toàn

- [ ] Verdict là con số, tách khỏi status ticket nguồn
- [ ] Bằng chứng gồm ảnh tại observation point, console, network (endpoint + status), state đọc từ trang
- [ ] Đã tách rõ fact / inference / unknown, và nêu điều gì **chưa** kiểm được vì sao
- [ ] Đã liệt kê bản ghi/dữ liệu do agent tạo ra trên môi trường test và nói rõ đã dọn hay cần ai dọn
- [ ] Đăng nhập qua `auth-login.mjs` đọc `.env`; không hỏi mật khẩu trong hội thoại, không truyền qua dòng lệnh, không hard-code
- [ ] Không tự start server khi cổng đã có tiến trình; không thao tác phá huỷ hay chạm production khi chưa được duyệt ở bước CONFIRM
- [ ] Evidence đã che PII/secrets; không dùng dữ liệu định danh hoặc giao dịch thật từ production

### D. Thêm cho bug log

- [ ] Đã đọc full row + evidence + timeline, không chỉ title/status; bug ID/source row truy vết được và wording gốc còn bên cạnh bản chuẩn hóa
- [ ] Với log dài/complex flow: báo `raw_clause_coverage: x/y`; mọi clause đã map hoặc ghi `Unknown`
- [ ] Với bug thao tác nhanh/race: đã tách setup → critical burst → oracle; không chen wait/assertion làm đổi cadence; báo profile + requested/actual timing + `x/y`; **attempt chạy tay không tính vào attempt budget**
- [ ] Trước verify: chính agent đã tái hiện baseline trên build gốc và lưu evidence; evidence lịch sử không thay được gate này
- [ ] Verify chạy đúng target build/deployment, platform, role, state và data class của bug gốc
- [ ] Không chỉ kiểm "lỗi biến mất": đã assert tích cực KQMM và side effect/persistence liên quan

## Bản đồ tài liệu

| File | Nội dung |
|---|---|
| `references/live-browser-investigation.md` | **Bước EXPLORE + chẩn đoán ở bước HEAL**: chọn/xác minh trình duyệt, đọc cây accessibility, click/điền form, chạy JS trong trang, đọc console + network, bốn kiểu hỏng im lặng, chốt đầu ra cho PLAN |
| `references/explore-artifacts.md` | **Đầu ra của EXPLORE**: thư mục `.testagent/`, nhật ký hành trình, điểm chốt, ghi use case → sinh tài liệu test case thủ công, HAR, `storageState`, `.testagent.yaml`, khi nào phải explore lại |
| `references/test-plan-and-traceability.md` | **Bước PLAN + VERDICT**: thứ tự tin cậy của nguồn, kế hoạch có tầng, bảng plan để duyệt, ma trận truy vết, ngoài phạm vi, definition of done |
| `references/bug-reproduction.md` | Biến thể bug của cả pipeline: đọc ngôn ngữ tester Việt, tái hiện/retest bug STG/UAT/prod, evidence, phân loại nguyên nhân, mẫu báo cáo |
| `references/complex-flow-race-reproduction.md` | Biến thể race: compile log dài thành scenario map, replay nhiều màn hình/tab/role, critical burst, cadence matrix, observer effect |
| `references/project-setup.md` | Bước GENERATE khi repo chưa có khung: `playwright.config.ts`, đa môi trường, cấu trúc thư mục, npm scripts |
| `references/ui-e2e.md` | Bước GENERATE: locator, Page Object, assertion, aria snapshot, upload/download, iframe, tab mới, dialog, table |
| `references/api-testing.md` | `request` fixture, kiểm tra status/schema, chain token, tạo dữ liệu qua API |
| `references/visual-responsive.md` | `toHaveScreenshot`, che vùng động, đa viewport, cross-browser, mobile emulation |
| `references/accessibility.md` | `@axe-core/playwright`, WCAG tags, xử lý vi phạm đã biết |
| `references/network-mocking.md` | `page.route`, HAR, giả lập lỗi 500/timeout/offline/mạng chậm |
| `references/auth-and-data.md` | `storageState`, đa role, per-worker auth, fixture, sinh & dọn dữ liệu test |
| `references/excel-to-spec.md` | Bước PLAN từ file test case Excel (mẫu UAT) → spec + bảng truy vết |
| `references/reporting-ci.md` | Sau VERDICT: reporter, Allure, JUnit cho TestRail/Xray, GitHub Actions, Jenkins, GitLab, sharding, Docker |
| `references/performance.md` | Web Vitals, Lighthouse, đo thời gian tải, khi nào cần k6 |
| `references/troubleshooting.md` | Bước HEAL: app hỏng hay test hỏng, cổng ổn định, quarantine, timeout, lỗi chỉ xảy ra trên CI, selector gãy |

Script bundled (gọi trực tiếp, đọc `--help` trước, không đọc source):

| Script | Dùng ở bước |
|---|---|
| `scripts/auth-login.mjs` | EXPLORE, khi app cần đăng nhập — tự login bằng credential trong `.env`, lưu `storageState`, `--check` để bỏ qua khi phiên còn sống. Hỗ trợ TOTP 2FA |
| `scripts/explore.mjs` | EXPLORE, khi không có công cụ browser — dump một lượt locator + ảnh full page. **Không thay được EXPLORE bằng trình duyệt thật.** |
| `scripts/scaffold.mjs` | GENERATE, khi repo chưa có khung Playwright TS |
| `scripts/excel_to_spec.py` | PLAN, khi đầu vào là file test case `.xlsx` (mẫu KBKTCN hoặc UAT phẳng). Không chạy trên bug list. |

Asset:

| Đường dẫn | Dùng khi |
|---|---|
| `assets/testcase-template/KBKTCN.xlsx` | Team chưa có file test case cho màn hình đó — nhân bản template này. Đúng cấu trúc KBKTCN: sheet Tổng hợp, khối metadata, dải tiêu đề ba dòng, dropdown P/F/PE, công thức sinh mã tự động |
| `assets/template/` | Khung dự án Playwright TS mà `scaffold.mjs` sinh ra |

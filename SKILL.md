---
name: playwright-automation
description: Kiểm thử, tái hiện bug và verify fix cho tester/QA — mặc định thao tác trực tiếp trên trình duyệt để trả lời ngay kèm bằng chứng; chỉ viết test Playwright + TypeScript khi cần chạy lại. Dùng khi người dùng muốn xem/kiểm tra trang đang chạy, hỏi trang lỗi gì, console/network báo gì, nhờ bấm thử một luồng, đọc bug log/issue sheet, hiểu KQMM/KQTT/EVD, xử lý log dài, luồng stateful nhiều màn hình/tab/role, bug chỉ ra khi thao tác nhanh/liên tục hoặc có race, tái hiện bug trước khi DEV sửa, verify/retest sau fix trên STG/UAT/prod, phân biệt lỗi code với config/data/infra, dựng framework, test E2E/API/visual/responsive/accessibility, mock API, chuyển Excel thành script, xử lý flaky, tích hợp CI/CD. Cũng kích hoạt khi nhắc Playwright, Selenium, Cypress, E2E, POM, smoke/regression, "reproduce bug", "verify/retest fix", "dev đã fix", "thao tác nhanh/liên tục", "race/flaky/intermittent", "chạy thử app xem đúng chưa", "test tự động", hoặc đưa link/localhost kèm yêu cầu kiểm tra, bằng tiếng Việt hoặc tiếng Anh.
---

# Playwright Automation cho Tester

Skill này biến yêu cầu kiểm thử hoặc bug log của tester thành **kết luận có bằng chứng thu trực tiếp trên trình duyệt** — và, *khi người dùng cần chạy lại lâu dài*, thành **test Playwright + TypeScript bảo trì được** (`@playwright/test`).

Đối tượng dùng skill này thường là tester thủ công đang chuyển sang automation. Họ biết rất rõ *nghiệp vụ cần test gì*, nhưng chưa chắc rành *selector, async, CI*. Vì vậy: giải thích ngắn gọn bằng tiếng Việt, và **trả lời câu hỏi của họ trước** bằng bằng chứng thật (ảnh chụp, console, network, cây accessibility). Chỉ để lại file test khi họ cần chạy lại — lúc đó thì viết code sạch và nói rõ cách chạy lại.

## Nguyên tắc cốt lõi

Mặc định là **mở trình duyệt làm thật**, không phải viết file. Automation hỏng chủ yếu vì đoán selector; không bao giờ viết `page.click('.btn-primary')` dựa trên tưởng tượng — và cũng đừng viết cả một dự án test cho câu hỏi chỉ cần bấm ba lần là biết.

```
Pha 0 — FRAME : chốt URL/build/môi trường, role/state, và đích đến (một lần hay chạy lại lâu dài)
Pha 1 — LIVE  : mở app thật bằng công cụ browser — điều hướng, đọc cây accessibility, click/điền,
                chạy JS trong trang, đọc console + network. PHẦN LỚN YÊU CẦU KẾT THÚC Ở ĐÂY.
Pha 2 — CODIFY: biến kịch bản đã xác minh ở Pha 1 thành spec + Page Object commit được vào repo.
                CHỈ làm khi qua cổng dưới đây.
```

**Cổng CODIFY — có ít nhất một dấu mới được viết file:**

| Dấu | Khi nào |
|---|---|
| **LẶP** | Cần chạy lại lâu dài: regression, CI, gate release |
| **NHỊP** | Gap giữa hai action < ~500 ms, hoặc cadence phải đo và tái lập được |
| **SỐ** | Cần tỷ lệ `x/y` trên ≥10 lượt có reset state |
| **QUYỀN** | Cần thứ JS trong trang không làm được: xoá cookie HttpOnly, `storageState`, hai context song song, `page.route`, offline/throttle, listener download/dialog, baseline snapshot |
| **YÊU CẦU** | Người dùng nói rõ muốn có file (dựng khung, Excel → spec, migration) |

Không dấu nào → dừng ở Pha 1, báo cáo, rồi hỏi một câu: "Có muốn chốt case này thành test chạy lại được không?".

**Không có file spec KHÔNG phải là chưa hoàn thành.** Viết spec cho một câu hỏi dùng một lần là lãng phí thời gian tester; ngược lại, bỏ Pha 1 rồi viết spec theo phỏng đoán là nguyên nhân số 1 của test flaky. Pha 2 không bao giờ bắt đầu từ số 0 — route, label, locator, oracle đều lấy từ lượt LIVE.

Với bug log thực tế, dùng **Decode → Reproduce baseline → Classify → Verify fix → *[tùy chọn]* Codify regression**. Không nhảy thẳng từ một dòng issue sang code: phải đọc cả row, evidence, phản hồi DEV và timeline; tách fact khỏi suy luận; chính agent phải tái hiện đúng bug tester mô tả trên môi trường/build gốc — **tái hiện bằng thao tác trực tiếp trên trình duyệt** — và lưu baseline trước khi bàn giao DEV. Sau khi DEV sửa mới chạy fix verification trên build đích. Bước Codify regression chỉ làm khi bug đủ nghiêm trọng hoặc dễ tái phát để đáng nằm trong suite, hoặc khi người dùng yêu cầu. Nếu không tái hiện được vì thiếu build/data/quyền hoặc guardrail production, báo `Not reproduced`, `Blocked` hoặc `Inconclusive`; không được bỏ qua baseline rồi tuyên bố "đã fix".

## Bước 1 — Định tuyến

Đọc bảng này, xác định người dùng đang cần gì, rồi mở đúng file `references/`. **Chỉ đọc file thật sự cần** — đọc hết sẽ làm loãng context.

**Mặc định của mọi dòng là thao tác trực tiếp trên trình duyệt.** Chỉ viết file khi cột "Làm gì" nói rõ, hoặc khi qua cổng CODIFY.

| Người dùng nói gì | Làm gì | Đọc thêm |
|---|---|---|
| "Xem hộ trang này", "đang lỗi gì", "console/network báo gì", "bấm thử giúp", đưa link/localhost kèm câu hỏi | **Thao tác trực tiếp**: mở trang → đọc cây accessibility → click/điền → đọc console + network → trả lời kèm bằng chứng. **KHÔNG tạo file** | `references/live-browser-investigation.md` |
| "Test giúp chức năng X xem chạy đúng không" | **Thao tác trực tiếp** đi hết luồng, đọc console + network, kết luận kèm bằng chứng. Chỉ viết spec nếu người dùng nói cần chạy lại | `references/live-browser-investigation.md`; `references/ui-e2e.md` chỉ khi codify |
| "Đọc bug log", "reproduce/retest bug", KQMM/KQTT/EVD, issue STG/UAT/prod | Decode full row + evidence → **tái hiện trực tiếp trên trình duyệt** đúng bước tester mô tả → phân loại → báo cáo | `references/bug-reproduction.md`; `references/ui-e2e.md` chỉ khi đã quyết định codify regression |
| "Verify bug", "verify fix", "xác nhận DEV đã fix", "retest để Close/Reopen" | Kiểm baseline agent đã tái hiện → **chạy lại đúng fingerprint trực tiếp** trên build đã fix → kiểm KQMM + persistence/side effect → regression gần vùng sửa → verdict | `references/bug-reproduction.md`, mục **Verify bug sau khi DEV fix** |
| "Đọc kỹ" workbook bug có nhiều tab, học cách tester log lỗi | Inventory cả visible/hidden tab + filtered/hidden row → phân loại bug/evidence/metadata → đọc mọi bug list + xem ảnh evidence → nêu coverage | `references/bug-reproduction.md` |
| Log dài; nhiều màn hình/tab/role; back/reopen/relogin; "ngay", "nhanh", "liên tục", double-click; race/intermittent | Đi bộ một lượt trực tiếp để chốt route/label/oracle. **Tái hiện được ở nhịp thường → báo cáo, dừng.** Không tái hiện được, hoặc cần cadence < ~500 ms / tỷ lệ `x/y` / hai actor → script hoá: setup/critical burst/oracle + cadence matrix + attempts `x/y` | `references/bug-reproduction.md`, rồi `references/complex-flow-race-reproduction.md` |
| "Ép token hết hạn / mất phiên / xoá cookie đăng nhập" | Cookie HttpOnly không xoá được bằng JS trong trang → **bắt buộc** `context.clearCookies()` trong spec, hoặc chờ hết TTL thật | `references/auth-and-data.md` |
| "Dựng khung automation cho dự án" | `scripts/scaffold.mjs` (đây là yêu cầu rõ ràng muốn ra file) | `references/project-setup.md` |
| "Viết script đăng nhập / form / luồng nghiệp vụ" | LIVE để lấy route + locator thật → POM + spec | `references/ui-e2e.md` |
| "Test API", "kiểm tra endpoint" | Hỏi nhanh một endpoint khi đã có session: chạy `fetch` trong trang. Bộ nhiều case/chạy lại: `request` fixture | `references/api-testing.md` |
| "So sánh giao diện", "UI có bị lệch không", "responsive" | Lệch rõ mắt thường: đổi kích thước cửa sổ + chụp màn hình, trả lời ngay. Cần so pixel qua thời gian: `toHaveScreenshot` + projects đa viewport | `references/visual-responsive.md` |
| "Test accessibility", "WCAG", "chuẩn tiếp cận" | Thiếu label/role/heading: soi ngay bằng cây accessibility. Quét full WCAG: `@axe-core/playwright` | `references/accessibility.md` |
| "Giả lập API lỗi / mạng chậm / offline" | `page.route`, HAR — **bắt buộc spec** | `references/network-mocking.md` |
| "Đăng nhập sẵn cho mọi test", "test nhiều role" | `storageState` + setup project — **bắt buộc spec** | `references/auth-and-data.md` |
| "Chuyển file test case Excel thành script" | `scripts/excel_to_spec.py` | `references/excel-to-spec.md` |
| "Chạy trên Jenkins/GitHub", "xuất report" | reporter + CI config — **bắt buộc spec** | `references/reporting-ci.md` |
| "Test bị lúc pass lúc fail", "chạy local ok mà CI fail" | Chẩn đoán flaky: chạy lặp + so trace — **bắt buộc spec** | `references/troubleshooting.md` |
| "Đo tốc độ trang", "test hiệu năng / tải" | Đo một lần: `performance.getEntriesByType('navigation')` trong trang. Đo lặp/so sánh/tải: Lighthouse, k6 | `references/performance.md` |

Nếu yêu cầu chạm nhiều mảng (ví dụ "test luồng đặt hàng, có cả API và ảnh chụp"), đi hết luồng bằng thao tác trực tiếp trước để biết luồng có chạy được không — rồi mới bổ sung dần. Đừng cố dựng mọi thứ trong một lượt.

## Pha 0 — FRAME: thu đủ điều kiện trước khi thao tác

Nếu đầu vào là bug log/issue sheet, **không hỏi lại những gì row đã nói**. Đọc full row và evidence trước, chuẩn hóa thành environment/platform, precondition, test data/state, actions, actual, expected và unknown. Chỉ hỏi phần thật sự chặn tái hiện như URL/build đích, tài khoản hoặc seed data an toàn, evidence nằm ngoài sheet, hay acceptance criterion còn mâu thuẫn. Xem `references/bug-reproduction.md`.

Nếu đầu vào là yêu cầu kiểm thử mới, chỉ hỏi những mục chưa có; đừng phỏng vấn dài dòng:

1. **URL** app cần test (staging/local/prod?) và app có cần đăng nhập không → nếu có, xin tài khoản test.
2. **Phạm vi**: một chức năng cụ thể, hay cả luồng nghiệp vụ, hay cả bộ regression?
3. **Đích đến**: chạy một lần cho biết kết quả, hay dựng suite để chạy lại lâu dài?
   - "Chạy một lần cho biết kết quả" → làm trực tiếp trên trình duyệt (Pha 1), **KHÔNG tạo file**, bỏ qua Pha 2.
   - "Dựng suite chạy lại lâu dài" → làm Pha 1 trước để lấy route/locator/oracle thật, rồi mới sang Pha 2.
   - Người dùng chưa nói rõ → **mặc định là chạy một lần**, và hỏi lại ở cuối báo cáo. Đừng tự quyết thay họ bằng cách viết sẵn cả bộ test.

Nếu người dùng đưa file test case Excel/SRS, đọc file đó thay vì hỏi — trong đó thường đã có đủ tiền điều kiện, dữ liệu và kết quả mong đợi.

## Pha 1 — LIVE: thao tác trực tiếp trên trình duyệt

Đây là chế độ mặc định. Công cụ browser điều khiển một trình duyệt thật và **giữ nguyên session giữa các bước**, nên đi được luồng nhiều màn hình mà không cần cài gì, không cần dự án Playwright, không sinh file.

Năng lực cần dùng: điều hướng · đọc cây accessibility (mỗi element có `ref` — **đã là element có thật, không cần đoán selector**) · click/gõ/cuộn/chụp ảnh · điền form · chạy JS trong trang · đọc console · đọc network · đổi kích thước cửa sổ · quản lý tab. **Tên công cụ khác nhau tuỳ môi trường** (Claude Code, Codex, claude.ai, IDE…) — tra danh sách công cụ đang có rồi ánh xạ theo năng lực, đừng tìm đúng chữ. Nếu phải nạp công cụ trước khi dùng, nạp **một lượt duy nhất** cho cả bộ.

**Có nhiều bộ công cụ browser thì ưu tiên bộ điều khiển Chrome thật của người dùng**, không phải trình duyệt sandbox trong app. Chrome thật mang sẵn phiên đăng nhập, ngoại lệ cert và proxy/VPN nội bộ, nên vào được staging/UAT mà bản sandbox bị chặn ngay từ bước điều hướng — và nó đúng là thứ tester đang nhìn khi họ báo bug. Chỉ dùng sandbox khi không có Chrome thật, hoặc khi cần một profile sạch không session. Xem mục **Chọn trình duyệt** trong `references/live-browser-investigation.md`.

Vòng điều tra: mở đúng URL người dùng nói → đọc cây để biết đang ở state nào → thao tác **đúng các bước tester mô tả, không rút gọn** → sau mỗi bước quan trọng đọc network + console + chụp ảnh → cần state phía server thì gọi API bằng chính session đang mở → kết luận kèm bằng chứng, rồi hỏi có cần chốt thành regression không.

**Đọc `references/live-browser-investigation.md`** cho chi tiết: bảng năng lực đầy đủ và cách ánh xạ tên công cụ, quy đổi `role + name` → `getByRole`, luật điều hướng SPA (gõ URL = mất state), bốn kiểu hỏng im lặng (overlay che, tab mới, element ngoài viewport, dialog gốc), `ref` hết hạn sau mỗi lần DOM đổi, cách biết trang đã render xong khi không có `networkidle`, giới hạn cookie HttpOnly, và mẫu báo cáo LIVE.

**Nếu môi trường không có công cụ browser nào**, Pha 1 không khả dụng — nói rõ với người dùng trước khi làm gì tiếp, rồi chọn theo năng lực của host:

- **Host chạy được lệnh** (Claude Code, Codex, IDE): dùng `scripts/explore.mjs` trinh sát một lượt rồi sang Pha 2.
- **Host không chạy được lệnh** (ví dụ claude.ai): không trinh sát được. Báo `Blocked: không có công cụ browser và không chạy được script`, rồi (a) nhờ người dùng dán ảnh chụp / log console / log network / HTML của màn hình cần xem, hoặc (b) soạn sẵn các bước để người dùng tự thao tác và báo lại quan sát. Tuyệt đối không suy đoán hành vi app rồi báo như đã kiểm.

### Luật an toàn khi thao tác trực tiếp

Bốn luật này áp dụng cho mọi lượt LIVE, không có ngoại lệ:

- **Không tự khởi động dev server khi cổng đã có tiến trình chạy.** Lấy cổng từ URL người dùng đưa (hoặc từ script `dev` trong `package.json`), rồi kiểm tra trước: `netstat -ano | findstr :<PORT>` (Windows) / `lsof -i :<PORT>` (macOS/Linux). Có sẵn thì dùng tiến trình đang chạy và nói rõ điều đó. Start chồng vừa fail vừa có thể giết bản build người dùng đang xem.
- **Không tự điền mật khẩu.** Số điện thoại/username và dữ liệu test thì điền; tới ô mật khẩu thì dừng, nhờ người dùng nhập, chờ họ báo đã đăng nhập xong rồi đi tiếp.
- **Xác minh backend thật sự là gì trước khi kết luận.** Một cổng localhost có thể là mock, cũng có thể là tunnel tới môi trường thật — đọc response header (`server`, `via`, gateway) hoặc kiểm tra kết nối ra ngoài. Kết luận "không tái hiện được" trên mock gần như vô giá trị, còn trên BE thật thì có giá trị nghiệm thu.
- **Thao tác trên staging/UAT tạo ra dữ liệu thật; production thì chỉ đọc.** Ghi lại mọi bản ghi agent tạo ra và đưa vào bằng chứng. Mọi hành động tạo/sửa/xoá trên production, và mọi thao tác chạm ra ngoài hệ thống (OTP/SMS/email, cổng thanh toán), phải được người dùng cho phép rõ ràng trước.

### Thao tác tay KHÔNG làm được — bắt buộc codify

| Tình huống | Vì sao tay không làm được | Dùng gì |
|---|---|---|
| Bug phụ thuộc cadence: double-click, spam nút, hai request đua nhau | Mỗi lời gọi công cụ browser tốn hàng trăm ms và không lặp lại được cùng một gap | `waitForTimeout(cadenceMs)` như test input + cadence matrix |
| Cần tỷ lệ `x/y` cho bug intermittent | Cần ≥10–20 lượt có reset state sạch và cùng đồng hồ đo | `--repeat-each=N --workers=1 --retries=0` |
| Ép hết phiên / xoá cookie HttpOnly / bơm sẵn storageState | `document.cookie` không thấy cookie HttpOnly, JS trong trang không xoá được | `context.clearCookies({ name })`, `storageState` |
| Hai actor/role độc lập chạy đồng thời (maker–checker) | Một phiên trình duyệt thủ công chỉ có một session | hai `browserContext` |
| Chặn/sửa response, mạng chậm, offline, HAR | Công cụ browser chỉ **đọc** request đã xảy ra, không sửa được | `page.route`, `routeFromHAR`, `context.setOffline` |
| Download, `alert`/`confirm`, filechooser | Phải arm listener **trước** cú bấm; thao tác tay chỉ quan sát được sau khi việc đã rồi | `page.waitForEvent('download')`, `page.once('dialog', …)` |
| Visual regression so pixel | Cần baseline snapshot lưu trong repo để đối chiếu qua thời gian | `toHaveScreenshot` |
| CI, report máy đọc (JUnit/Allure/TestRail/Xray), gate release | Theo định nghĩa cần file spec commit được | reporter + CI config |
| Chẩn đoán flaky, "local ok mà CI fail" | Cần chạy lặp hàng chục lượt, so trace giữa các lần, tái hiện container CI | runner + Docker image CI |
| Người dùng yêu cầu rõ ra file | — | scaffold / Excel → spec / migration |

Ngược lại, những thứ **vẫn làm trực tiếp được** thì đừng viện cớ để viết spec: kiểm tra validate form, đếm/đọc bảng dữ liệu, xác minh nội dung một màn hình, đọc lỗi console, xem endpoint nào trả 4xx/5xx, gọi API bằng session hiện tại, iframe same-origin, upload qua `<input type=file>` lộ ra, kiểm responsive bằng đổi kích thước cửa sổ.

### Khi nào dùng `scripts/explore.mjs`

Chỉ dùng khi cần **dump một lượt toàn bộ locator + ảnh full page để chuẩn bị codify**, hoặc khi công cụ browser không dùng được. Nó chạy headless một phát rồi thoát: không giữ session, không click nối tiếp nhiều bước, không đọc network theo thời gian thực — tức là không thay được Pha 1. **Chạy `--help` trước, không đọc source code của script** (chúng dài và làm nặng context; chúng được thiết kế để gọi như hộp đen):

```bash
node scripts/explore.mjs --help
node scripts/explore.mjs --url https://staging.example.com/login --out ./recon
```

- **App cần đăng nhập trước**: `--auth storageState.json`, hoặc `--login-url ... --username ...` (mật khẩu: nhờ người dùng cung cấp, không tự bịa và không hard-code).
- **Phần tử chỉ hiện sau tương tác** (menu, modal, tab): `--click "Đăng ký"`.
- **Server chưa chạy**: bảo người dùng chạy server, hoặc dùng `webServer` trong `playwright.config.ts` — đừng tự ý start server nền của họ.

`npx playwright codegen <url>` chỉ dùng khi cần chuyển một luồng **đã chốt** thành spec, không dùng để khảo sát (nó hay đẻ locator CSS rác).

## Pha 2 — CODIFY

Chỉ vào pha này khi đã qua cổng CODIFY. Mọi route, label, locator và oracle dùng ở đây phải lấy từ lượt LIVE trên trang thật — không tự bịa.

### Dựng khung dự án (chỉ khi cần suite chạy lại lâu dài, và repo chưa có khung)

**Đừng scaffold cho một câu hỏi dùng một lần — kể cả khi repo đang trống.** Điều kiện là *nhu cầu của người dùng*, không phải *trạng thái repo*.

```bash
node scripts/scaffold.mjs --help
node scripts/scaffold.mjs --dir ./e2e --base-url https://staging.example.com --features ui,api,visual --ci github
```

Khung sinh ra gồm `playwright.config.ts` (đa môi trường, reporter, retry, trace), `pages/`, `tests/{ui,api,visual}/`, `fixtures/`, `utils/`, `.auth/` và `.env.example`. Chi tiết cấu trúc, phân tầng POM và cấu hình: `references/project-setup.md`.

Nếu dự án **đã có** sẵn khung: đọc `playwright.config.ts` và một spec có sẵn trước, rồi viết theo đúng phong cách đó. Đừng áp khung mới đè lên convention của họ. Và repo có sẵn suite không có nghĩa mọi yêu cầu đều phải thành spec — cổng CODIFY vẫn áp dụng.

### Viết spec

Dùng `test.step` để report hiện đúng từng bước như trong test case thủ công, và đặt tên test theo **mã test case + mô tả nghiệp vụ**, không phải theo kỹ thuật — tester đọc report phải nhận ra ngay đây là ca nào trong file test case của họ:

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

## 7 nguyên tắc để test không flaky

**Phần này áp dụng khi đã quyết định viết test file (Pha 2).** Với điều tra trực tiếp ở Pha 1 thì không cần: cây accessibility đã cho element có thật, và mỗi lần đọc là state hiện tại — chỉ cần đọc lại 2–3 lần khi màn hình còn đang đổi, thay vì kết luận từ lần đọc đầu.

Trong phạm vi spec, đây là phần quan trọng nhất của skill. Test chạy lúc được lúc không sẽ bị cả team mất niềm tin và bỏ xó.

1. **Locator theo cách người dùng nhìn thấy, không theo cách dev viết code.** Thứ tự ưu tiên:
   `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId` → CSS/XPath (cuối cùng, hạn chế).
   Lý do: class và cấu trúc DOM đổi liên tục theo mỗi lần refactor; nhãn và vai trò thì gắn với nghiệp vụ nên bền hơn. Node `role + name` đọc được ở Pha 1 quy đổi thẳng thành `getByRole(role, { name })`.
   ```typescript
   await page.getByRole('button', { name: 'Thanh toán' }).click();   // ✅
   await page.locator('.btn.btn-primary.mt-3').click();               // ❌
   ```
   Locator dính nhiều phần tử thì thu hẹp bằng `filter()` hoặc bằng vùng cha, đừng dùng `.nth(3)` — thứ tự sẽ đổi. Tên khớp lỏng cũng dính nhầm: `{ name: 'Đăng nhập' }` sẽ trúng cả "Lưu thông tin đăng nhập"; dùng `exact: true` khi cần.

2. **Dùng assertion tự chờ (web-first).** `await expect(locator).toBeVisible()` tự retry tới khi hết timeout; `expect(await locator.isVisible()).toBe(true)` thì kiểm tra đúng một khoảnh khắc và sẽ fail ngẫu nhiên.

3. **Không `waitForTimeout` để đồng bộ readiness.** Sleep 3 giây vừa chậm vừa không chắc. Chờ đúng thứ cần: `await expect(...).toBeVisible()`, `page.waitForURL()`, `page.waitForResponse()`.
   Ngoại lệ riêng của bug timing-sensitive: delay có tham số được dùng như **test input cadence**, phải ghi requested/actual timing và nằm trong ma trận; xem `references/complex-flow-race-reproduction.md`. Animation không có tín hiệu để bám là ngoại lệ hiếm khác và phải có comment.
   Cũng đừng dùng `networkidle` với app có websocket/HMR — mạng không bao giờ "rảnh", test sẽ treo tới timeout.

4. **Mỗi test tự đứng được.** Không phụ thuộc test trước để lại dữ liệu hay trạng thái. Một causal flow nhiều màn hình vẫn phải nằm trọn trong **một test/attempt**, chia bằng `test.step`/Page Object chứ không thành chuỗi test phụ thuộc nhau.

5. **Dữ liệu test tự sinh, không hard-code.** `user_${Date.now()}@test.com` thay vì `test01@test.com` bị trùng khi chạy song song. Test nào tạo dữ liệu thì tự dọn ở `afterEach` (nhanh nhất là gọi API xóa).

6. **Đăng nhập một lần rồi tái sử dụng.** Login qua UI ở mỗi test làm suite chậm gấp nhiều lần và thêm một điểm gãy. Dùng `storageState` — xem `references/auth-and-data.md`. Ngoại lệ: test về chính vòng đời phiên đăng nhập thì phải tự login từ đầu.

7. **Mock những gì mình không kiểm soát.** Cổng thanh toán, SMS OTP, API bên thứ ba: chặn bằng `page.route` và trả response cố định. Test của bạn là để kiểm tra *app của bạn*, không phải kiểm tra uptime của nhà cung cấp — xem `references/network-mocking.md`.

## Chạy và debug

**Ở Pha 1 (mặc định)** không có lệnh nào để chạy, chỉ có quan sát: đọc console, đọc network, đọc cây accessibility, chạy JS trong trang, chụp màn hình. Bảng chẩn đoán đầy đủ ở `references/troubleshooting.md`, mục **Bước 0 — Quan sát trực tiếp**.

**Ở Pha 2 (khi đã có spec):**

| Việc cần làm | Lệnh |
|---|---|
| Chạy toàn bộ | `npx playwright test` |
| Chạy 1 file / 1 test | `npx playwright test tests/ui/login.spec.ts -g "TC-LOGIN-01"` |
| Xem trình duyệt khi chạy | `npx playwright test --headed` |
| Chế độ UI (tester rất thích cái này) | `npx playwright test --ui` |
| Debug từng bước | `npx playwright test --debug` |
| Xem report sau khi chạy | `npx playwright show-report` |
| Mổ xẻ test fail trên CI | `npx playwright show-trace trace.zip` |
| Ghi lại thao tác thành code | `npx playwright codegen <url>` |

Khi đang thao tác trực tiếp: đọc console + network ngay tại chỗ, chụp state trước/sau hành động — rẻ hơn và tức thời. Khi **một test đã viết** bị fail: **mở trace trước khi đoán nguyên nhân.** Trace có timeline, DOM snapshot từng bước, network và console — nhìn là biết fail ở đâu, khỏi suy diễn.

## Báo cáo lại cho tester

Sau khi làm xong, đừng chỉ dán log thô. Tổng kết theo cách tester đọc được.

Nếu kết thúc ở Pha 1, bằng chứng hợp lệ là: ảnh chụp tại observation point, dòng console liên quan, request/response (URL + status + body rút gọn), state đọc từ trang. **Đó đã là bằng chứng nghiệm thu nộp được**, không cần HTML report của Playwright. Kèm theo: các bước đã bấm để người dùng tự lặp lại, và phần chưa kiểm được kèm lý do (ví dụ: *không ép được token hết hạn vì cookie HttpOnly không xoá được bằng JS trong trang*).

- Bao nhiêu ca pass / fail, ca nào fail và **fail ở bước nào**.
- Với mỗi ca fail: đây là **bug của app** hay **lỗi của script/thao tác**? Đây là câu hỏi họ cần trả lời nhất, và cũng là chỗ dễ nhầm nhất — nếu chưa chắc chắn, nói rõ là chưa chắc và nêu bằng chứng thay vì kết luận bừa.
- *Nếu có chạy spec*: đường dẫn tới HTML report và ảnh/trace của ca fail.
- Cái gì chưa cover được và tại sao (ví dụ: OTP qua SMS thật, cần mock).

Với bug log, dùng đúng giọng tester nhưng tách rõ `Pre`, bước, `KQTT`, `KQMM`, evidence và tần suất tái hiện. Giữ nguyên exact UI copy/test value cần đối chiếu, nhưng che PII, account ID, business/transaction ID và không tái sử dụng dữ liệu production. `Closed`, `Resolved` hoặc `Notbug` chỉ là trạng thái nguồn, không thay cho kết quả tái hiện/verify độc lập. Báo riêng `Reproduction outcome`, `Fix-verification verdict` và `Status recommendation`; không sửa status nguồn nếu người dùng chưa yêu cầu rõ. Mẫu đầy đủ nằm trong `references/bug-reproduction.md`.

## Checklist trước khi coi là xong

### A. Nếu kết thúc bằng điều tra trực tiếp (mặc định)

- [ ] Đã thao tác trên đúng URL/build/môi trường, đúng role, đúng state và data class mà yêu cầu nói tới
- [ ] Đã xác minh backend phía sau là thật hay mock trước khi kết luận
- [ ] Kết luận kèm bằng chứng thật: ảnh chụp tại observation point, console, network (endpoint + status), hoặc state đọc từ trang
- [ ] Đọc lại state 2–3 lần khi màn hình còn đang đổi, không kết luận từ một snapshot duy nhất
- [ ] Tách rõ fact / inference / unknown
- [ ] Đã nêu điều gì **chưa** kiểm được và vì sao (ví dụ: cookie HttpOnly không xoá được bằng JS → không ép được token hết hạn)
- [ ] Đã liệt kê các bước đã bấm để người dùng tự lặp lại bằng tay
- [ ] Đã liệt kê bản ghi/dữ liệu do chính agent tạo ra trên môi trường test (mã đơn, ID hồ sơ, thời điểm) và nói rõ đã dọn hay cần ai dọn giúp
- [ ] Không tạo file thừa; đã hỏi người dùng có muốn chốt thành regression không
- [ ] Không tự điền mật khẩu; không tự start server khi cổng đã có tiến trình chạy; không side effect trên production khi chưa được cho phép

### B. Nếu có để lại test file (regression/CI)

- [ ] Locator lấy từ DOM thật (từ lượt LIVE), không phải đoán
- [ ] Không còn `waitForTimeout` cứng nào không có lý do
- [ ] Regression deterministic chạy được **hai lần liên tiếp** đều pass; baseline intermittent/race dùng attempts + tỷ lệ `x/y`, không áp checklist "hai lần pass"
- [ ] Không có mật khẩu / token hard-code trong code — nằm ở `.env`, và `.env` đã `.gitignore`
- [ ] Tên test khớp mã test case của tester
- [ ] Đã nói rõ cách chạy lại và cách xem report

### C. Với bug log (áp dụng cho cả hai chế độ)

- [ ] Đã đọc full row + evidence + timeline, không chỉ title/status
- [ ] Bug ID/source row truy vết được và wording gốc vẫn còn bên cạnh bản chuẩn hóa
- [ ] Actual/expected và fact/inference/unknown được tách riêng
- [ ] Với log dài/complex flow: báo `raw_clause_coverage: x/y`; mọi clause đã map hoặc ghi `Unknown`; actor/page/state/timing/branch và observation point không bị mất
- [ ] Với bug thao tác nhanh/race: đã tách setup → critical burst → oracle; không chen wait/assertion làm đổi cadence; báo profile + requested/actual timing + `x/y`; **attempt chạy tay không được tính vào attempt budget**
- [ ] Trước verify: chính agent đã tái hiện baseline trên build gốc và lưu evidence; evidence lịch sử chỉ hỗ trợ điều tra, không thay gate này cho verdict `Verified fixed`
- [ ] Verify chạy đúng target build/deployment, platform, role, state và data class của bug gốc
- [ ] Không chỉ kiểm "lỗi biến mất": đã assert tích cực KQMM và side effect/persistence liên quan
- [ ] Verdict verify (`Verified fixed`/`Failed`/`Partial`/`Regression`/`Not reproduced`/`Blocked`/`Inconclusive`) tách khỏi status nguồn
- [ ] Không dùng dữ liệu định danh hoặc giao dịch thật từ production; evidence đã che PII/secrets

## Bản đồ tài liệu

| File | Nội dung |
|---|---|
| `references/live-browser-investigation.md` | **(mặc định)** Điều hướng, đọc cây accessibility, click/điền form, chạy JS trong trang, đọc console + network, chụp bằng chứng, giới hạn của thao tác tay và khi nào phải chuyển sang codify |
| `references/bug-reproduction.md` | Đọc ngôn ngữ tester Việt, tái hiện/retest bug STG/UAT/prod, evidence, phân loại nguyên nhân, mẫu báo cáo |
| `references/complex-flow-race-reproduction.md` | Compile log dài thành scenario map; replay nhiều màn hình/tab/role; critical burst, cadence matrix, race/intermittent và observer effect |
| `references/project-setup.md` | Khi nào mới scaffold, `playwright.config.ts`, đa môi trường, cấu trúc thư mục, npm scripts |
| `references/ui-e2e.md` | Locator, Page Object, assertion, upload/download, iframe, tab mới, dialog, table, date picker |
| `references/api-testing.md` | `request` fixture, kiểm tra status/schema, chain token, tạo dữ liệu qua API |
| `references/visual-responsive.md` | `toHaveScreenshot`, che vùng động, đa viewport, cross-browser, mobile emulation |
| `references/accessibility.md` | `@axe-core/playwright`, WCAG tags, xử lý vi phạm đã biết |
| `references/network-mocking.md` | `page.route`, HAR, giả lập lỗi 500/timeout/offline/mạng chậm |
| `references/auth-and-data.md` | `storageState`, đa role, per-worker auth, fixture, sinh & dọn dữ liệu test |
| `references/excel-to-spec.md` | Chuyển file test case Excel (mẫu UAT) thành spec + bảng truy vết |
| `references/reporting-ci.md` | Reporter, Allure, JUnit cho TestRail/Xray, GitHub Actions, Jenkins, GitLab, sharding, Docker |
| `references/performance.md` | Web Vitals, Lighthouse, đo thời gian tải, khi nào cần k6 |
| `references/troubleshooting.md` | Chẩn đoán app hỏng hay test hỏng, flaky, timeout, lỗi chỉ xảy ra trên CI, selector gãy |

Script bundled (gọi trực tiếp, đọc `--help` trước, không đọc source):

| Script | Dùng khi |
|---|---|
| `scripts/explore.mjs` | Dump một lượt toàn bộ locator + ảnh full page để chuẩn bị codify, hoặc khi không dùng được công cụ browser. **Không thay cho Pha 1.** |
| `scripts/scaffold.mjs` | Dựng khung dự án Playwright TS mới — chỉ khi đã qua cổng CODIFY |
| `scripts/excel_to_spec.py` | Đọc file test case `.xlsx` sinh spec skeleton + `test-map.json`. Không chạy trên bug list. |

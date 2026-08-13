---
name: playwright-automation
description: Bộ công cụ automation testing, tái hiện bug và verify fix thực tế bằng Playwright + TypeScript dành cho tester/QA. Dùng skill này khi người dùng muốn đọc bug log/issue sheet, hiểu cách tester mô tả lỗi bằng KQMM/KQTT/EVD, tái hiện bug trước khi DEV sửa, verify/retest sau khi DEV fix trên STG/UAT/production, phân biệt lỗi code với config/data/infra, viết hoặc sinh script automation, tự động hóa test case, dựng framework, test E2E/API/visual/responsive/accessibility, mock API, chuyển file test case Excel thành script, đọc report, xử lý flaky, hoặc tích hợp CI/CD. Cũng kích hoạt khi người dùng nhắc Playwright, Selenium, Cypress, E2E, POM, smoke/regression, "reproduce bug", "verify bug", "verify fix", "retest bug", "log bug", "dev đã fix", "chạy thử app xem đúng chưa", "test tự động", hoặc đưa link/localhost kèm yêu cầu kiểm tra chức năng, bằng tiếng Việt hoặc tiếng Anh.
---

# Playwright Automation cho Tester

Skill này biến yêu cầu kiểm thử hoặc bug log của tester thành **kết luận có bằng chứng** và **test tự động chạy được, bảo trì được**, bằng Playwright + TypeScript (`@playwright/test`).

Đối tượng dùng skill này thường là tester thủ công đang chuyển sang automation. Họ biết rất rõ *nghiệp vụ cần test gì*, nhưng chưa chắc rành *selector, async, CI*. Vì vậy: giải thích ngắn gọn bằng tiếng Việt, viết code sạch, và luôn để lại thứ họ chạy lại được — đừng chỉ in kết quả ra màn hình rồi thôi.

## Nguyên tắc cốt lõi

Với test case hoặc tính năng mới, dùng **Recon → Codify**. Automation hỏng chủ yếu vì đoán selector; không bao giờ viết `page.click('.btn-primary')` dựa trên tưởng tượng.

```
Pha A — RECON: mở app thật, chờ render xong, đọc DOM, lấy locator có thật
Pha B — CODIFY: biến những gì đã xác minh thành spec + Page Object commit được vào repo
```

Bỏ pha A là nguyên nhân số 1 của test flaky. Bỏ pha B thì tester chỉ nhận được một script dùng một lần, tuần sau vứt đi.

Với bug log thực tế, dùng **Decode → Reproduce baseline → Classify → Verify fix → Codify regression**. Không nhảy thẳng từ một dòng issue sang code: phải đọc cả row, evidence, phản hồi DEV và timeline; tách fact khỏi suy luận; chính agent phải tái hiện đúng bug tester mô tả trên môi trường/build gốc và lưu baseline trước khi bàn giao DEV. Sau khi DEV sửa mới chạy fix verification trên build đích. Nếu không tái hiện được vì thiếu build/data/quyền hoặc guardrail production, báo `Not reproduced`, `Blocked` hoặc `Inconclusive`; không được bỏ qua baseline rồi tuyên bố “đã fix”.

## Bước 1 — Định tuyến

Đọc bảng này, xác định người dùng đang cần gì, rồi mở đúng file `references/`. **Chỉ đọc file thật sự cần** — đọc hết sẽ làm loãng context.

| Người dùng nói gì | Làm gì | Đọc thêm |
|---|---|---|
| "Đọc bug log", "reproduce/retest bug", KQMM/KQTT/EVD, issue STG/UAT/prod | Decode full row + evidence → tái hiện → phân loại → báo cáo/retest | `references/bug-reproduction.md`, rồi `references/ui-e2e.md` nếu cần browser |
| "Verify bug", "verify fix", "xác nhận DEV đã fix", "retest để Close/Reopen" | Kiểm baseline do agent đã tái hiện → chạy lại đúng fingerprint trên build đã fix → kiểm KQMM + persistence/side effect → regression gần vùng sửa → verdict | `references/bug-reproduction.md`, mục **Verify bug sau khi DEV fix** |
| "Đọc kỹ" workbook bug có nhiều tab, học cách tester log lỗi | Inventory cả visible/hidden tab + filtered/hidden row → phân loại bug/evidence/metadata → đọc mọi bug list + xem ảnh evidence → nêu coverage | `references/bug-reproduction.md` |
| "Test giúp chức năng X xem chạy đúng không" | Recon → viết spec nhanh → chạy → báo cáo | `references/ui-e2e.md` |
| "Dựng khung automation cho dự án" | `scripts/scaffold.mjs` | `references/project-setup.md` |
| "Viết script đăng nhập / form / luồng nghiệp vụ" | Recon → POM + spec | `references/ui-e2e.md` |
| "Test API", "kiểm tra endpoint" | `request` fixture, không cần browser | `references/api-testing.md` |
| "So sánh giao diện", "UI có bị lệch không", "responsive" | `toHaveScreenshot` + projects đa viewport | `references/visual-responsive.md` |
| "Test accessibility", "WCAG", "chuẩn tiếp cận" | `@axe-core/playwright` | `references/accessibility.md` |
| "Giả lập API lỗi / mạng chậm / offline" | `page.route`, HAR | `references/network-mocking.md` |
| "Đăng nhập sẵn cho mọi test", "test nhiều role" | `storageState` + setup project | `references/auth-and-data.md` |
| "Chuyển file test case Excel thành script" | `scripts/excel_to_spec.py` | `references/excel-to-spec.md` |
| "Chạy trên Jenkins/GitHub", "xuất report" | reporter + CI config | `references/reporting-ci.md` |
| "Test bị lúc pass lúc fail", "chạy local ok mà CI fail" | chẩn đoán flaky | `references/troubleshooting.md` |
| "Đo tốc độ trang", "test hiệu năng / tải" | web vitals, Lighthouse, k6 | `references/performance.md` |

Nếu yêu cầu chạm nhiều mảng (ví dụ "test luồng đặt hàng, có cả API và ảnh chụp"), làm UI E2E trước rồi bổ sung dần — đừng cố dựng mọi thứ trong một lượt.

## Bước 2 — Thu đủ điều kiện trước khi code hoặc tái hiện

Nếu đầu vào là bug log/issue sheet, **không hỏi lại những gì row đã nói**. Đọc full row và evidence trước, chuẩn hóa thành environment/platform, precondition, test data/state, actions, actual, expected và unknown. Chỉ hỏi phần thật sự chặn tái hiện như URL/build đích, tài khoản hoặc seed data an toàn, evidence nằm ngoài sheet, hay acceptance criterion còn mâu thuẫn. Xem `references/bug-reproduction.md`.

Nếu đầu vào là yêu cầu kiểm thử mới, chỉ hỏi những mục chưa có; đừng phỏng vấn dài dòng:

1. **URL** app cần test (staging/local/prod?) và app có cần đăng nhập không → nếu có, xin tài khoản test.
2. **Phạm vi**: một chức năng cụ thể, hay cả luồng nghiệp vụ, hay cả bộ regression?
3. **Đích đến**: chạy một lần cho biết kết quả, hay dựng suite để chạy lại lâu dài?

Nếu người dùng đưa file test case Excel/SRS, đọc file đó thay vì hỏi — trong đó thường đã có đủ tiền điều kiện, dữ liệu và kết quả mong đợi.

## Pha A — Recon

Có sẵn script trinh sát. **Chạy `--help` trước, không đọc source code của script** (chúng dài và làm nặng context; chúng được thiết kế để gọi như hộp đen):

```bash
node scripts/explore.mjs --help
```

Ví dụ điển hình:

```bash
node scripts/explore.mjs --url https://staging.example.com/login --out ./recon
```

Script sẽ: mở Chromium headless → chờ trang render xong → liệt kê mọi phần tử tương tác được kèm **locator gợi ý theo thứ tự ưu tiên** → chụp ảnh full page → gom console error và request lỗi. Kết quả in ra stdout (đủ để viết test luôn) và lưu vào `--out`.

Ba tình huống hay gặp:

- **App cần đăng nhập trước**: `--auth storageState.json`, hoặc `--login-url ... --username ... --password ...` để script tự đăng nhập rồi mới trinh sát.
- **Phần tử chỉ hiện sau tương tác** (menu, modal, tab): `--click "Đăng ký"` để script bấm rồi mới chụp DOM.
- **Server chưa chạy**: bảo người dùng chạy server, hoặc dùng `webServer` trong `playwright.config.ts` (xem `references/project-setup.md`) — đừng tự ý start server nền của họ.

Ngoài ra `npx playwright codegen <url>` ghi lại thao tác thật thành code — rất hợp khi tester muốn tự "quay" luồng nghiệp vụ. Gợi ý cho họ, nhưng luôn dọn lại code codegen sinh ra trước khi commit (nó hay đẻ locator theo CSS rác).

## Pha B — Codify

### Dựng khung dự án (nếu chưa có)

```bash
node scripts/scaffold.mjs --help
node scripts/scaffold.mjs --dir ./e2e --base-url https://staging.example.com --features ui,api,visual --ci github
```

Khung sinh ra:

```
e2e/
├── playwright.config.ts       # projects, reporter, retry, trace, đa môi trường
├── .env.example               # BASE_URL, API_URL, tài khoản test
├── pages/                     # Page Object — nơi chứa locator
│   └── BasePage.ts
├── tests/
│   ├── ui/                    # E2E giao diện
│   ├── api/                   # test API
│   └── visual/                # visual regression
├── fixtures/                  # fixture dùng chung (test data, page đã login)
├── utils/                     # helper: đọc dữ liệu, format, faker
└── .auth/                     # storageState (đã .gitignore)
```

Nếu dự án **đã có** sẵn khung: đọc `playwright.config.ts` và một spec có sẵn trước, rồi viết theo đúng phong cách đó. Đừng áp khung mới đè lên convention của họ.

### Viết spec

Khung một spec dễ đọc cho tester — dùng `test.step` để report hiện đúng từng bước như trong test case thủ công:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('TC-LOGIN — Đăng nhập', () => {
  test('TC-LOGIN-01: đăng nhập thành công với tài khoản hợp lệ', async ({ page }) => {
    const login = new LoginPage(page);

    await test.step('Mở trang đăng nhập', async () => {
      await login.goto();
    });

    await test.step('Nhập tài khoản hợp lệ và bấm Đăng nhập', async () => {
      await login.signIn(process.env.TEST_USER!, process.env.TEST_PASS!);
    });

    await test.step('Kết quả mong đợi: vào được trang chủ', async () => {
      await expect(page.getByRole('heading', { name: 'Trang chủ' })).toBeVisible();
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
});
```

Đặt tên test theo **mã test case + mô tả nghiệp vụ**, không phải theo kỹ thuật. Tester đọc report phải nhận ra ngay đây là ca nào trong file test case của họ.

## 7 nguyên tắc để test không flaky

Đây là phần quan trọng nhất của skill. Test chạy lúc được lúc không sẽ bị cả team mất niềm tin và bỏ xó.

1. **Locator theo cách người dùng nhìn thấy, không theo cách dev viết code.** Thứ tự ưu tiên:
   `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId` → CSS/XPath (cuối cùng, hạn chế).
   Lý do: class và cấu trúc DOM đổi liên tục theo mỗi lần refactor; nhãn và vai trò thì gắn với nghiệp vụ nên bền hơn.
   ```typescript
   await page.getByRole('button', { name: 'Thanh toán' }).click();   // ✅
   await page.locator('.btn.btn-primary.mt-3').click();               // ❌
   ```
   Locator dính nhiều phần tử thì thu hẹp bằng `filter()` hoặc bằng vùng cha, đừng dùng `.nth(3)` — thứ tự sẽ đổi.

2. **Dùng assertion tự chờ (web-first).** `await expect(locator).toBeVisible()` tự retry tới khi hết timeout; `expect(await locator.isVisible()).toBe(true)` thì kiểm tra đúng một khoảnh khắc và sẽ fail ngẫu nhiên.

3. **Không `waitForTimeout` cứng.** Sleep 3 giây vừa chậm vừa không chắc. Chờ đúng thứ cần: `await expect(...).toBeVisible()`, `page.waitForURL()`, `page.waitForResponse()`.
   Ngoại lệ hiếm: animation không có tín hiệu nào để bám — khi đó ghi comment giải thích tại sao.

4. **Mỗi test tự đứng được.** Không phụ thuộc test trước để lại dữ liệu hay trạng thái. Playwright chạy song song và có retry — test dây chuyền sẽ đổ theo domino.

5. **Dữ liệu test tự sinh, không hard-code.** `user_${Date.now()}@test.com` thay vì `test01@test.com` bị trùng khi chạy song song. Test nào tạo dữ liệu thì tự dọn ở `afterEach` (nhanh nhất là gọi API xóa).

6. **Đăng nhập một lần rồi tái sử dụng.** Login qua UI ở mỗi test làm suite chậm gấp nhiều lần và thêm một điểm gãy. Dùng `storageState` — xem `references/auth-and-data.md`.

7. **Mock những gì mình không kiểm soát.** Cổng thanh toán, SMS OTP, API bên thứ ba: chặn bằng `page.route` và trả response cố định. Test của bạn là để kiểm tra *app của bạn*, không phải kiểm tra uptime của nhà cung cấp — xem `references/network-mocking.md`.

## Chạy và debug

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

Khi test fail: **mở trace trước khi đoán nguyên nhân.** Trace có timeline, DOM snapshot từng bước, network và console — nhìn là biết fail ở đâu, khỏi suy diễn.

## Báo cáo lại cho tester

Sau khi chạy, đừng chỉ dán log thô. Tổng kết theo cách tester đọc được:

- Bao nhiêu ca pass / fail, ca nào fail và **fail ở bước nào**.
- Với mỗi ca fail: đây là **bug của app** hay **lỗi của script**? Đây là câu hỏi họ cần trả lời nhất, và cũng là chỗ dễ nhầm nhất — nếu chưa chắc chắn, nói rõ là chưa chắc và nêu bằng chứng (ảnh chụp, message, response API) thay vì kết luận bừa.
- Đường dẫn tới HTML report và ảnh/trace của ca fail.
- Cái gì chưa cover được và tại sao (ví dụ: OTP qua SMS thật, cần mock).

Với bug log, dùng đúng giọng tester nhưng tách rõ `Pre`, bước, `KQTT`, `KQMM`, evidence và tần suất tái hiện. Giữ nguyên exact UI copy/test value cần đối chiếu, nhưng che PII, account ID, business/transaction ID và không tái sử dụng dữ liệu production. `Closed`, `Resolved` hoặc `Notbug` chỉ là trạng thái nguồn, không thay cho kết quả tái hiện/verify độc lập. Báo riêng `Reproduction outcome`, `Fix-verification verdict` và `Status recommendation`; không sửa status nguồn nếu người dùng chưa yêu cầu rõ. Mẫu đầy đủ nằm trong `references/bug-reproduction.md`.

## Checklist trước khi coi là xong

- [ ] Locator lấy từ DOM thật, không phải đoán
- [ ] Không còn `waitForTimeout` cứng nào không có lý do
- [ ] Test chạy được **hai lần liên tiếp** đều pass (chạy lại lần 2 để lộ test phụ thuộc dữ liệu cũ)
- [ ] Không có mật khẩu / token hard-code trong code — nằm ở `.env`, và `.env` đã `.gitignore`
- [ ] Tên test khớp mã test case của tester
- [ ] Với bug log: đã đọc full row + evidence + timeline, không chỉ title/status
- [ ] Bug ID/source row truy vết được và wording gốc vẫn còn bên cạnh bản chuẩn hóa
- [ ] Với bug log: actual/expected và fact/inference/unknown được tách riêng
- [ ] Trước verify: chính agent đã tái hiện baseline trên build gốc và lưu evidence; evidence lịch sử chỉ hỗ trợ điều tra, không thay gate này cho verdict `Verified fixed`
- [ ] Verify chạy đúng target build/deployment, platform, role, state và data class của bug gốc
- [ ] Không chỉ kiểm "lỗi biến mất": đã assert tích cực KQMM và side effect/persistence liên quan
- [ ] Đã chạy targeted regression quanh vùng sửa và ghi attempts `x/y` cho lỗi flaky
- [ ] Verdict verify (`Verified fixed`/`Failed`/`Partial`/`Regression`/`Not reproduced`/`Blocked`/`Inconclusive`) tách khỏi status nguồn
- [ ] Không dùng dữ liệu định danh hoặc giao dịch thật từ production trong test
- [ ] Mọi side effect trên production đã được người dùng cho phép rõ ràng; evidence đã che PII/secrets
- [ ] Đã nói rõ cách chạy lại và cách xem report

## Bản đồ tài liệu

| File | Nội dung |
|---|---|
| `references/bug-reproduction.md` | Đọc ngôn ngữ tester Việt, tái hiện/retest bug STG/UAT/prod, evidence, phân loại nguyên nhân, mẫu báo cáo |
| `references/project-setup.md` | Cài đặt, `playwright.config.ts`, đa môi trường, cấu trúc thư mục, npm scripts |
| `references/ui-e2e.md` | Locator, Page Object, assertion, upload/download, iframe, tab mới, dialog, table, date picker |
| `references/api-testing.md` | `request` fixture, kiểm tra status/schema, chain token, tạo dữ liệu qua API |
| `references/visual-responsive.md` | `toHaveScreenshot`, che vùng động, đa viewport, cross-browser, mobile emulation |
| `references/accessibility.md` | `@axe-core/playwright`, WCAG tags, xử lý vi phạm đã biết |
| `references/network-mocking.md` | `page.route`, HAR, giả lập lỗi 500/timeout/offline/mạng chậm |
| `references/auth-and-data.md` | `storageState`, đa role, per-worker auth, fixture, sinh & dọn dữ liệu test |
| `references/excel-to-spec.md` | Chuyển file test case Excel (mẫu UAT) thành spec + bảng truy vết |
| `references/reporting-ci.md` | Reporter, Allure, JUnit cho TestRail/Xray, GitHub Actions, Jenkins, GitLab, sharding, Docker |
| `references/performance.md` | Web Vitals, Lighthouse, đo thời gian tải, khi nào cần k6 |
| `references/troubleshooting.md` | Chẩn đoán flaky, timeout, lỗi chỉ xảy ra trên CI, selector gãy |

Script bundled (gọi trực tiếp, đọc `--help` trước, không đọc source):

| Script | Dùng khi |
|---|---|
| `scripts/explore.mjs` | Trinh sát trang thật, lấy locator có thật |
| `scripts/scaffold.mjs` | Dựng khung dự án Playwright TS mới |
| `scripts/excel_to_spec.py` | Đọc file test case `.xlsx` sinh spec skeleton + `test-map.json` |

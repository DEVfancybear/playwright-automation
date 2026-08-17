# Chẩn đoán: app hỏng hay test hỏng

Mục lục: [Quan sát trực tiếp](#bước-0--quan-sát-trực-tiếp) · [Quy trình chẩn đoán](#quy-trình-chẩn-đoán) · [Bug thật hay lỗi script](#bug-thật-hay-lỗi-script) · [Test flaky](#test-flaky-lúc-pass-lúc-fail) · [Timeout](#timeout) · [Locator không tìm thấy](#locator-không-tìm-thấy-phần-tử) · [Chỉ fail trên CI](#chỉ-fail-trên-ci) · [Lỗi thường gặp](#bảng-lỗi-thường-gặp)

Định tuyến trước khi đọc tiếp:

- **Chưa có spec nào** — người dùng chỉ nói "trang này lỗi" → đi thẳng xuống Bước 0, dùng công cụ browser. Đừng viết test để chẩn đoán một lỗi có thể nhìn thấy trực tiếp.
- **Đã có spec và nó fail** → dùng report/trace như phần còn lại của file này.

## Bước 0 — Quan sát trực tiếp

Rẻ nhất và nhanh nhất: mở app thật xem chuyện gì đang xảy ra, trước khi đụng tới trace hay `--debug`.

| Câu hỏi | Làm gì |
|---|---|
| App có lỗi JS không | Đọc console |
| Request nào fail, status bao nhiêu | Đọc network |
| Phần tử có tồn tại thật không, text là gì | Đọc cây accessibility / trích text |
| Cái gì đang che nút | `document.elementFromPoint(x, y)` |
| Trang render xong chưa | Đọc lại cây accessibility 2–3 lần, so sánh |

Nếu quan sát trực tiếp cho thấy app thật sự lỗi → đó là **bug của app**, không phải test hỏng, và thường không cần viết test nào để chứng minh. Xem `live-browser-investigation.md`.

## Quy trình chẩn đoán

Áp dụng khi **một spec đã viết** bị fail. Đừng đoán — Playwright ghi lại đủ bằng chứng để biết chính xác chuyện gì đã xảy ra:

```bash
npx playwright show-report              # 1. Xem test nào fail, message gì
npx playwright show-trace trace.zip     # 2. Mở trace: timeline + DOM từng bước + network
npx playwright test <file> --headed --debug   # 3. Chạy lại chậm, nhìn tận mắt
```

Trace là công cụ mạnh nhất. Nó cho phép **tua lại** từng hành động và xem DOM tại đúng thời điểm đó — nhìn là biết nút có tồn tại không, có bị che không, dữ liệu đã load chưa. Với lỗi thông thường, bật trace cho lượt điều tra:

```bash
npx playwright test --trace on
```

Với bug chỉ xuất hiện khi thao tác nhanh/race, trace/video có thể thêm overhead. Playwright xác nhận trace mọi test tốn tài nguyên, còn việc nó đổi tỷ lệ của bug cụ thể phải được đo. Chạy riêng profile low-overhead và evidence-rich theo `complex-flow-race-reproduction.md`; không bật instrumentation nặng cho mọi attempt rồi kết luận `Not reproduced`.

## Bug thật hay lỗi script

Đây là câu hỏi đầu tiên tester cần trả lời, và trả lời sai thì hoặc là báo bug oan cho dev, hoặc là bỏ lọt bug thật.

Nếu đầu vào là bug log STG/UAT/production, đọc `bug-reproduction.md` trước. Không kết luận từ một dấu hiệu duy nhất; status `Closed/Notbug`, HTTP 4xx/5xx hoặc locator timeout đều cần đối chiếu với đúng build, config/data, state và evidence.

| Dấu hiệu | Nhiều khả năng là |
|---|---|
| Ảnh chụp cho thấy app hiện thông báo lỗi / trang trắng / 500 | Có lỗi quan sát được; có thể là code, config/data, infra/dependency |
| Ảnh cho thấy app bình thường, nhưng locator không tìm thấy | **Lỗi script** (selector cũ, hoặc UI vừa đổi text) |
| Fail ở cùng một bước trên mọi trình duyệt, mọi lần chạy | Nghiêng về lỗi sản phẩm/chung backend; vẫn kiểm tra oracle và dữ liệu |
| Fail ngẫu nhiên, chạy lại thì pass | Thiếu chờ/dữ liệu hoặc race condition của app; ghi tỷ lệ trước khi phân loại |
| Chỉ fail khi chạy song song, chạy đơn thì pass | **Lỗi script** (test đụng dữ liệu nhau) |
| Chỉ fail trên CI | Thường là môi trường — xem mục riêng bên dưới |
| Network log có request trả 4xx/5xx | Tín hiệu backend/config/auth/data; đọc response và request context trước khi kết luận |

Cách kiểm chứng nhanh: **làm lại thao tác đó bằng tay trên đúng môi trường và cùng state/data class.** Khi báo cáo, nói rõ đã kiểm chứng thủ công hay chưa, fingerprint môi trường và bằng chứng nào hỗ trợ kết luận.

## Test flaky (lúc pass lúc fail)

Nguyên nhân theo thứ tự phổ biến:

**1. Phân biệt test thiếu chờ với product race/hydration**

```typescript
// Regression bình thường: chờ checkpoint readiness có nghĩa của app.
await expect(page.getByTestId('editor-status')).toHaveText('Sẵn sàng');
await page.getByRole('button', { name: 'Lưu' }).click();
```

Visible/enabled chỉ chứng minh actionability tương ứng, không chứng minh framework đã hydrate hay listener nghiệp vụ đã gắn. Nếu tester báo click ngay khi nút xuất hiện bị mất, thêm `toBeEnabled()`/sleep có thể che đúng bug sản phẩm. Trước tiên replay thao tác user-like không `force`, giữ cadence và đo `x/y`; sau đó mới chạy ready-gated như controlled variation. Chỉ coi là lỗi script khi acceptance criterion thực sự yêu cầu chờ một tín hiệu mà người dùng cũng thấy/tuân theo.

**2. Test phụ thuộc nhau**

Chạy lại một test riêng lẻ để kiểm tra:

```bash
npx playwright test -g "TC-ORD-05" --repeat-each=5
```

Pass khi chạy riêng nhưng fail khi chạy cả bộ ⇒ test này đang ăn ké dữ liệu/trạng thái do test khác để lại. Sửa bằng cách cho nó tự tạo dữ liệu của mình.

**3. Dữ liệu trùng khi chạy song song**

Hai worker cùng tạo `test@example.com` → một cái fail vì trùng. Sửa: sinh dữ liệu duy nhất (xem `references/auth-and-data.md`).

**4. Animation / render chưa xong**

```typescript
await expect(page.getByRole('dialog')).toBeVisible();
await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý' }).click();
```

Modal đang trượt vào thì Playwright có thể bấm trượt. Chờ trạng thái ổn định, hoặc tắt animation bằng CSS (xem `references/visual-responsive.md`).

**5. Thời gian và múi giờ**

Test tạo đơn lúc 23:59 rồi assert ngày hôm nay → chạy CI lúc nửa đêm là fail. Cố định thời gian:

```typescript
await page.clock.setFixedTime(new Date('2026-01-15T10:00:00'));
```

Công cụ tìm test flaky — chạy lặp lại nhiều lần. Khi đang đo tỷ lệ race của một case stateful, ưu tiên `--workers=1 --retries=0`; chỉ thêm workers/load như biến đối chứng riêng:

```bash
npx playwright test -g "TC-ORD-05" --repeat-each=10 --workers=1 --retries=0
```

Nếu 10 lần đều pass mà trên CI vẫn flaky, chưa đủ để gán nguyên nhân. So fingerprint, load/worker, cache/session, network và instrumentation giữa hai nơi rồi thay đổi từng biến một.

## Timeout

Message thường gặp:

```
Timeout 30000ms exceeded.
waiting for locator('button:has-text("Lưu")')
```

Nghĩa là hết 30 giây mà phần tử vẫn không ở trạng thái cần. Kiểm tra theo thứ tự:

1. **Phần tử có tồn tại không?** Mở trace, xem DOM ở bước đó. Nếu không có → app chưa render, hoặc chưa điều hướng tới đúng trang, hoặc locator sai.
2. **Có nhưng bị che?** Playwright chờ phần tử *nhận được* click. Loading overlay, cookie banner, chat widget hay che nút. Xử lý: đóng overlay trước, hoặc `await page.getByRole('button').scrollIntoViewIfNeeded()`.
3. **Có nhưng đang disabled?** Chờ `toBeEnabled()` trước.
4. **Thật sự chậm?** Báo cáo, export, upload file lớn cần timeout riêng:
   ```typescript
   await expect(page.getByText('Hoàn tất')).toBeVisible({ timeout: 120_000 });
   ```

Đừng phản xạ bằng cách tăng timeout toàn cục. Timeout dài chỉ làm test fail chậm hơn, còn nguyên nhân thật vẫn nằm nguyên đó.

`page.waitForLoadState('networkidle')` bị treo là chuyện thường với app có polling, websocket hoặc analytics chạy nền — không bao giờ có 500ms im lặng. Trong trường hợp đó, chờ phần tử cụ thể thay vì chờ mạng im.

## Locator không tìm thấy phần tử

```bash
npx playwright test --debug     # bật Inspector, dùng "Pick locator" trỏ vào phần tử
node scripts/explore.mjs --url <url>   # liệt kê lại toàn bộ locator có thật
```

Nguyên nhân hay gặp:

- **Text đổi**: "Đăng nhập" → "Đăng Nhập", hoặc thêm khoảng trắng/ký tự ẩn. Dùng regex: `getByRole('button', { name: /đăng nhập/i })`.
- **Phần tử trong iframe**: phải qua `frameLocator` (xem `references/ui-e2e.md`).
- **Phần tử trong shadow DOM**: locator của Playwright xuyên được shadow DOM mở, nhưng không xuyên được shadow DOM đóng.
- **Chưa render**: đang ở màn hình khác, hoặc cần cuộn xuống mới render (virtual scroll).
- **Dính nhiều phần tử**: message sẽ ghi `strict mode violation: resolved to N elements`. Thu hẹp bằng `filter()` hoặc vùng cha, không dùng `.first()` cho xong.

## Chỉ fail trên CI

| Nguyên nhân | Cách kiểm chứng / xử lý |
|---|---|
| Máy CI chậm hơn máy local | Tăng `timeout`, giảm `workers`, dùng máy khỏe hơn |
| Local có Chrome thật, CI dùng headless | Chạy local **không** kèm `--headed` — headless đã là mặc định (`npx playwright test`). Nếu config để `headless: false` thì override bằng `use: { headless: true }` khi so với CI |
| Font khác → visual test lệch | Sinh baseline trong Docker (xem `visual-responsive.md`) |
| Múi giờ khác (CI dùng UTC) | Đặt `timezoneId` khớp múi giờ tester dùng khi log bug (ví dụ `'Asia/Ho_Chi_Minh'`), đừng để CI tự dùng UTC |
| Ngôn ngữ khác | Đặt `locale` khớp ngôn ngữ giao diện đang test (ví dụ `'vi-VN'`) |
| Thiếu biến môi trường | Kiểm tra secrets/vars đã khai báo trong CI chưa |
| CI không vào được staging (firewall/VPN) | Kiểm tra network policy; cần whitelist IP của runner |
| Chromium crash trong Docker | Thêm `--ipc=host` khi chạy container |

Cách tái hiện môi trường CI ngay trên máy — thường tìm ra vấn đề trong vài phút:

```bash
docker run --rm --ipc=host -v "%cd%":/work -w /work \
  -e CI=true -e BASE_URL=https://staging.example.com \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  npx playwright test
```

## Bảng lỗi thường gặp

| Message | Nghĩa | Xử lý |
|---|---|---|
| `strict mode violation: resolved to 3 elements` | Locator dính nhiều phần tử | `filter()`, thu hẹp theo vùng cha |
| `Element is not visible` | Có trong DOM nhưng bị ẩn | Chờ `toBeVisible()`, kiểm tra có cần mở tab/menu trước |
| `Element is outside of the viewport` | Nằm ngoài màn hình | `scrollIntoViewIfNeeded()` |
| `Element is not stable` | Đang di chuyển (animation) | Chờ animation xong hoặc tắt animation |
| `intercepts pointer events` | Bị phần tử khác che | Đóng overlay/banner/chat widget trước |
| `Target page, context or browser has been closed` | Dùng `page` sau khi đã đóng | Kiểm tra thứ tự đóng context/thiếu `await` |
| `net::ERR_CONNECTION_REFUSED` | Server chưa chạy | Bật server, hoặc cấu hình `webServer` |
| `net::ERR_CERT_AUTHORITY_INVALID` | Chứng chỉ tự ký trên staging | `ignoreHTTPSErrors: true` |
| `Executable doesn't exist at ...` | Chưa cài trình duyệt | `npx playwright install --with-deps` |
| `browserType.launch: Host system is missing dependencies` | Thiếu thư viện hệ thống (Linux) | `npx playwright install-deps` hoặc dùng Docker image |
| `Test timeout of 30000ms exceeded` | Cả test quá lâu | Tách nhỏ test, hoặc tăng `timeout` cho test đó |
| `expect(received).toBe(expected)` trong test có `async` | Quên `await` | Bật ESLint rule `@typescript-eslint/no-floating-promises` |

Quên `await` là lỗi âm thầm nguy hiểm nhất với người mới: test vẫn "pass" vì assertion chưa kịp chạy xong thì test đã kết thúc. Bật rule ESLint ở trên để trình soạn thảo bắt giúp ngay lúc gõ.

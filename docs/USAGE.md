# Hướng dẫn sử dụng

Skill không có cú pháp phải học. Bạn mô tả việc cần làm bằng tiếng Việt như nói với đồng nghiệp; Codex hoặc Claude tự chọn công cụ phù hợp. Trong Codex, có thể gọi thẳng `$playwright-automation` khi muốn bắt buộc dùng skill.

Tài liệu này đi qua các kịch bản thật, kèm những gì bạn sẽ nhận được.

Mục lục: [Nói sao cho agent hiểu](#nói-sao-cho-agent-hiểu-đúng) · [KB1 Test nhanh](#kịch-bản-1--test-nhanh-một-chức-năng) · [KB2 Dựng suite](#kịch-bản-2--dựng-bộ-test-cho-dự-án) · [KB3 Từ Excel](#kịch-bản-3--từ-file-test-case-excel) · [KB4 API](#kịch-bản-4--test-api) · [KB5 Visual & responsive](#kịch-bản-5--visual-và-responsive) · [KB6 Accessibility](#kịch-bản-6--accessibility) · [KB7 Ca lỗi khó dựng](#kịch-bản-7--test-ca-lỗi-khó-dựng-bằng-tay) · [KB8 Test flaky](#kịch-bản-8--test-lúc-pass-lúc-fail) · [KB9 CI/CD](#kịch-bản-9--đưa-test-lên-cicd) · [Dùng script trực tiếp](#dùng-script-trực-tiếp) · [Bảo trì](#bảo-trì-suite-về-lâu-dài)

---

## Nói sao cho agent hiểu đúng

Ba thứ nên có trong yêu cầu đầu tiên. Thiếu thì agent sẽ hỏi, nhưng có sẵn thì nhanh hơn:

1. **URL** — staging, local hay production? Có cần đăng nhập không, tài khoản test là gì?
2. **Phạm vi** — một chức năng, một luồng nghiệp vụ, hay cả bộ regression?
3. **Đích đến** — chạy một lần cho biết kết quả, hay dựng suite để chạy lại lâu dài?

So sánh:

| Chưa đủ | Đủ để làm ngay |
|---|---|
| "Test giúp tôi trang web" | "Test luồng đặt hàng ở https://staging.congty.vn, tài khoản tester@congty.vn / Abc@12345, dựng thành suite chạy lại được" |
| "Viết test đăng nhập" | "Viết test đăng nhập cho https://staging.congty.vn/login, cần cả ca thành công và 4 ca lỗi validate" |
| "Test API" | "Test API `/api/orders` ở https://api-staging.congty.vn: GET danh sách, POST tạo đơn, và các ca lỗi 400/401/404" |

Đưa được file test case Excel hoặc tài liệu SRS thì càng tốt — trong đó thường đã có đủ tiền điều kiện, dữ liệu và kết quả mong đợi.

---

## Kịch bản 1 — Test nhanh một chức năng

Khi bạn chỉ muốn biết chức năng chạy đúng chưa, chưa cần dựng suite.

> Test giúp tôi chức năng tìm kiếm sản phẩm ở https://staging.congty.vn/products.
> Gõ "áo sơ mi" rồi bấm Tìm, xem kết quả có ra đúng không.

Agent sẽ:

1. Chạy `explore.mjs` trinh sát trang → lấy locator thật của ô tìm kiếm và nút Tìm.
2. Viết một spec ngắn dựa trên locator vừa lấy.
3. Chạy test, chụp màn hình.
4. Báo cáo: pass/fail, fail ở bước nào, và **đây là bug của app hay lỗi script**.

Kết quả trinh sát trông như thế này:

```
▸ Ô NHẬP LIỆU
  page.getByRole('searchbox', { name: 'Tìm kiếm sản phẩm' })
  page.getByRole('combobox', { name: 'Danh mục' })

▸ NÚT / LINK
  page.getByRole('button', { name: 'Tìm' })
  page.getByRole('button', { name: 'Chi tiết' })  ⚠ KHỚP 12

▸ LỖI CONSOLE (có thể đã là bug — kiểm chứng bằng tay)
  [error] Failed to load resource: 500 /api/categories
```

Dòng `⚠ KHỚP 12` là cảnh báo locator dính nhiều phần tử — Playwright sẽ báo lỗi strict mode nếu dùng thẳng. Agent sẽ tự thu hẹp bằng `.filter()`.

Lỗi console được nêu ra để bạn kiểm chứng, **không** để kết luận vội — có lỗi console không đồng nghĩa chức năng hỏng.

---

## Kịch bản 2 — Dựng bộ test cho dự án

> Dựng khung automation cho dự án. Staging ở https://staging.congty.vn,
> API ở https://api-staging.congty.vn. Cần test UI, API và visual. Chạy trên Jenkins.

Nhận được một dự án hoàn chỉnh:

```
e2e/
├── playwright.config.ts       # đa môi trường, reporter, retry, trace
├── .env.example               # mẫu biến môi trường
├── Jenkinsfile                # pipeline sẵn sàng chạy
├── pages/                     # Page Object — nơi duy nhất chứa locator
├── fixtures/                  # đăng nhập sẵn, client API
├── utils/data.ts              # sinh dữ liệu duy nhất, bộ giá trị biên
└── tests/{ui,api,visual}/     # spec mẫu theo từng loại
```

Sau đó:

```bash
cd e2e
npm install
npx playwright install --with-deps chromium
cp .env.example .env      # điền tài khoản test vào đây
npx playwright test --ui  # chế độ giao diện — tester rất dễ theo dõi
```

Bước tiếp theo nên làm ngay: nhờ agent trinh sát trang login thật và sửa `pages/LoginPage.ts`, vì locator trong template chỉ là phỏng đoán cho form đăng nhập điển hình.

> Trinh sát https://staging.congty.vn/login rồi sửa lại LoginPage.ts và auth.setup.ts cho khớp.

---

## Kịch bản 3 — Từ file test case Excel

Nếu bạn đã có file KỊCH BẢN NGHIỆM THU / UAT, đừng viết lại từ đầu.

> Đây là file "KỊCH BẢN NGHIỆM THU.xlsx". Chuyển sheet "Đăng nhập" thành script Playwright.

Agent chạy `excel_to_spec.py`, tự dò dòng tiêu đề và các cột (tiếng Việt có dấu, không dấu, hoặc tiếng Anh), xử lý được cả ô gộp và test case trải nhiều dòng:

```
▸ Đăng nhập
   Dòng tiêu đề: 5
   Cột nhận diện: id='Mã test case', title='Mục tiêu', precondition='Tiền điều kiện',
                  steps='Các bước thực hiện', expected='Kết quả mong đợi'
   Test case đọc được: 4
     · TC-DN-01 — Đăng nhập thành công với tài khoản hợp lệ (4 bước, 3 kết quả)
     · TC-DN-04 — Khóa tài khoản sau 5 lần sai mật khẩu (3 bước, 4 kết quả)
```

Khung sinh ra giữ nguyên cấu trúc test case gốc:

```typescript
/**
 * Tiền điều kiện: Đã có tài khoản hợp lệ trên hệ thống
 * Dữ liệu: user01@example.com / Abc@12345
 * Dòng trong Excel: 6
 */
test('TC-DN-01: Đăng nhập thành công với tài khoản hợp lệ', async ({ page }) => {
  await test.step('1. Mở trang đăng nhập', async () => {
    // TODO: Mở trang đăng nhập
  });
  ...
  await test.step('Kết quả mong đợi: Đăng nhập thành công | Chuyển sang trang chủ', async () => {
    // TODO: assertion cho — Đăng nhập thành công
    expect(true, 'Chưa hiện thực assertion cho ca này').toBe(false);
  });
});
```

Dòng `expect(true, ...).toBe(false)` **cố tình fail**. Một khung test luôn xanh nguy hiểm hơn không có test, vì nó tạo cảm giác đã kiểm tra trong khi chưa kiểm tra gì. Bạn phải xử lý nó trước khi merge.

Kèm theo là `test-map.json` để trả lời câu hỏi "test case nào đã tự động hóa" bằng dữ liệu:

```json
[{ "tc_id": "TC-DN-01", "sheet": "Đăng nhập", "excel_row": 6,
   "spec_file": "dang-nhap.spec.ts", "status": "generated" }]
```

Sau đó nhờ agent điền tiếp:

> Trinh sát https://staging.congty.vn/login rồi điền hết TODO trong dang-nhap.spec.ts.

**Lưu ý về phạm vi.** Không phải test case nào cũng đáng tự động hóa. Nên bỏ qua ca chỉ chạy một lần, ca phụ thuộc đánh giá của con người ("giao diện có đẹp không"), ca cần thiết bị ngoài trình duyệt (ký số USB token, máy POS), và luồng còn đang thay đổi từng ngày. Agent sẽ nêu ý kiến về những ca này thay vì sinh hết mọi dòng.

---

## Kịch bản 4 — Test API

> Test API `/api/orders` ở https://api-staging.congty.vn.
> Cần: GET danh sách, POST tạo đơn, và các ca lỗi.

Test API không cần trình duyệt nên nhanh hơn test UI hàng chục lần. Với tester mới làm automation, đây thường là nơi nên bắt đầu.

Agent sẽ phủ theo checklist:

- Happy path — đúng status và đúng body
- Thiếu trường bắt buộc → 400, message chỉ rõ trường nào
- Sai kiểu dữ liệu → 400
- Không token / token hết hạn → 401
- Không đủ quyền → 403
- Id không tồn tại → 404
- Giá trị biên: chuỗi rỗng, độ dài tối đa, số âm, tiếng Việt có dấu, emoji
- Phân trang: trang cuối, trang vượt quá
- **Response không lộ thông tin nhạy cảm** (hash mật khẩu, token nội bộ)

Mục cuối hay bị bỏ sót nhưng là bug nghiêm trọng nhất: API trả thừa trường là rò rỉ dữ liệu, kể cả khi giao diện không hiển thị trường đó.

Kỹ thuật đáng dùng nhất — **chuẩn bị dữ liệu qua API, kiểm chứng qua UI**:

> Test luồng đơn hàng: tạo đơn bằng API cho nhanh, rồi kiểm tra đơn hiện đúng trên giao diện.

Cách này làm suite vừa nhanh vừa ổn định hơn hẳn so với bấm qua giao diện để tạo dữ liệu.

---

## Kịch bản 5 — Visual và responsive

> Kiểm tra giao diện trang chủ có bị vỡ trên mobile, tablet, desktop không.

Nhận được test đa viewport, kèm kiểm tra tràn ngang — thứ bắt được rất nhiều lỗi responsive mà không cần ảnh baseline:

```typescript
test('không bị tràn ngang trên mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow, 'Trang bị tràn ngang ở 375px').toBe(false);
});
```

Với visual regression (so sánh ảnh), cần biết trước hai điều:

- **Lần chạy đầu luôn fail** và tự tạo ảnh gốc. Cố ý — bạn phải mở ảnh xem và xác nhận đúng trước khi commit.
- **Ảnh gốc gắn với hệ điều hành.** Ảnh chụp trên Windows sẽ không khớp khi CI chạy Linux vì font render khác nhau. Sinh baseline trong Docker để đồng nhất — agent sẽ hướng dẫn.

Giao diện đổi có chủ đích thì cập nhật ảnh gốc:

```bash
npx playwright test --update-snapshots
```

Rồi **mở phần diff trong report xem từng ảnh** trước khi commit. Chạy `-u` một cách máy móc là ghi đè bug thành "chuẩn mới".

---

## Kịch bản 6 — Accessibility

> Kiểm tra trang chủ và trang thanh toán có đạt WCAG 2.1 AA không.

Agent dùng `@axe-core/playwright`, gắn kết quả vi phạm vào HTML report kèm link hướng dẫn sửa cho từng lỗi.

Khi báo cáo lại cho khách hàng, đừng viết "app đã đạt WCAG AA". Quét tự động chỉ bắt được khoảng 30–40% vấn đề — nó biết ảnh thiếu `alt`, nhưng không biết `alt="hình ảnh"` là vô nghĩa. Cách nói đúng: *"quét tự động không phát hiện vi phạm WCAG 2.1 AA; các hạng mục cần kiểm tra thủ công gồm trình đọc màn hình, thao tác chỉ bằng bàn phím, thứ tự đọc hợp lý"*.

---

## Kịch bản 7 — Test ca lỗi khó dựng bằng tay

Đây là nhóm ca có giá trị cao nhất mà kiểm thử thủ công gần như không làm được.

> Kiểm tra app xử lý thế nào khi API trả lỗi 500, khi mất mạng giữa chừng,
> và khi danh sách rỗng.

```typescript
test('TC-ERR-01: hiện thông báo khi server lỗi 500', async ({ page }) => {
  await page.route('**/api/orders*', route =>
    route.fulfill({ status: 500, json: { message: 'Internal Server Error' } })
  );
  await page.goto('/orders');
  await expect(page.getByText('Có lỗi xảy ra, vui lòng thử lại')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
});
```

Mock được cả các trường hợp: token hết hạn giữa phiên, mạng 3G chậm, offline, thanh toán thất bại, và **nút "Thử lại" có thật sự hoạt động không** (lần đầu trả lỗi, lần sau trả thành công).

Cân bằng khi dùng mock: mock bên thứ ba (thanh toán, SMS/OTP, bản đồ) và ca lỗi; **đừng mock chính API sản phẩm trong bộ regression chính**. Nếu backend đổi format mà mock giữ format cũ, test xanh trong khi production đã hỏng — kiểu sai lầm nguy hiểm nhất vì tạo cảm giác an toàn giả.

---

## Kịch bản 8 — Test lúc pass lúc fail

> Test TC-ORD-05 chạy trên Jenkins lúc pass lúc fail, mà chạy máy tôi thì luôn xanh.

Agent sẽ chẩn đoán theo thứ tự nguyên nhân phổ biến: thiếu chờ, test phụ thuộc nhau, dữ liệu trùng khi chạy song song, animation chưa xong, hoặc vấn đề múi giờ.

Công cụ hay dùng:

```bash
npx playwright test -g "TC-ORD-05" --repeat-each=10 --workers=4
```

Pass khi chạy riêng nhưng fail khi chạy cả bộ ⇒ test đang ăn ké dữ liệu/trạng thái do test khác để lại.

Câu hỏi quan trọng nhất khi một test fail — và cũng dễ nhầm nhất:

| Dấu hiệu | Nhiều khả năng là |
|---|---|
| Ảnh chụp cho thấy app hiện lỗi / trang trắng / 500 | **Bug của app** |
| Ảnh cho thấy app bình thường, nhưng locator không tìm thấy | **Lỗi script** |
| Fail cùng một bước trên mọi trình duyệt, mọi lần chạy | **Bug của app** |
| Chỉ fail khi chạy song song | **Lỗi script** — test đụng dữ liệu nhau |

Cách kiểm chứng chắc chắn nhất vẫn là **làm lại thao tác đó bằng tay trên đúng môi trường đó** — mất 2 phút và cho câu trả lời dứt khoát.

---

## Kịch bản 9 — Đưa test lên CI/CD

> Cấu hình chạy test tự động trên GitHub Actions mỗi khi merge, và chạy regression 5h sáng hằng ngày.

Nhận được workflow đầy đủ: cài trình duyệt, biến môi trường tách secrets/vars, lưu report kể cả khi fail, và tuỳ chọn bắn thông báo Slack.

Suite lớn thì chia nhỏ chạy song song (sharding) rồi gộp report — agent sẽ dựng cả job `merge-reports`, vì thiếu nó bạn nhận về 4 report rời rạc và không ai biết tổng thể pass bao nhiêu.

Xuất kết quả về TestRail / Jira Xray: cả hai đều nhận file JUnit XML có sẵn trong cấu hình. Để map đúng, đặt mã TC ngay trong tên test.

**Nguyên tắc quan trọng hơn mọi cấu hình:** suite đỏ phải được sửa trong ngày. Một suite đỏ triền miên sẽ bị cả team học cách phớt lờ, và khi đó nó tệ hơn cả không có — vì vẫn tốn công bảo trì. Test hỏng chưa sửa ngay được thì dùng `test.fixme()` kèm mã ticket thay vì để đỏ mãi.

---

## Dùng script trực tiếp

Ba script chạy được độc lập ngoài Codex/Claude. Mỗi script đều có `--help` đầy đủ.

### Trinh sát trang

```bash
# Cơ bản
node scripts/explore.mjs --url https://staging.congty.vn/login --out ./recon

# Trang cần đăng nhập — tự đăng nhập rồi lưu phiên để lần sau dùng lại
node scripts/explore.mjs --url https://staging.congty.vn/orders \
  --login-url https://staging.congty.vn/login \
  --username tester@congty.vn --password 'Abc@12345' \
  --save-auth .auth/user.json

# Lần sau dùng lại phiên đã lưu
node scripts/explore.mjs --url https://staging.congty.vn/orders --auth .auth/user.json

# Phần tử chỉ hiện sau khi bấm (modal, tab, menu)
node scripts/explore.mjs --url https://staging.congty.vn --click "Đăng ký"

# Xem giao diện mobile
node scripts/explore.mjs --url https://staging.congty.vn --device "iPhone 14"
```

Chạy script **từ trong thư mục dự án** có cài Playwright.

### Dựng khung dự án

```bash
node scripts/scaffold.mjs --dir ./e2e --dry-run          # xem trước, chưa ghi file

node scripts/scaffold.mjs --dir ./e2e \
  --base-url https://staging.congty.vn \
  --api-url https://api-staging.congty.vn \
  --features ui,api,visual,a11y \
  --ci jenkins
```

Mặc định **không ghi đè** file đã tồn tại — thêm `--force` nếu thật sự muốn.

### Đọc file test case Excel

```bash
python scripts/excel_to_spec.py --file testcase.xlsx --list-sheets
python scripts/excel_to_spec.py --file testcase.xlsx --dry-run          # kiểm tra dò cột đúng chưa
python scripts/excel_to_spec.py --file testcase.xlsx --out ./tests/generated

# Dò sai thì chỉ định tay
python scripts/excel_to_spec.py --file testcase.xlsx \
  --sheet "Đăng nhập" --header-row 5 \
  --col-id "STT" --col-expected "Kết quả mong đợi"
```

Luôn chạy `--dry-run` trước để xác nhận script đọc đúng cột.

---

## Bảo trì suite về lâu dài

Suite automation không phải làm xong là xong. Vài thói quen giữ nó sống được:

**Chạy hai lần liên tiếp trước khi coi là xong.** Lần chạy thứ hai lộ ra test phụ thuộc dữ liệu do lần một để lại — lỗi này rất hay gặp và rất khó chịu về sau.

**Locator chỉ nằm trong `pages/`.** Thấy `page.locator(...)` trong file spec nghĩa là locator đó đang thiếu chỗ đứng. Khi giao diện đổi, bạn sửa một chỗ thay vì lùng khắp suite.

**Tên test khớp mã test case của tester.** Người đọc report phải nhận ra ngay đây là ca nào trong file test case của họ.

**Giao diện đổi thì nhờ agent trinh sát lại:**

> Trang đơn hàng vừa đổi giao diện, test TC-ORD-03 fail vì không tìm thấy nút.
> Trinh sát lại rồi sửa Page Object.

**Đừng để suite đỏ qua đêm.** Nếu chưa sửa được ngay:

```typescript
test.fixme('TC-ORD-09: xuất Excel đơn hàng — chờ fix BUG-456', async ({ page }) => { ... });
```

Cách này trung thực hơn nhiều so với xoá test hoặc để nó đỏ mãi: bạn vẫn thấy nó trong report, kèm lý do và mã ticket.

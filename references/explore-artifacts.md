# Artefact của phiên EXPLORE: ghi lại và dùng lại

Mục lục: [Vì sao cần](#vì-sao-cần) · [Thư mục artefact](#thư-mục-artefact) · [Nhật ký hành trình](#nhật-ký-hành-trình) · [Điểm chốt](#điểm-chốt-precondition-dùng-lại) · [Ghi use case](#ghi-use-case--sinh-tài-liệu-test-case) · [HAR](#har-theo-use-case) · [Phiên đăng nhập](#phiên-đăng-nhập) · [Config target](#config-target-chạy-lại-lần-sau-không-phải-hỏi-lại) · [Khi nào phải explore lại](#khi-nào-phải-explore-lại)

## Vì sao cần

Bước EXPLORE là bước đắt nhất của pipeline: phải mở trình duyệt, đăng nhập, đi qua wizard, bật feature flag, chờ dữ liệu load. Nếu không ghi lại, mỗi lần chạy pipeline lại phải trả cái giá đó từ đầu — và tệ hơn, mỗi lần lại quan sát ra một phiên bản hơi khác nhau.

File này định nghĩa **cái gì được ghi, ghi ở đâu, dùng lại thế nào**. Hai lợi ích cụ thể:

- **Lần chạy thứ hai gần như tức thì**: PLAN và GENERATE đọc lại nhật ký đã lưu, không mở trình duyệt.
- **Tester nhận thêm một sản phẩm miễn phí**: tài liệu test case thủ công sinh ra từ chính thao tác của họ.

## Thư mục artefact

```
.testagent/
├── <target>/
│   ├── journey.md          # Nhật ký hành trình — đầu vào của PLAN
│   ├── test-plan.md        # Bảng plan đã duyệt ở bước CONFIRM
│   ├── checkpoints/
│   │   └── after-login.md  # Điểm chốt dùng lại làm precondition
│   ├── use-cases/
│   │   └── dat-hang.md     # Tài liệu test case thủ công sinh từ thao tác
│   └── network/
│       └── dat-hang.har    # HAR theo từng use case
└── .gitignore
```

**Gitignore mặc định cả `.testagent/`** — nó chứa URL nội bộ, tên tài khoản, đôi khi cả token trong HAR. Hai thứ đáng lôi ra khỏi đó để commit:

| File | Chuyển đi đâu | Vì sao |
|---|---|---|
| `use-cases/*.md` | `docs/test-cases/` hoặc file test case của team | Đây là tài liệu nghiệp vụ, không phải rác tạm |
| `test-plan.md` | Cạnh bộ spec, hoặc đính vào ticket | Là bản ghi "đã thoả thuận test những gì" |

Đừng tự chuyển — hỏi người dùng ở bước VERDICT xem có muốn giữ hai file đó không.

## Nhật ký hành trình

Mỗi màn hình đi qua ghi một mục. Đây là thứ PLAN và GENERATE đọc, nên phải đủ để viết `test.step` mà không cần mở lại trình duyệt.

```markdown
# Journey — checkout-staging
Ghi lúc: 2026-08-20 14:32 (+07) · Build: 2.4.1 · Trình duyệt: Chrome profile thật
Tài khoản: qa_user01 (role: shopper)

## 1. Trang đăng nhập — /login
- Đã làm: điền SĐT `0900000001`, mật khẩu do người dùng nhập
- Element: textbox "Số điện thoại" · textbox "Mật khẩu" · button "Đăng nhập"
- Network: POST /api/auth/login → **204** (không có body, chỉ set cookie)
- Console: sạch

## 2. Trang chủ — /
- Đã làm: bấm "Giỏ hàng"
- Element: heading "Trang chủ" [level=1] · link "Giỏ hàng" · status "0"
- Network: GET /api/cart → 200 `{ items: [], total: 0 }`

## 3. Giỏ hàng — /cart
- Đã làm: thêm "Ba lô Sauce Labs", quan sát badge
- Element: button "Thêm vào giỏ" · status "1" (badge)
- Network: POST /api/cart/items → 201
- ⚠ Quan sát: badge mất ~1,2 s mới cập nhật; nghi optimistic update chậm
```

Ba thứ **bắt buộc** trong mỗi mục: URL, `role + name` của element đã chạm vào, và endpoint + status. Thiếu cái nào thì bước GENERATE lại phải đoán đúng cái đó.

Ký hiệu `⚠` cho quan sát bất thường — đây chính là ứng viên scenario cho PLAN.

## Điểm chốt (precondition dùng lại)

Một số trạng thái tốn nhiều bước mới tới được và được **nhiều scenario dùng chung**: "đã đăng nhập", "đã có đơn nháp", "đã qua bước KYC". Ghi chúng riêng ra để PLAN tham chiếu thay vì lặp lại các bước trong từng scenario.

```markdown
# Checkpoint — after-login
Tới đây bằng: bước 1 của journey.md
Trạng thái: đã đăng nhập role shopper, giỏ hàng trống, ở trang chủ /
Dựng lại nhanh trong spec: nạp `.auth/checkout-staging.json` qua storageState — không cần đi lại UI
Xác nhận đã tới đúng: `heading "Trang chủ"` hiển thị và `GET /api/cart` trả 200
```

Trong bảng PLAN, scenario chỉ cần ghi `Phụ thuộc: after-login`. Trong spec, checkpoint thành `storageState` hoặc một `beforeEach` gọi API dựng state — không phải chuỗi click lặp lại ở mọi test.

## Ghi use case → sinh tài liệu test case

Đây là phần trả lại giá trị lớn nhất cho tester thủ công: **họ đi một luồng, agent viết ra tài liệu test case của luồng đó.**

Cách làm: khi người dùng nói "ghi lại luồng này" hoặc khi một chuỗi bước rõ ràng tạo thành một nghiệp vụ hoàn chỉnh, đánh dấu đoạn đó trong nhật ký hành trình (từ bước i tới bước j), đặt tên, rồi sinh tài liệu theo mẫu dưới.

```markdown
## UC-01: Đặt hàng thành công bằng tài khoản đã đăng nhập

**Pre:**
- Tài khoản shopper còn hiệu lực (alias: `qa_user01`)
- Giỏ hàng trống
- Sản phẩm "Ba lô Sauce Labs" còn hàng

**Các bước thực hiện:**
1. Đăng nhập bằng SĐT và mật khẩu hợp lệ → vào trang chủ, badge giỏ hàng hiện "0"
2. Mở trang sản phẩm, bấm "Thêm vào giỏ" → badge chuyển thành "1"
3. Mở giỏ hàng → thấy đúng "Ba lô Sauce Labs" kèm đơn giá
4. Bấm "Thanh toán", điền Họ "Test", Tên "User", Mã bưu chính "12345" → sang bước xác nhận
5. Đối chiếu tổng tiền → Tổng = tiền hàng + thuế
6. Bấm "Hoàn tất" → hiện "Cảm ơn bạn đã đặt hàng!", giỏ hàng về trống

**KQMM:** Đơn được tạo, màn hình xác nhận hiển thị, giỏ hàng rỗng sau khi hoàn tất.

**Tiêu chí pass:**
- Mỗi bước cho ra đúng kết quả ghi ở trên
- Tổng tiền khớp công thức, không lệch do làm tròn
- Không có lỗi console của ứng dụng trong cả luồng

**Nguồn:** ghi từ phiên EXPLORE 2026-08-20 trên build 2.4.1, bước 1–6 của `journey.md`.
**Truy vết:** SRS §4.2, TC-ORD-01
```

Bốn luật khi sinh tài liệu này:

- **Chỉ viết những gì đã quan sát được.** Không thêm bước "hợp lý" mà người dùng chưa đi qua. Bước nào chưa kiểm thì ghi ở phần *Ngoài phạm vi*, không viết như đã kiểm.
- **KQMM lấy từ nguồn hạng cao, không lấy từ màn hình.** Nếu chưa có SRS/test case nào chống lưng, ghi `KQMM: chưa có acceptance criterion — mô tả dưới đây là hành vi quan sát được` rồi hỏi người dùng xác nhận. Xem `test-plan-and-traceability.md`.
- **Giữ nguyên exact UI copy** ("Cảm ơn bạn đã đặt hàng!") vì nó là oracle; nhưng che PII, số điện thoại thật, mã đơn thật.
- **Dùng đúng từ vựng của team** (`Pre`, `KQMM`, `KQTT`) nếu họ đang dùng, để tài liệu dán thẳng vào file test case có sẵn được.

Tài liệu này đi tiếp vào hai chỗ: thành dòng trong bảng PLAN, và thành `test.step` trong spec ở bước GENERATE. Một luồng, ba dạng biểu diễn, không phải viết lại ba lần.

## HAR theo use case

Khi luồng có API đáng quan tâm, cắt HAR theo đúng khoảng thời gian của use case đó thay vì một file khổng lồ cho cả phiên:

```typescript
const context = await browser.newContext({
  recordHar: { path: '.testagent/checkout-staging/network/dat-hang.har', content: 'omit' },
});
```

`content: 'omit'` bỏ body response ra khỏi file — nhẹ hơn nhiều và giảm rủi ro lộ dữ liệu. Cần body để chẩn đoán thì dùng `content: 'embed'` và **che secret trước khi đính kèm cho DEV**.

HAR dùng được hai việc: bằng chứng DEV mở thẳng bằng Chrome DevTools (Network → import HAR), và input cho `routeFromHAR` nếu sau này muốn chạy spec offline — xem `network-mocking.md`.

## Phiên đăng nhập

Lưu `storageState` ngay sau khi đăng nhập thành công trong phiên EXPLORE:

```typescript
await context.storageState({ path: '.auth/checkout-staging.json' });
```

`.auth/` đã nằm trong `.gitignore` của khung scaffold. File này chứa cookie thật — ai có nó là vào được tài khoản, nên không đính kèm vào ticket, không dán vào chat. Chi tiết cách nạp lại trong spec: `auth-and-data.md`.

## Config target: chạy lại lần sau không phải hỏi lại

Bước FRAME hỏi URL, môi trường, tài khoản, nguồn grounding, nơi đặt spec. Hỏi một lần là đủ — ghi lại thành `.testagent.yaml` ở gốc repo rồi lần sau đọc file thay vì phỏng vấn lại.

```yaml
version: 1
targets:
  - name: checkout-staging
    url: https://staging.example.com
    auth:
      strategy: form                 # none | form | reuse-state
      credentials_env: [APP_USER, APP_PASS]   # tên biến môi trường, KHÔNG phải giá trị
      storage_state: .auth/checkout-staging.json
    grounding:                       # theo thứ tự tin cậy
      requirements: [docs/requirements/checkout.md]
      manual_tests: [test-cases/checkout.xlsx]
      business: [docs/domain/*.md]
    scope:
      feature: checkout
    success:
      min_scenarios: 3
      must_pass: true
      stability_runs: 3
    output_dir: e2e/tests
    allow_hosts: []                  # host không khớp mẫu staging phải khai ở đây
```

Ba luật:

- **Không bao giờ đặt giá trị credential trong file này.** Chỉ đặt *tên biến môi trường*. File này được commit; `.env` thì không.
- **`allow_hosts` là cổng an toàn, không phải tiện ích.** Host không phải `localhost`/IP nội bộ và không khớp `staging|stg|test|qa|dev|uat` thì mặc định bị coi là production. Muốn chạy trên nó phải khai vào đây, và người dùng phải biết mình đang khai gì.
- **`success` là hợp đồng của bước VERDICT.** `min_scenarios` chặn việc "1 test pass" được báo là xanh; `stability_runs` là số lượt của cổng ổn định.

Có file này rồi thì bước FRAME chỉ còn xác nhận một dòng: *"Chạy trên target `checkout-staging` (staging.example.com, scope checkout) như config, đúng chứ?"*

## Khi nào phải explore lại

Dùng lại nhật ký cũ là để tiết kiệm, không phải để tin mù. **Bỏ artefact cũ và explore lại** khi có bất kỳ dấu nào sau đây:

| Dấu hiệu | Vì sao artefact cũ hết giá trị |
|---|---|
| Build/version đích khác với dòng `Build:` trong journey | Label, route, endpoint đều có thể đã đổi |
| Đang verify fix sau khi DEV sửa | Cả điểm của việc verify là quan sát lại trên build mới |
| Spec fail ở bước HEAL | Artefact cũ chính là thứ vừa dẫn tới locator sai |
| Đổi role, môi trường, hoặc data class | Cùng URL nhưng khác quyền thì màn hình khác nhau |
| Journey ghi quá 7 ngày trước | Ngưỡng mặc định; app đang phát triển thì rút ngắn |

Ngược lại, **được dùng lại** khi: cùng build, cùng role, chỉ bổ sung thêm scenario cho vùng đã quan sát, hoặc đang sửa lỗi cú pháp/cấu trúc của spec chứ không phải lỗi locator.

Mỗi lần dùng lại artefact thay vì explore mới, **nói rõ trong VERDICT**: `EXPLORE: dùng lại journey.md ghi 2026-08-20 trên build 2.4.1 (không mở lại trình duyệt)`. Người đọc cần biết kết luận này dựa trên quan sát mới hay quan sát cũ.

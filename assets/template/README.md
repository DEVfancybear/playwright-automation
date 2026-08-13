# {{PROJECT_NAME}}

Bộ test tự động cho **{{BASE_URL}}** — Playwright + TypeScript.

## Cài đặt lần đầu

```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env      # rồi mở .env điền tài khoản test
```

## Chạy test

| Việc cần làm | Lệnh |
|---|---|
| Chế độ giao diện (dễ theo dõi nhất) | `npm run test:ui` |
| Chạy tất cả | `npm test` |
| Chạy và xem trình duyệt | `npm run test:headed` |
| Chỉ bộ smoke | `npm run test:smoke` |
| Chỉ test API | `npm run test:api` |
| Một file | `npx playwright test tests/ui/login.spec.ts` |
| Một ca cụ thể | `npx playwright test -g "TC-LOGIN-01"` |
| Debug từng bước | `npm run test:debug` |
| Xem report | `npm run report` |
| Ghi thao tác thành code | `npm run codegen` |

## Cấu trúc

```
pages/        Page Object — nơi duy nhất chứa locator
fixtures/     Chuẩn bị dùng chung: đăng nhập sẵn, client API, dữ liệu
utils/        Helper thuần: sinh dữ liệu, format
tests/
  auth.setup.ts   Đăng nhập một lần, lưu phiên vào .auth/
  ui/             Test giao diện
  api/            Test API (file đặt tên *.api.spec.ts)
  visual/         Visual regression
  a11y/           Accessibility
```

## Quy ước

- **Tên test bắt đầu bằng mã test case**: `TC-LOGIN-01: đăng nhập thành công` — để đối chiếu được với file test case của tester.
- **Tag để lọc**: thêm `@smoke` / `@regression` vào cuối tên test.
- **Locator chỉ nằm trong `pages/`**. Thấy `page.locator(...)` trong file spec là dấu hiệu cần đưa nó vào Page Object.
- **Không hard-code dữ liệu**: dùng `utils/data.ts` để sinh dữ liệu duy nhất, tránh đụng nhau khi chạy song song.
- **Không dùng `waitForTimeout`**: chờ đúng thứ cần chờ bằng `expect(...)`, `waitForURL`, `waitForResponse`.

## Khi test fail

1. `npm run report` — xem fail ở bước nào, có ảnh và video.
2. Mở trace trong report để tua lại từng bước và xem DOM tại thời điểm đó.
3. Xác định: **bug của app** hay **lỗi script**? Cách nhanh nhất là làm lại thao tác đó bằng tay trên cùng môi trường.

## Biến môi trường

Xem `.env.example`. Chạy trên môi trường khác mà không sửa file:

```bash
BASE_URL=https://uat.example.com npx playwright test
```

```powershell
$env:BASE_URL="https://uat.example.com"; npx playwright test
```

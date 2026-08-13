# Visual regression, responsive và cross-browser

Mục lục: [Visual regression](#visual-regression) · [Che vùng thay đổi](#che-vùng-luôn-thay-đổi) · [Quản lý ảnh gốc](#quản-lý-ảnh-gốc-baseline) · [Responsive](#test-responsive) · [Cross-browser](#cross-browser) · [Giả lập mobile](#giả-lập-thiết-bị-mobile) · [Kiểm tra layout không cần ảnh](#kiểm-tra-layout-không-cần-ảnh)

## Visual regression

Ý tưởng: chụp ảnh màn hình lần đầu làm chuẩn (baseline), các lần sau so sánh pixel. Bắt được đúng loại bug mà assertion text không bao giờ thấy — chữ tràn khung, nút lệch, CSS vỡ sau khi nâng thư viện.

```typescript
import { test, expect } from '@playwright/test';

test('giao diện trang chủ không đổi', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('trang-chu.png', { fullPage: true });
});

test('component thẻ sản phẩm', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByTestId('product-card').first()).toHaveScreenshot('the-san-pham.png');
});
```

Lần chạy đầu tiên sẽ **fail và tự tạo ảnh gốc** — đó là hành vi cố ý, để bạn phải xem ảnh và xác nhận nó đúng trước khi commit. Đừng chạy `--update-snapshots` một cách máy móc, vì làm vậy là ghi đè bug thành "chuẩn mới".

## Che vùng luôn thay đổi

Đây là lý do số 1 khiến visual test bị bỏ. Ngày giờ, avatar random, quảng cáo, số liệu realtime — tất cả đều làm ảnh khác nhau mỗi lần chạy.

```typescript
await expect(page).toHaveScreenshot('dashboard.png', {
  fullPage: true,

  // Che hẳn vùng động (Playwright phủ ô màu hồng lên trước khi chụp)
  mask: [
    page.getByTestId('current-time'),
    page.getByTestId('user-avatar'),
    page.locator('.ads-banner'),
  ],

  // Dừng animation và ẩn con trỏ nhấp nháy
  animations: 'disabled',
  caret: 'hide',

  // Cho phép sai lệch nhỏ do khác biệt render giữa các máy
  maxDiffPixelRatio: 0.01,
});
```

Cách bền hơn cho toàn suite: một file CSS dùng chung để tắt animation và ẩn phần tử động.

`screenshot.css`
```css
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
}
[data-dynamic], .toast, .ads-banner { visibility: hidden !important; }
```

```typescript
// playwright.config.ts
expect: {
  toHaveScreenshot: {
    stylePath: './screenshot.css',
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
  },
},
```

Ngoài ra nên đóng băng dữ liệu đầu vào: cố định ngày giờ và mock API trả dữ liệu cố định (xem `references/network-mocking.md`). Ảnh chỉ ổn định khi *đầu vào* ổn định — chỉnh ngưỡng sai lệch chỉ là chữa triệu chứng.

```typescript
await page.clock.setFixedTime(new Date('2026-01-15T10:00:00'));
```

## Quản lý ảnh gốc (baseline)

Ảnh gốc gắn với **hệ điều hành và trình duyệt** — tên file tự động thành `trang-chu-chromium-win32.png`. Ảnh chụp trên Windows sẽ không khớp khi CI chạy Linux, vì font render khác nhau. Hai cách xử lý:

1. **Sinh baseline trong Docker** (khuyến nghị) để local và CI cùng một môi trường:
   ```bash
   docker run --rm -v "%cd%":/work -w /work mcr.microsoft.com/playwright:v1.62.1-noble \
     npx playwright test --update-snapshots
   ```
2. Hoặc chỉ chạy visual test trên CI, không chạy local.

Cập nhật ảnh gốc sau khi giao diện đổi có chủ đích:

```bash
npx playwright test --update-snapshots                       # tất cả
npx playwright test tests/visual/home.spec.ts -u             # 1 file
```

Quy trình làm việc lành mạnh: giao diện đổi → chạy `-u` → **mở phần diff trong HTML report xem từng ảnh** → nếu đúng ý thì commit ảnh mới kèm code. Ảnh baseline phải nằm trong git; coi chúng như một phần của test.

## Test responsive

Khai báo các viewport thành project riêng để cùng một bộ test chạy trên mọi kích thước:

```typescript
// playwright.config.ts
projects: [
  { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
  { name: 'laptop',  use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  { name: 'tablet',  use: { ...devices['iPad (gen 7)'] } },
  { name: 'mobile',  use: { ...devices['Pixel 7'] } },
],
```

```bash
npx playwright test --project=mobile
```

Đổi viewport ngay trong một test khi muốn kiểm tra điểm gãy (breakpoint):

```typescript
const breakpoints = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const bp of breakpoints) {
  test(`TC-UI-10: bố cục đúng ở ${bp.name} (${bp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');

    if (bp.width < 768) {
      await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
      await expect(page.getByRole('navigation')).toBeHidden();
    } else {
      await expect(page.getByRole('navigation')).toBeVisible();
    }

    await expect(page).toHaveScreenshot(`trang-chu-${bp.name}.png`, { fullPage: true });
  });
}
```

Bug responsive hay gặp mà nên có test riêng: nội dung tràn ngang gây scroll ngang, chữ bị cắt, nút chồng lên nhau, menu mobile không đóng được, bảng không cuộn được trên màn nhỏ.

Phát hiện scroll ngang — một kiểm tra rẻ mà bắt được rất nhiều lỗi:

```typescript
test('không có scroll ngang trên mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow, 'Trang bị tràn ngang ở 375px').toBe(false);
});
```

## Cross-browser

```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit',   use: { ...devices['Desktop Safari'] } },   // ~ Safari
],
```

```bash
npx playwright test --project=chromium --project=webkit
```

Lời khuyên thực dụng: chạy toàn bộ suite trên Chromium ở mỗi lần commit, còn Firefox/WebKit chỉ chạy bộ smoke hằng đêm. Chạy tất cả trên cả ba trình duyệt làm thời gian gấp ba mà phần lớn bug tìm được vẫn là bug chung.

WebKit là cách duy nhất kiểm tra hành vi giống Safari mà không cần máy Mac — đáng chạy vì Safari nổi tiếng khác biệt ở date input, flexbox gap và autoplay video.

Bỏ qua test không hợp với một trình duyệt:

```typescript
test('tải file PDF', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit không hỗ trợ tải file trong headless');
  // ...
});
```

## Giả lập thiết bị mobile

```typescript
import { devices } from '@playwright/test';

test.use({ ...devices['iPhone 14'] });

test('menu mobile mở được bằng chạm', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).tap();
  await expect(page.getByRole('navigation')).toBeVisible();
});
```

Preset thiết bị đã set sẵn viewport, user agent, devicePixelRatio, `isMobile` và `hasTouch`. Cần `tap()` thay `click()` khi test hành vi cảm ứng.

Đây là **giả lập trình duyệt**, không phải test trên thiết bị thật. Nó bắt được lỗi layout và lỗi logic responsive; nó không bắt được lỗi riêng của Safari iOS thật, hiệu năng máy yếu, hay quyền camera/GPS. Nói rõ giới hạn này với tester để họ không bỏ hẳn kiểm thử thủ công trên máy thật.

Giả lập thêm:

```typescript
test.use({
  geolocation: { latitude: 21.0278, longitude: 105.8342 },   // Hà Nội
  permissions: ['geolocation'],
  colorScheme: 'dark',
  locale: 'vi-VN',
});
```

## Kiểm tra layout không cần ảnh

Khi visual test quá "ồn" cho một dự án, vẫn kiểm tra được layout bằng số đo — cách này không cần baseline và không bị nhiễu font:

```typescript
const box = await page.getByRole('button', { name: 'Đặt hàng' }).boundingBox();
expect(box!.width).toBeGreaterThanOrEqual(44);   // vùng chạm tối thiểu trên mobile
expect(box!.height).toBeGreaterThanOrEqual(44);

// Nút không bị đẩy ra ngoài màn hình
const viewport = page.viewportSize()!;
expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
```

Một lựa chọn khác là `toMatchAriaSnapshot()` — chụp "ảnh" cấu trúc ngữ nghĩa (role + tên) thay vì pixel. Nó bắt được thay đổi cấu trúc mà không vỡ vì lệch một pixel:

```typescript
await expect(page.getByRole('navigation')).toMatchAriaSnapshot(`
  - navigation:
    - link "Trang chủ"
    - link "Sản phẩm"
    - link "Liên hệ"
`);
```

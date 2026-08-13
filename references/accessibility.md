# Kiểm thử accessibility (WCAG)

Accessibility testing kiểm tra xem người khiếm thị (dùng trình đọc màn hình), người không dùng được chuột, người mù màu... có dùng được app hay không. Ở Việt Nam đây thường là yêu cầu bắt buộc trong dự án cho ngân hàng, chính phủ, hoặc khách hàng nước ngoài.

## Cài đặt

```bash
npm i -D @axe-core/playwright
```

## Quét cơ bản

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('trang chủ không có lỗi accessibility', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

Khi fail, `results.violations` khá khó đọc trong log. Gắn kết quả vào report để tester và dev nhìn được ngay:

```typescript
test('kiểm tra accessibility trang thanh toán', async ({ page }, testInfo) => {
  await page.goto('/checkout');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  await testInfo.attach('ket-qua-accessibility.json', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const summary = results.violations.map(v =>
    `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} phần tử)\n  → ${v.helpUrl}`
  ).join('\n');

  expect(results.violations, `Phát hiện ${results.violations.length} vi phạm:\n${summary}`).toEqual([]);
});
```

## Chọn chuẩn cần tuân thủ

`withTags` quyết định mức độ nghiêm ngặt. Mức phổ biến trong hợp đồng là **WCAG 2.1 AA**:

| Tag | Nghĩa |
|---|---|
| `wcag2a`, `wcag2aa`, `wcag2aaa` | WCAG 2.0 mức A / AA / AAA |
| `wcag21a`, `wcag21aa` | Bổ sung của WCAG 2.1 |
| `wcag22aa` | Bổ sung của WCAG 2.2 |
| `best-practice` | Khuyến nghị của axe, không thuộc chuẩn WCAG |
| `section508` | Chuẩn liên bang Mỹ |

```typescript
.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
```

Không quét kèm `best-practice` khi mục tiêu là nghiệm thu hợp đồng — nó tạo nhiều cảnh báo không nằm trong cam kết và làm loãng danh sách lỗi thật.

## Quét một vùng, bỏ qua vùng đã biết

```typescript
const results = await new AxeBuilder({ page })
  .include('#main-content')            // chỉ quét vùng này
  .exclude('#third-party-widget')      // widget của bên thứ ba, mình không sửa được
  .disableRules(['color-contrast'])    // tạm tắt trong lúc thiết kế chưa chốt màu
  .analyze();
```

Mỗi lần `exclude` hoặc `disableRules`, ghi comment nói rõ **lý do và khi nào gỡ**. Nếu không, sau vài tháng chẳng ai dám bỏ dòng đó ra và test dần mất ý nghĩa.

## Fixture dùng chung

Để mọi test dùng cùng một bộ tiêu chuẩn:

```typescript
// fixtures/a11y-fixtures.ts
import { test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const test = base.extend<{ makeAxe: () => AxeBuilder }>({
  makeAxe: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('#legacy-footer'));
  },
});
export { expect } from '@playwright/test';
```

```typescript
import { test, expect } from '../../fixtures/a11y-fixtures';

for (const path of ['/', '/products', '/checkout', '/account']) {
  test(`accessibility: ${path}`, async ({ page, makeAxe }) => {
    await page.goto(path);
    expect((await makeAxe().analyze()).violations).toEqual([]);
  });
}
```

## Quét trạng thái sau tương tác

Phần lớn lỗi accessibility nằm ở modal, dropdown, tab — những thứ chỉ xuất hiện sau khi bấm. Quét trang tĩnh sẽ bỏ sót hết:

```typescript
test('modal đăng nhập đạt chuẩn accessibility', async ({ page, makeAxe }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('dialog').waitFor();

  expect((await makeAxe().analyze()).violations).toEqual([]);
});
```

Cũng nên quét trạng thái lỗi của form (sau khi submit sai), vì thông báo lỗi rất hay quên `aria-live` và quên liên kết với input.

## Kiểm tra bàn phím và focus

axe không kiểm tra được việc dùng bàn phím — đây là phần phải viết tay, và cũng là lỗi hay gặp nhất trong thực tế:

```typescript
test('điều hướng form bằng bàn phím', async ({ page }) => {
  await page.goto('/login');

  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Mật khẩu')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByText('Vui lòng nhập email')).toBeVisible();
});

test('đóng modal bằng phím Esc và trả focus về nút mở', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeFocused();
});
```

## Giới hạn cần nói rõ với khách hàng

Quét tự động chỉ bắt được khoảng **30–40%** vấn đề accessibility. Nó biết ảnh thiếu `alt`, nhưng không biết `alt="hình ảnh"` là vô nghĩa. Nó biết thứ tự heading sai, nhưng không biết nội dung có dễ hiểu không.

Vì vậy khi báo cáo, đừng viết "app đã đạt WCAG AA". Viết: "quét tự động không phát hiện vi phạm WCAG 2.1 AA; các hạng mục cần kiểm tra thủ công gồm: dùng trình đọc màn hình NVDA/VoiceOver, thao tác chỉ bằng bàn phím, thứ tự đọc hợp lý, chất lượng văn bản thay thế."

Vi phạm hay gặp nhất trong dự án Việt Nam, đáng kiểm tra trước:

| Rule | Nghĩa | Cách sửa |
|---|---|---|
| `color-contrast` | Chữ không đủ tương phản với nền | Tỉ lệ ≥ 4.5:1 cho chữ thường |
| `image-alt` | Ảnh thiếu `alt` | Thêm `alt` mô tả; ảnh trang trí để `alt=""` |
| `label` | Input không có nhãn | `<label for>` hoặc `aria-label` |
| `button-name` | Nút chỉ có icon, không có tên | Thêm `aria-label="Xóa"` |
| `link-name` | Link "Xem thêm" không rõ đích | Thêm `aria-label` cụ thể |
| `html-has-lang` | Thiếu `<html lang="vi">` | Thêm thuộc tính lang |
| `heading-order` | Nhảy từ h1 sang h4 | Dùng heading đúng thứ bậc |
| `aria-required-attr` | Thiếu thuộc tính ARIA bắt buộc | Bổ sung theo `helpUrl` trong kết quả |

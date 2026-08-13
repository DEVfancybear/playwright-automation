# Test E2E giao diện web

Mục lục: [Chọn locator](#chọn-locator) · [Assertion](#assertion) · [Page Object](#page-object-model) · [Form](#làm-việc-với-form) · [Bảng dữ liệu](#bảng-dữ-liệu) · [Upload/Download](#upload-và-download) · [iframe, tab mới, dialog](#iframe-tab-mới-dialog) · [Chờ đúng cách](#chờ-đúng-cách) · [Soft assertion](#soft-assertion) · [Ảnh chụp trong report](#gắn-bằng-chứng-vào-report)

## Chọn locator

Thứ tự ưu tiên, từ bền nhất tới dễ gãy nhất:

```typescript
// 1. Role + tên hiển thị — bền nhất, vì bám vào cái người dùng thấy
page.getByRole('button', { name: 'Đăng nhập' })
page.getByRole('textbox', { name: 'Email' })
page.getByRole('link', { name: 'Quên mật khẩu' })
page.getByRole('checkbox', { name: 'Ghi nhớ đăng nhập' })
page.getByRole('heading', { name: 'Danh sách đơn hàng', level: 1 })

// 2. Label của input
page.getByLabel('Số điện thoại')

// 3. Placeholder
page.getByPlaceholder('Nhập từ khóa tìm kiếm')

// 4. Text hiển thị
page.getByText('Không tìm thấy kết quả')
page.getByText('Đơn hàng', { exact: true })

// 5. data-testid — bền, nhưng cần dev thêm vào; đề xuất với dev nếu UI thiếu nhãn
page.getByTestId('order-row-123')

// 6. CSS / XPath — chỉ khi hết cách
page.locator('#order-table tbody tr')
```

Vì sao thứ tự này quan trọng: class kiểu `.btn-primary-2xl` sinh ra từ framework CSS và đổi mỗi lần dev chỉnh giao diện, còn chữ "Đăng nhập" trên nút thì chỉ đổi khi nghiệp vụ đổi — mà nghiệp vụ đổi thì test *đáng lẽ* phải fail để tester biết.

### Khi locator dính nhiều phần tử

```typescript
// ❌ Thứ tự sẽ đổi khi dữ liệu đổi
page.getByRole('button', { name: 'Xóa' }).nth(2).click();

// ✅ Thu hẹp theo dòng chứa dữ liệu cụ thể
await page.getByRole('row')
  .filter({ hasText: 'DH-00123' })
  .getByRole('button', { name: 'Xóa' })
  .click();

// ✅ Hoặc thu hẹp theo vùng
const modal = page.getByRole('dialog', { name: 'Xác nhận' });
await modal.getByRole('button', { name: 'Đồng ý' }).click();
```

Cách kiểm tra nhanh một locator có dính nhiều phần tử không:

```bash
npx playwright test --debug     # rồi dùng "Pick locator" trong Inspector
```

## Assertion

Assertion của Playwright tự retry tới khi hết `expect.timeout` — đó là lý do phải luôn `await`.

```typescript
await expect(page.getByText('Đăng nhập thành công')).toBeVisible();
await expect(page.getByRole('button', { name: 'Lưu' })).toBeEnabled();
await expect(page.getByLabel('Email')).toHaveValue('a@b.com');
await expect(page.getByRole('row')).toHaveCount(10);
await expect(page).toHaveURL(/\/dashboard/);
await expect(page).toHaveTitle('Trang quản trị');
await expect(page.getByTestId('total')).toHaveText('1.250.000 ₫');
await expect(page.getByTestId('total')).toContainText('1.250.000');
await expect(page.getByRole('alert')).toHaveClass(/error/);
await expect(page.getByLabel('Điều khoản')).toBeChecked();
await expect(page.getByText('Đang tải')).toBeHidden();

// Phủ định — vẫn tự retry, chờ tới khi điều kiện sai
await expect(page.getByText('Lỗi hệ thống')).not.toBeVisible();
```

Sai lầm phổ biến nhất:

```typescript
// ❌ Chụp trạng thái tại đúng 1 mili-giây, không chờ gì cả → flaky
expect(await page.getByText('Thành công').isVisible()).toBe(true);

// ✅
await expect(page.getByText('Thành công')).toBeVisible();
```

Timeout riêng cho chỗ chậm (báo cáo, export file):

```typescript
await expect(page.getByText('Xuất file hoàn tất')).toBeVisible({ timeout: 60_000 });
```

## Page Object Model

`pages/BasePage.ts` — chứa thứ mọi trang đều cần:

```typescript
import { Page, expect } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  abstract readonly path: string;

  async goto() {
    await this.page.goto(this.path);
    await this.waitUntilReady();
  }

  /** Chờ trang thật sự dùng được, không chỉ là đã load HTML. */
  async waitUntilReady() {
    await expect(this.page.getByTestId('app-loading')).toBeHidden({ timeout: 30_000 }).catch(() => {});
  }

  async expectToast(message: string | RegExp) {
    await expect(this.page.getByRole('alert').filter({ hasText: message })).toBeVisible();
  }
}
```

`pages/LoginPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly path = '/login';

  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Mật khẩu');
    this.submit = page.getByRole('button', { name: 'Đăng nhập' });
    this.errorMessage = page.getByRole('alert');
  }

  async signIn(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectError(message: string | RegExp) {
    await expect(this.errorMessage).toContainText(message);
  }
}
```

Khai báo `Locator` trong constructor chứ không gọi `page.locator()` ngay lúc tạo object: `Locator` chỉ là mô tả "cách tìm", nó chỉ thật sự đi tìm phần tử lúc bạn dùng nó. Nhờ vậy tạo Page Object trước khi trang load xong vẫn không sao.

Đừng nhồi assertion nghiệp vụ vào Page Object. Ngoại lệ hợp lý là các hàm `expectXxx` mô tả trạng thái của chính trang đó (như `expectError` ở trên) — chúng giúp spec đọc như tiếng Việt.

## Làm việc với form

```typescript
await page.getByLabel('Họ tên').fill('Nguyễn Văn A');
await page.getByLabel('Mô tả').clear();

// Select thường
await page.getByLabel('Tỉnh/Thành phố').selectOption('HN');
await page.getByLabel('Tỉnh/Thành phố').selectOption({ label: 'Hà Nội' });

// Dropdown tự chế (div, không phải <select>) — phải bấm rồi chọn
await page.getByRole('combobox', { name: 'Tỉnh/Thành phố' }).click();
await page.getByRole('option', { name: 'Hà Nội' }).click();

await page.getByLabel('Đồng ý điều khoản').check();
await page.getByLabel('Nhận email quảng cáo').uncheck();
await page.getByRole('radio', { name: 'Nam' }).check();

// Date picker: thử gõ thẳng trước, chỉ bấm lịch khi input bị readonly
await page.getByLabel('Ngày sinh').fill('1990-01-15');

// Gõ từng ký tự — cần cho autocomplete/search có debounce
await page.getByPlaceholder('Tìm sản phẩm').pressSequentially('áo sơ mi', { delay: 100 });
await page.getByRole('option', { name: 'Áo sơ mi trắng' }).click();

await page.getByLabel('Mã giảm giá').press('Enter');
await page.keyboard.press('Escape');
```

Kiểm tra validate — phần tester quan tâm nhất:

```typescript
test('TC-REG-05: báo lỗi khi email sai định dạng', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Email').fill('sai-dinh-dang');
  await page.getByRole('button', { name: 'Đăng ký' }).click();

  await expect(page.getByText('Email không hợp lệ')).toBeVisible();
  await expect(page).toHaveURL(/\/register/);   // không được đi tiếp
});
```

## Bảng dữ liệu

```typescript
const rows = page.getByRole('row');
await expect(rows).toHaveCount(11);   // 10 dòng + 1 header

// Tìm dòng theo dữ liệu rồi thao tác trong dòng đó
const row = rows.filter({ hasText: 'DH-00123' });
await expect(row.getByRole('cell').nth(3)).toHaveText('Đã giao');
await row.getByRole('button', { name: 'Chi tiết' }).click();

// Lấy toàn bộ một cột để kiểm tra sắp xếp
const names = await page.getByRole('row').getByRole('cell').nth(1).allTextContents();
expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'vi')));
```

Phân trang: kiểm tra hành vi (bấm trang 2 thì nội dung đổi), đừng kiểm tra thuộc lòng nội dung từng trang — dữ liệu staging thay đổi liên tục và test sẽ đỏ oan.

## Upload và download

```typescript
// Upload
await page.getByLabel('Ảnh đại diện').setInputFiles('fixtures/data/avatar.png');
await page.getByLabel('Tài liệu').setInputFiles(['a.pdf', 'b.pdf']);
await page.getByLabel('Ảnh đại diện').setInputFiles([]);   // xóa file đã chọn

// Nút "Chọn file" tự chế, không có <input type=file> lộ ra
const fileChooserPromise = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Tải ảnh lên' }).click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles('fixtures/data/avatar.png');

// Download — đăng ký lắng nghe TRƯỚC khi bấm, nếu không sẽ lỡ sự kiện
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Xuất Excel' }).click();
const download = await downloadPromise;

expect(download.suggestedFilename()).toMatch(/^bao-cao-.*\.xlsx$/);
await download.saveAs('test-results/downloads/' + download.suggestedFilename());
```

## iframe, tab mới, dialog

```typescript
// iframe (cổng thanh toán, trình soạn thảo nhúng...)
const frame = page.frameLocator('iframe[title="Thanh toán"]');
await frame.getByLabel('Số thẻ').fill('4111111111111111');
await frame.getByRole('button', { name: 'Xác nhận' }).click();

// Tab/cửa sổ mới
const popupPromise = page.waitForEvent('popup');
await page.getByRole('link', { name: 'Xem hóa đơn' }).click();
const popup = await popupPromise;
await expect(popup.getByRole('heading', { name: 'Hóa đơn' })).toBeVisible();
await popup.close();

// alert / confirm của trình duyệt — phải xử lý trước khi bấm
page.once('dialog', dialog => {
  expect(dialog.message()).toContain('Bạn có chắc muốn xóa?');
  dialog.accept();
});
await page.getByRole('button', { name: 'Xóa' }).click();
```

## Chờ đúng cách

```typescript
await page.waitForURL('**/dashboard');
await page.waitForURL(/\/orders\/\d+/);

// Chờ API cụ thể xong — chính xác hơn networkidle nhiều
const responsePromise = page.waitForResponse(r => r.url().includes('/api/orders') && r.status() === 200);
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
const response = await responsePromise;
expect((await response.json()).data).toHaveLength(10);

await page.getByTestId('spinner').waitFor({ state: 'hidden' });
await page.waitForLoadState('networkidle');   // hợp cho recon; app có polling/websocket sẽ không bao giờ idle
```

Sắp xếp theo mức độ nên dùng: chờ assertion cụ thể > chờ URL/response > `networkidle` > `waitForTimeout` (gần như không bao giờ).

## Soft assertion

Khi muốn kiểm tra nhiều điểm trên một màn hình và thấy hết lỗi trong một lần chạy, thay vì dừng ở lỗi đầu tiên:

```typescript
await expect.soft(page.getByTestId('ten-kh')).toHaveText('Nguyễn Văn A');
await expect.soft(page.getByTestId('sdt')).toHaveText('0901234567');
await expect.soft(page.getByTestId('dia-chi')).toHaveText('Hà Nội');
// Test vẫn fail ở cuối, nhưng report liệt kê đủ 3 chỗ sai
```

Rất hợp khi verify màn hình chi tiết có hàng chục trường. Đừng dùng soft cho bước điều hướng — nếu trang chưa mở mà vẫn chạy tiếp thì các assert sau chỉ tạo nhiễu.

## Gắn bằng chứng vào report

```typescript
await test.info().attach('màn hình sau khi đặt hàng', {
  body: await page.screenshot({ fullPage: true }),
  contentType: 'image/png',
});

await test.info().attach('response API', {
  body: JSON.stringify(await response.json(), null, 2),
  contentType: 'application/json',
});
```

Việc này biến HTML report thành bằng chứng nghiệm thu nộp được cho khách hàng, không chỉ là log pass/fail.

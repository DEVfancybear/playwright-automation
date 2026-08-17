# Mock API và giả lập điều kiện mạng

> **Vùng bắt buộc spec.** Công cụ browser chỉ **đọc** request đã xảy ra, không chặn/sửa được response và không giả lập được offline/throttle. Đừng mất thời gian thử làm bằng thao tác tay — vào thẳng Playwright.

Mock cho phép tester kiểm tra những tình huống gần như không dựng được bằng tay: server trả 500, mạng rớt giữa chừng, API trả danh sách rỗng, thanh toán thất bại. Đây là cách bắt bug xử lý lỗi — mảng mà đội dev hay bỏ quên nhất.

Mục lục: [Chặn và trả dữ liệu giả](#chặn-và-trả-dữ-liệu-giả) · [Giả lập lỗi](#giả-lập-lỗi-server) · [Mạng chậm & offline](#mạng-chậm-và-offline) · [Sửa response thật](#sửa-response-thật) · [Chặn tài nguyên rác](#chặn-tài-nguyên-không-cần-thiết) · [HAR](#ghi-và-phát-lại-har) · [Theo dõi request](#theo-dõi-request-mà-không-can-thiệp) · [Khi nào KHÔNG nên mock](#khi-nào-không-nên-mock)

## Chặn và trả dữ liệu giả

```typescript
test('hiển thị đúng danh sách sản phẩm', async ({ page }) => {
  await page.route('**/api/products*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 1, name: 'Áo sơ mi trắng', price: 350000 },
          { id: 2, name: 'Quần âu đen', price: 450000 },
        ],
        meta: { total: 2 },
      }),
    })
  );

  await page.goto('/products');
  await expect(page.getByRole('row')).toHaveCount(3);   // 2 dòng + header
  await expect(page.getByText('350.000')).toBeVisible();
});
```

Nhờ mock, test này không phụ thuộc dữ liệu staging — ai chạy, chạy lúc nào cũng ra kết quả như nhau. Đó chính là điều kiện để visual regression dùng được.

Dữ liệu mock nên để trong file riêng để tái sử dụng:

```typescript
// fixtures/data/products.json  →
import products from '../fixtures/data/products.json';
await page.route('**/api/products*', route => route.fulfill({ json: products }));
```

`json:` là dạng viết tắt, tự set `Content-Type` giúp bạn.

## Giả lập lỗi server

Đây là nhóm ca kiểm thử giá trị nhất mà làm tay gần như không thể:

```typescript
test('TC-ERR-01: hiện thông báo khi server lỗi 500', async ({ page }) => {
  await page.route('**/api/orders*', route =>
    route.fulfill({ status: 500, json: { message: 'Internal Server Error' } })
  );

  await page.goto('/orders');
  await expect(page.getByText('Có lỗi xảy ra, vui lòng thử lại')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
});

test('TC-ERR-02: chuyển về trang đăng nhập khi token hết hạn', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: { message: 'Token expired' } }));

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Phiên đăng nhập đã hết hạn')).toBeVisible();
});

test('TC-ERR-03: xử lý khi request bị timeout / mất mạng', async ({ page }) => {
  await page.route('**/api/orders*', route => route.abort('failed'));

  await page.goto('/orders');
  await expect(page.getByText('Không kết nối được máy chủ')).toBeVisible();
});

test('TC-ERR-04: hiển thị trạng thái rỗng khi không có dữ liệu', async ({ page }) => {
  await page.route('**/api/orders*', route => route.fulfill({ json: { data: [], meta: { total: 0 } } }));

  await page.goto('/orders');
  await expect(page.getByText('Chưa có đơn hàng nào')).toBeVisible();
});
```

Mock khác nhau theo lần gọi — kiểm tra nút "Thử lại" có thật sự hoạt động:

```typescript
let callCount = 0;
await page.route('**/api/orders*', route => {
  callCount++;
  if (callCount === 1) return route.fulfill({ status: 500, json: { message: 'lỗi' } });
  return route.fulfill({ json: { data: [{ id: 1, code: 'DH-001' }] } });
});

await page.goto('/orders');
await expect(page.getByText('Có lỗi xảy ra')).toBeVisible();
await page.getByRole('button', { name: 'Thử lại' }).click();
await expect(page.getByText('DH-001')).toBeVisible();
```

## Mạng chậm và offline

```typescript
// Offline hoàn toàn
test('hiện banner khi mất mạng', async ({ page, context }) => {
  await page.goto('/');
  await context.setOffline(true);
  await expect(page.getByText('Bạn đang ngoại tuyến')).toBeVisible();
  await context.setOffline(false);
});

// Làm chậm một API để kiểm tra trạng thái loading
await page.route('**/api/report*', async route => {
  await new Promise(r => setTimeout(r, 3000));
  await route.continue();
});
await page.getByRole('button', { name: 'Xuất báo cáo' }).click();
await expect(page.getByTestId('spinner')).toBeVisible();
await expect(page.getByText('Xuất báo cáo hoàn tất')).toBeVisible({ timeout: 15_000 });
```

Giả lập băng thông 3G (dùng CDP, chỉ chạy trên Chromium):

```typescript
const client = await page.context().newCDPSession(page);
await client.send('Network.emulateNetworkConditions', {
  offline: false,
  downloadThroughput: (750 * 1024) / 8,
  uploadThroughput: (250 * 1024) / 8,
  latency: 100,
});
```

## Sửa response thật

Đôi khi muốn giữ nguyên API thật nhưng chỉnh một trường để test ca biên — cách này tốt hơn mock toàn bộ vì vẫn bám sát dữ liệu thật:

```typescript
await page.route('**/api/account', async route => {
  const response = await route.fetch();
  const json = await response.json();
  json.balance = 0;                       // ép số dư về 0
  json.status = 'LOCKED';                 // ép trạng thái khóa
  await route.fulfill({ response, json });
});

await page.goto('/account');
await expect(page.getByText('Tài khoản đang bị khóa')).toBeVisible();
```

## Chặn tài nguyên không cần thiết

Giúp suite chạy nhanh hơn đáng kể và loại nhiễu từ bên thứ ba:

```typescript
// Chặn ảnh, font, quảng cáo, analytics
await page.route('**/*.{png,jpg,jpeg,webp,gif,woff2}', route => route.abort());
await page.route(/googletagmanager|google-analytics|facebook\.net|hotjar/, route => route.abort());
```

Đặt trong fixture để áp cho cả suite. Nhưng **đừng chặn ảnh trong project visual** — ảnh chính là thứ đang được kiểm tra.

## Ghi và phát lại HAR

Khi API phức tạp và không muốn viết mock tay: ghi lại toàn bộ traffic thật một lần, rồi phát lại mãi mãi.

```typescript
// Bước 1 — ghi (chạy một lần, khi API còn hoạt động tốt)
await context.routeFromHAR('fixtures/har/orders.har', { update: true });

// Bước 2 — phát lại (từ đó về sau, không gọi mạng thật nữa)
await context.routeFromHAR('fixtures/har/orders.har', { url: '**/api/**' });
```

Hợp cho tình huống môi trường staging hay sập hoặc chỉ dùng được trong giờ hành chính. Nhược điểm: HAR sẽ lỗi thời khi API đổi, và **HAR chứa cả token, cookie, dữ liệu khách hàng thật** — phải xem lại và làm sạch trước khi commit.

## Theo dõi request mà không can thiệp

Kiểm tra app gọi API đúng tham số — bắt được bug mà nhìn UI không thấy:

```typescript
test('bấm tìm kiếm gọi API đúng tham số', async ({ page }) => {
  const requestPromise = page.waitForRequest(r =>
    r.url().includes('/api/products') && r.method() === 'GET'
  );

  await page.goto('/products');
  await page.getByPlaceholder('Tìm kiếm').fill('áo sơ mi');
  await page.getByRole('button', { name: 'Tìm' }).click();

  const request = await requestPromise;
  const url = new URL(request.url());
  expect(url.searchParams.get('keyword')).toBe('áo sơ mi');
  expect(url.searchParams.get('page')).toBe('1');
});

// Bắt lỗi console và request hỏng trong suốt test
test('trang chủ không có lỗi console', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`));

  await page.goto('/');
  // Chờ một mốc cụ thể của trang, không chờ 'networkidle' (Playwright gắn nhãn DISCOURAGED,
  // và app có polling/websocket sẽ không bao giờ idle).
  await expect(page.getByRole('heading', { name: 'Trang chủ' })).toBeVisible();

  expect(errors, `Lỗi phát hiện:\n${errors.join('\n')}`).toEqual([]);
});
```

Kiểm tra lỗi console nên gắn vào bộ smoke: nó gần như miễn phí và bắt được lỗi JS mà giao diện vẫn trông "bình thường".

## Khi nào KHÔNG nên mock

Mock quá tay biến test thành "test cái mock", không còn kiểm chứng được hệ thống thật.

- **Nên mock**: bên thứ ba (thanh toán, SMS/OTP, bản đồ, email), ca lỗi khó dựng, dữ liệu cho visual test, API chưa làm xong.
- **Không nên mock**: chính API của sản phẩm trong bộ regression chính. Nếu backend đổi format mà mock vẫn giữ format cũ, test xanh trong khi production đã hỏng — đây là kiểu sai lầm nguy hiểm nhất vì nó tạo cảm giác an toàn giả.

Cách cân bằng thường dùng: một bộ smoke chạy **API thật** trên staging để bắt lệch hợp đồng, cộng một bộ đầy đủ chạy **có mock** để phủ ca lỗi và chạy nhanh.

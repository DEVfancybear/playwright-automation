# Kiểm thử API

Playwright test được API mà **không cần mở trình duyệt** — nhanh hơn UI test hàng chục lần. Với tester, đây thường là nơi nên bắt đầu automation: API ổn định hơn giao diện, viết nhanh hơn, và bắt được phần lớn bug logic.

Mục lục: [Cấu hình](#cấu-hình) · [Test cơ bản](#test-cơ-bản) · [Xác thực](#xác-thực-token) · [Kiểm tra schema](#kiểm-tra-cấu-trúc-response) · [CRUD](#luồng-crud-đầy-đủ) · [Dùng API trong UI test](#dùng-api-để-hỗ-trợ-ui-test) · [Upload/Download](#file-upload--download) · [Checklist](#checklist-test-api)

> **Chỉ cần hỏi nhanh một endpoint?** Nếu đã mở app trên trình duyệt và đang đăng nhập, chạy `fetch` ngay trong trang — cookie, header và quyền của phiên hiện tại tự động đi kèm, không phải dựng dự án hay lo auth:
> ```js
> const r = await fetch('/api/orders?page=1', { credentials: 'include' });
> ({ status: r.status, body: await r.json() })
> ```
> Dùng `request` fixture dưới đây khi cần bộ nhiều case, chạy lại được, hoặc chạy trên CI.

## Cấu hình

Tách project riêng cho API trong `playwright.config.ts` để không kéo theo trình duyệt:

```typescript
projects: [
  {
    name: 'api',
    testDir: './tests/api',
    use: {
      baseURL: process.env.API_URL || 'https://api-staging.example.com',
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    },
  },
],
```

Chạy: `npx playwright test --project=api`

## Test cơ bản

Fixture `request` có sẵn trong mọi test, không cần `page`:

```typescript
import { test, expect } from '@playwright/test';

test('GET /orders trả về danh sách đơn hàng', async ({ request }) => {
  const res = await request.get('/api/orders', {
    params: { page: 1, limit: 10, status: 'pending' },
  });

  expect(res.status()).toBe(200);
  expect(res.ok()).toBeTruthy();

  const body = await res.json();
  expect(body.data).toHaveLength(10);
  expect(body.meta.total).toBeGreaterThan(0);
  expect(body.data[0]).toHaveProperty('orderCode');
});

test('POST /orders tạo đơn hàng mới', async ({ request }) => {
  const res = await request.post('/api/orders', {
    data: {
      customerId: 123,
      items: [{ productId: 1, quantity: 2 }],
    },
  });

  expect(res.status()).toBe(201);
  const order = await res.json();
  expect(order).toMatchObject({
    customerId: 123,
    status: 'pending',
  });
  expect(order.id).toBeDefined();
});
```

Các method đều có: `get`, `post`, `put`, `patch`, `delete`, `head`, `fetch`.

Kiểm tra ca lỗi — đây mới là phần tester giỏi hơn dev:

```typescript
test('POST /orders trả 400 khi thiếu customerId', async ({ request }) => {
  const res = await request.post('/api/orders', { data: { items: [] } });

  expect(res.status()).toBe(400);
  const err = await res.json();
  expect(err.message).toContain('customerId');
});

test('GET /orders trả 401 khi không có token', async ({ request }) => {
  const res = await request.get('/api/orders', { headers: { Authorization: '' } });
  expect(res.status()).toBe(401);
});

test('GET /orders/:id trả 404 với id không tồn tại', async ({ request }) => {
  const res = await request.get('/api/orders/99999999');
  expect(res.status()).toBe(404);
});

test('GET /admin/users trả 403 với tài khoản thường', async ({ request }) => {
  const res = await request.get('/api/admin/users');
  expect(res.status()).toBe(403);
});
```

## Xác thực (token)

Lấy token một lần rồi tái sử dụng cho cả file — nhanh hơn login lại ở mỗi test:

```typescript
import { test as base, expect, APIRequestContext } from '@playwright/test';

type Fixtures = { api: APIRequestContext };

export const test = base.extend<Fixtures>({
  api: async ({ playwright }, use) => {
    const auth = await playwright.request.newContext({ baseURL: process.env.API_URL });
    const res = await auth.post('/api/auth/login', {
      data: { username: process.env.TEST_USER, password: process.env.TEST_PASS },
    });
    expect(res.ok(), 'Đăng nhập API thất bại — kiểm tra lại TEST_USER/TEST_PASS').toBeTruthy();
    const { accessToken } = await res.json();

    const api = await playwright.request.newContext({
      baseURL: process.env.API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
    });

    await use(api);
    await api.dispose();
    await auth.dispose();
  },
});
```

Dùng:

```typescript
import { test } from '../../fixtures/api-fixtures';

test('lấy hồ sơ người dùng hiện tại', async ({ api }) => {
  const res = await api.get('/api/me');
  expect(res.status()).toBe(200);
});
```

Thông điệp thứ hai trong `expect(res.ok(), '...')` sẽ hiện trong report khi fail — cực kỳ đáng giá, vì "login thất bại" và "endpoint hỏng" là hai bug hoàn toàn khác nhau.

## Kiểm tra cấu trúc response

Cách nhẹ, không cần thư viện — hợp cho đa số trường hợp:

```typescript
const order = await res.json();

expect(order).toEqual(expect.objectContaining({
  id: expect.any(Number),
  orderCode: expect.stringMatching(/^DH-\d{5}$/),
  total: expect.any(Number),
  createdAt: expect.any(String),
  items: expect.arrayContaining([
    expect.objectContaining({ productId: expect.any(Number), quantity: expect.any(Number) }),
  ]),
}));
```

Khi cần kiểm tra chặt theo JSON Schema (hợp đồng API giữa các team), dùng `ajv`:

```typescript
import Ajv from 'ajv';
import schema from '../schemas/order.schema.json';

const ajv = new Ajv();
const validate = ajv.compile(schema);

test('response đúng hợp đồng API', async ({ api }) => {
  const body = await (await api.get('/api/orders/1')).json();
  const valid = validate(body);
  expect(validate.errors ?? [], JSON.stringify(validate.errors, null, 2)).toEqual([]);
  expect(valid).toBe(true);
});
```

Schema bắt được thứ mà mắt người bỏ sót: kiểu dữ liệu đổi thầm lặng (`"total": "1000"` thay vì `1000`) hay trường bị bỏ đi trong bản deploy mới.

## Luồng CRUD đầy đủ

Test theo chuỗi thì phải chạy tuần tự, và phải dọn dẹp kể cả khi giữa chừng fail:

```typescript
test.describe.configure({ mode: 'serial' });

test.describe('CRUD sản phẩm', () => {
  let productId: number;

  test('tạo sản phẩm', async ({ api }) => {
    const res = await api.post('/api/products', {
      data: { name: `SP tự động ${Date.now()}`, price: 100000 },
    });
    expect(res.status()).toBe(201);
    productId = (await res.json()).id;
  });

  test('đọc lại sản phẩm vừa tạo', async ({ api }) => {
    const res = await api.get(`/api/products/${productId}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).price).toBe(100000);
  });

  test('cập nhật giá', async ({ api }) => {
    const res = await api.patch(`/api/products/${productId}`, { data: { price: 150000 } });
    expect(res.status()).toBe(200);
    expect((await res.json()).price).toBe(150000);
  });

  test('xóa sản phẩm', async ({ api }) => {
    expect((await api.delete(`/api/products/${productId}`)).status()).toBe(204);
    expect((await api.get(`/api/products/${productId}`)).status()).toBe(404);
  });

  test.afterAll(async ({ playwright }) => {
    // Dọn phòng khi test giữa chừng fail và bước xóa không kịp chạy
    if (!productId) return;
    const ctx = await playwright.request.newContext({ baseURL: process.env.API_URL });
    await ctx.delete(`/api/products/${productId}`).catch(() => {});
    await ctx.dispose();
  });
});
```

`mode: 'serial'` cần thiết ở đây, nhưng nó đắt: một test fail thì các test sau bị bỏ qua, và không chạy song song được. Chỉ dùng khi thật sự có phụ thuộc — đa số test API nên độc lập, mỗi test tự tạo dữ liệu riêng.

## Dùng API để hỗ trợ UI test

Đây là kỹ thuật giúp suite UI nhanh và ổn định hơn hẳn: **chuẩn bị dữ liệu qua API, kiểm chứng qua UI** (và ngược lại).

```typescript
test('đơn hàng mới hiện trên danh sách', async ({ page, api }) => {
  // Tiền điều kiện tạo bằng API — nhanh, không phụ thuộc giao diện tạo đơn
  const res = await api.post('/api/orders', { data: { customerId: 1, items: [{ productId: 1, quantity: 1 }] } });
  const { orderCode } = await res.json();

  // Kiểm chứng bằng UI — đây mới là thứ cần test
  await page.goto('/orders');
  await expect(page.getByRole('row').filter({ hasText: orderCode })).toBeVisible();
});

test('tạo đơn trên UI thì dữ liệu vào đúng DB', async ({ page, api }) => {
  await page.goto('/orders/new');
  await page.getByLabel('Khách hàng').selectOption('Nguyễn Văn A');
  await page.getByRole('button', { name: 'Tạo đơn' }).click();
  await expect(page.getByText('Tạo đơn thành công')).toBeVisible();

  // Xác nhận ở tầng dữ liệu — UI hiển thị đúng chưa chắc lưu đúng
  const orderCode = await page.getByTestId('order-code').textContent();
  const check = await api.get(`/api/orders/by-code/${orderCode}`);
  expect(check.status()).toBe(200);
  expect((await check.json()).status).toBe('pending');
});
```

Lưu ý: `page.request` dùng chung cookie với trình duyệt (tiện khi API xác thực bằng session cookie), còn `playwright.request.newContext()` thì tách biệt hoàn toàn.

## File upload / download

```typescript
// Upload multipart
const res = await api.post('/api/documents', {
  multipart: {
    title: 'Hợp đồng',
    file: {
      name: 'hopdong.pdf',
      mimeType: 'application/pdf',
      buffer: fs.readFileSync('fixtures/data/hopdong.pdf'),
    },
  },
});
expect(res.status()).toBe(201);

// Download nhị phân
const file = await api.get('/api/reports/1/export');
expect(file.headers()['content-type']).toContain('spreadsheet');
expect((await file.body()).length).toBeGreaterThan(1000);
```

## Checklist test API

Với mỗi endpoint, tối thiểu nên có:

- [ ] Happy path — dữ liệu hợp lệ, đúng status (200/201/204) và đúng body
- [ ] Thiếu trường bắt buộc → 400 kèm message chỉ rõ trường nào
- [ ] Sai kiểu dữ liệu (số gửi thành chữ, ngày sai định dạng) → 400
- [ ] Không token / token hết hạn → 401
- [ ] Token của user không đủ quyền → 403
- [ ] Id không tồn tại → 404
- [ ] Giá trị biên: chuỗi rỗng, độ dài tối đa, số âm, số 0, ký tự tiếng Việt có dấu, emoji
- [ ] Phân trang: trang cuối, trang vượt quá, `limit` quá lớn
- [ ] Idempotency: gọi 2 lần cùng payload có tạo trùng bản ghi không
- [ ] Dữ liệu trả về không lộ thông tin nhạy cảm (hash mật khẩu, token nội bộ, thông tin user khác)

Mục cuối hay bị bỏ sót nhưng là bug nghiêm trọng nhất trong danh sách: một API trả thừa trường là lỗ hổng rò rỉ dữ liệu, kể cả khi UI không hiển thị trường đó.

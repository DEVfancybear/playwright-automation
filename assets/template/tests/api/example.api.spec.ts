import { test, expect } from '../../fixtures/api-fixtures';

/**
 * Spec API mẫu — sửa endpoint cho khớp dự án.
 *
 * Test API không cần trình duyệt nên nhanh hơn test UI hàng chục lần. Với tester
 * mới làm automation, đây thường là nơi nên bắt đầu: API ổn định hơn giao diện
 * và bắt được phần lớn bug logic.
 *
 * File phải đặt tên *.api.spec.ts để chạy trong project "api".
 */

test.describe('API — Sản phẩm', () => {
  test('TC-API-01: GET danh sách sản phẩm trả về đúng cấu trúc @smoke', async ({ api }) => {
    const res = await api.get('/api/products', { params: { page: 1, limit: 10 } });

    expect(res.status(), 'Endpoint danh sách sản phẩm phải trả 200').toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data ?? body)).toBeTruthy();
  });

  test('TC-API-02: GET id không tồn tại trả 404', async ({ api }) => {
    const res = await api.get('/api/products/99999999');
    expect(res.status()).toBe(404);
  });

  test('TC-API-03: POST thiếu trường bắt buộc trả 400 kèm thông báo rõ ràng', async ({ api }) => {
    const res = await api.post('/api/products', { data: {} });

    expect(res.status()).toBe(400);
    const err = await res.json();
    expect(JSON.stringify(err), 'Thông báo lỗi phải chỉ rõ trường nào thiếu').toMatch(/name|tên/i);
  });

  test('TC-API-04: gọi API cần xác thực mà không có token trả 401', async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: process.env.API_URL });
    const res = await anon.get('/api/products');
    expect(res.status()).toBe(401);
    await anon.dispose();
  });

  test('TC-API-05: response không lộ thông tin nhạy cảm', async ({ api }) => {
    const res = await api.get('/api/me');
    test.skip(res.status() !== 200, 'Endpoint /api/me không khả dụng trên môi trường này');

    const raw = JSON.stringify(await res.json());
    // API trả thừa trường là lỗ hổng rò rỉ dữ liệu, kể cả khi giao diện không hiển thị.
    for (const forbidden of ['password', 'passwordHash', 'salt', 'refreshToken']) {
      expect(raw, `Response không được chứa "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

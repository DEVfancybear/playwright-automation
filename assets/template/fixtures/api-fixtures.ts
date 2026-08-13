import { test as base, expect, APIRequestContext } from '@playwright/test';

/**
 * Client API đã đăng nhập sẵn, dùng chung cho cả test API lẫn test giao diện.
 *
 * Trong test UI, dùng `api` để tạo tiền điều kiện (nhanh hơn bấm qua giao diện
 * nhiều lần) hoặc để kiểm chứng dữ liệu đã lưu đúng — UI hiển thị đúng không
 * đảm bảo backend lưu đúng.
 */

type Fixtures = {
  api: APIRequestContext;
};

export const test = base.extend<Fixtures>({
  api: async ({ playwright }, use) => {
    const baseURL = process.env.API_URL || '{{API_URL}}';
    const headers: Record<string, string> = { Accept: 'application/json' };

    if (process.env.TEST_USER && process.env.TEST_PASS) {
      const auth = await playwright.request.newContext({ baseURL });
      // ⚠ Sửa endpoint và tên trường cho khớp API thật của dự án.
      const res = await auth.post('/api/auth/login', {
        data: { username: process.env.TEST_USER, password: process.env.TEST_PASS },
      });

      if (res.ok()) {
        const body = await res.json();
        const token = body.accessToken ?? body.token ?? body.data?.accessToken;
        if (token) headers.Authorization = `Bearer ${token}`;
      } else {
        // Không throw ở đây: nhiều dự án có endpoint public test được mà không cần token.
        // Nhưng phải báo ra, vì "401 ở mọi test" mà không biết lý do rất mất thời gian.
        console.warn(`⚠ Đăng nhập API thất bại (${res.status()}). Các test cần token sẽ trả 401.`);
      }
      await auth.dispose();
    }

    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: headers });
    await use(api);
    await api.dispose();
  },
});

export { expect };

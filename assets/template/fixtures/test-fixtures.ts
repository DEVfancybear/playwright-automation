import { test as base, expect } from '@playwright/test';

/**
 * Fixture dùng chung cho test giao diện.
 *
 * Fixture là nơi đặt phần chuẩn bị và dọn dẹp, để file spec chỉ còn nghiệp vụ.
 * Thêm fixture mới ở đây khi thấy cùng một đoạn chuẩn bị lặp lại ở nhiều spec.
 */

type Fixtures = {
  /** Ghi lại lỗi console trong suốt test; assert ở cuối nếu cần trang phải sạch lỗi. */
  consoleErrors: string[];
};

export const test = base.extend<Fixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await use(errors);
  },

  // Chặn quảng cáo/analytics cho mọi test: nhanh hơn và bớt nhiễu từ bên thứ ba.
  // Đừng bật cho project visual — ảnh chính là thứ đang được kiểm tra.
  page: async ({ page }, use) => {
    await page.route(/googletagmanager|google-analytics|facebook\.net|hotjar|doubleclick/,
      route => route.abort());
    await use(page);
  },
});

export { expect };

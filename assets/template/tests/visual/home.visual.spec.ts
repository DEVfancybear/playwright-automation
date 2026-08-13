import { test, expect } from '@playwright/test';

/**
 * Visual regression — bắt loại bug mà assertion text không bao giờ thấy:
 * chữ tràn khung, nút lệch, CSS vỡ sau khi nâng thư viện.
 *
 * Lần chạy đầu sẽ FAIL và tự tạo ảnh gốc. Đó là cố ý — bạn phải mở ảnh xem
 * và xác nhận nó đúng trước khi commit. Đừng chạy --update-snapshots một cách
 * máy móc, vì làm vậy là ghi đè bug thành "chuẩn mới".
 *
 * Ảnh gốc gắn với hệ điều hành (font render khác nhau). Ảnh chụp trên Windows
 * sẽ không khớp khi CI chạy Linux — sinh baseline trong Docker để đồng nhất:
 *   docker run --rm --ipc=host -v "${PWD}:/work" -w /work \
 *     mcr.microsoft.com/playwright:v{{PW_VERSION}}-noble npx playwright test --update-snapshots
 */

test.describe('Visual — Trang chủ', () => {
  test.beforeEach(async ({ page }) => {
    // Ảnh chỉ ổn định khi đầu vào ổn định. Cố định thời gian để mọi thành phần
    // hiển thị ngày/giờ không làm ảnh khác nhau mỗi lần chạy.
    await page.clock.setFixedTime(new Date('2026-01-15T10:00:00'));
  });

  test('TC-VIS-01: bố cục trang chủ không đổi', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page).toHaveScreenshot('trang-chu.png', {
      fullPage: true,
      // Che những vùng luôn thay đổi — đây là lý do số 1 khiến visual test bị bỏ.
      mask: [
        page.getByTestId('current-time'),
        page.getByTestId('user-avatar'),
        page.locator('.ads-banner'),
      ],
      animations: 'disabled',
      caret: 'hide',
    });
  });

  const breakpoints = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const bp of breakpoints) {
    test(`TC-VIS-02: bố cục đúng ở ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/');
      await expect(page).toHaveScreenshot(`trang-chu-${bp.name}.png`, { fullPage: true });
    });
  }

  test('TC-VIS-03: không bị tràn ngang trên mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Kiểm tra rẻ tiền nhưng bắt được rất nhiều lỗi responsive,
    // và không cần ảnh baseline nên không bị nhiễu vì khác font.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow, 'Trang bị tràn ngang ở 375px').toBe(false);
  });
});

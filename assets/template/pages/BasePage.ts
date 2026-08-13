import { Page, expect } from '@playwright/test';

/**
 * Lớp cha cho mọi Page Object.
 *
 * Page Object biết *cách bấm*, không biết *bấm để làm gì*. Assertion nghiệp vụ
 * thuộc về file spec; ở đây chỉ giữ những kiểm tra mô tả trạng thái của chính trang
 * (đã mở xong chưa, có toast gì) để spec đọc được như tiếng Việt.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Đường dẫn tương đối so với baseURL, ví dụ '/login'. */
  abstract readonly path: string;

  async goto() {
    await this.page.goto(this.path);
    await this.waitUntilReady();
  }

  /**
   * Chờ trang thật sự dùng được, không chỉ là đã tải HTML.
   * Sửa selector loading cho khớp app của bạn; nếu app không có overlay loading
   * thì xoá hẳn hàm này đi thay vì để nó chờ vô ích.
   */
  async waitUntilReady() {
    const loading = this.page.getByTestId('app-loading');
    if (await loading.count()) {
      await expect(loading).toBeHidden({ timeout: 30_000 });
    }
  }

  async expectToast(message: string | RegExp) {
    await expect(this.page.getByRole('alert').filter({ hasText: message })).toBeVisible();
  }

  /** Đính ảnh màn hình vào HTML report — dùng làm bằng chứng nghiệm thu. */
  async attachScreenshot(name: string) {
    const { test } = await import('@playwright/test');
    await test.info().attach(name, {
      body: await this.page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  }
}

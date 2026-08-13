import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * ⚠ Đây là mẫu — locator bên dưới là phỏng đoán cho một form đăng nhập điển hình.
 * Chạy `node scripts/explore.mjs --url <BASE_URL>/login` để lấy locator có thật
 * của app rồi thay vào. Đoán selector là nguyên nhân số 1 gây test flaky.
 */
export class LoginPage extends BasePage {
  readonly path = '/login';

  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    // Locator chỉ là "cách tìm", nó chưa đi tìm gì lúc này — nên khai báo ở đây an toàn
    // kể cả khi trang chưa load.
    this.email = page.getByLabel(/email|tài khoản/i);
    this.password = page.getByLabel(/mật khẩu|password/i);
    this.submit = page.getByRole('button', { name: /đăng nhập|login|sign in/i });
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

  async expectStillOnLoginPage() {
    await expect(this.page).toHaveURL(/login/);
  }
}

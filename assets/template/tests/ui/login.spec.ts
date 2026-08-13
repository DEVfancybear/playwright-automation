import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

/**
 * Spec mẫu — sửa cho khớp app thật.
 *
 * Quy ước: tên test bắt đầu bằng mã test case để đối chiếu được với file
 * test case của tester; tag @smoke / @regression để lọc khi chạy.
 */

// Test đăng nhập phải bắt đầu ở trạng thái CHƯA đăng nhập,
// nên tắt storageState mà cả suite đang dùng chung.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Đăng nhập', () => {
  test('TC-LOGIN-01: đăng nhập thành công với tài khoản hợp lệ @smoke', async ({ page }) => {
    const login = new LoginPage(page);

    await test.step('Mở trang đăng nhập', async () => {
      await login.goto();
    });

    await test.step('Nhập tài khoản hợp lệ và bấm Đăng nhập', async () => {
      await login.signIn(process.env.TEST_USER!, process.env.TEST_PASS!);
    });

    await test.step('Kết quả mong đợi: vào được trang chủ', async () => {
      await expect(page).toHaveURL(/dashboard|home|trang-chu/);
      await expect(page.getByRole('button', { name: /tài khoản|đăng xuất/i })).toBeVisible();
    });
  });

  /**
   * Data-driven: mỗi bộ dữ liệu thành một test riêng trong report, nên khi fail
   * biết ngay ca nào. Khác hẳn với việc nhét vòng lặp *bên trong* một test —
   * lúc đó fail ca đầu là các ca sau không chạy nữa.
   */
  const invalidCases = [
    { id: 'TC-LOGIN-02', email: '',                  pass: 'Abc@12345', error: /vui lòng nhập email|email.*bắt buộc/i },
    { id: 'TC-LOGIN-03', email: 'sai-dinh-dang',     pass: 'Abc@12345', error: /email không hợp lệ|định dạng/i },
    { id: 'TC-LOGIN-04', email: 'user@example.com',  pass: '',          error: /vui lòng nhập mật khẩu|mật khẩu.*bắt buộc/i },
    { id: 'TC-LOGIN-05', email: 'user@example.com',  pass: 'saibetnhe', error: /không đúng|sai/i },
  ];

  for (const c of invalidCases) {
    test(`${c.id}: báo lỗi với "${c.email || '(trống)'}" / "${c.pass || '(trống)'}" @regression`, async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.signIn(c.email, c.pass);

      // Hiện lỗi là chưa đủ: bug hay gặp là vừa hiện lỗi vừa cho đi tiếp.
      await login.expectError(c.error);
      await login.expectStillOnLoginPage();
    });
  }

  test('TC-LOGIN-06: không lộ mật khẩu trên giao diện @regression', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.password).toHaveAttribute('type', 'password');
  });
});

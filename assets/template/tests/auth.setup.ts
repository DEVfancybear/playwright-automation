import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Đăng nhập MỘT LẦN cho cả suite, lưu cookie + localStorage vào .auth/user.json.
 *
 * Nếu mỗi test tự đăng nhập qua giao diện, một suite 100 test tốn thêm ~8 phút
 * và có thêm 100 cơ hội fail vì lý do không liên quan tới thứ đang test.
 */

const authFile = '.auth/user.json';

setup('đăng nhập tài khoản test', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  if (!process.env.TEST_USER || !process.env.TEST_PASS) {
    // Ghi state rỗng để các project phụ thuộc vẫn khởi động được,
    // rồi bỏ qua bước này thay vì làm đỏ cả suite ngay lần chạy đầu.
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(true, 'Chưa có TEST_USER/TEST_PASS trong .env — bỏ qua đăng nhập');
    return;
  }

  await page.goto('/login');

  // ⚠ Sửa cho khớp giao diện thật. Lấy locator bằng:
  //    node scripts/explore.mjs --url <BASE_URL>/login
  await page.getByLabel(/email|tài khoản/i).fill(process.env.TEST_USER);
  await page.getByLabel(/mật khẩu|password/i).fill(process.env.TEST_PASS);
  await page.getByRole('button', { name: /đăng nhập|login|sign in/i }).click();

  // Chờ tín hiệu đăng nhập THẬT SỰ xong trước khi lưu.
  // Lưu quá sớm sẽ được file rỗng, và mọi test sau đó fail rất khó hiểu.
  await expect(page.getByRole('button', { name: /tài khoản|đăng xuất|logout/i }))
    .toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: authFile });
});

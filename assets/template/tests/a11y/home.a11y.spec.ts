import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Kiểm thử accessibility theo WCAG 2.1 AA.
 *
 * Cần gói: npm i -D @axe-core/playwright
 *
 * Lưu ý khi báo cáo: quét tự động chỉ bắt được khoảng 30–40% vấn đề. Nó biết ảnh
 * thiếu alt, nhưng không biết alt="hình ảnh" là vô nghĩa. Đừng viết "app đã đạt
 * WCAG AA" — viết "quét tự động không phát hiện vi phạm", và liệt kê phần cần
 * kiểm tra thủ công (trình đọc màn hình, thao tác chỉ bằng bàn phím).
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const pages = [
  { path: '/', name: 'Trang chủ' },
  // { path: '/products', name: 'Danh sách sản phẩm' },
  // { path: '/checkout', name: 'Thanh toán' },
];

for (const p of pages) {
  test(`TC-A11Y-01: ${p.name} đạt WCAG 2.1 AA`, async ({ page }, testInfo) => {
    await page.goto(p.path);

    const results = await new AxeBuilder({ page })
      .withTags(WCAG)
      // .exclude('#legacy-footer')   // ghi rõ lý do và khi nào gỡ, nếu không sẽ không ai dám bỏ ra
      .analyze();

    await testInfo.attach('vi-pham-accessibility.json', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });

    const summary = results.violations
      .map(v => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} phần tử)\n  → ${v.helpUrl}`)
      .join('\n');

    expect(results.violations, `Phát hiện ${results.violations.length} vi phạm:\n${summary}`).toEqual([]);
  });
}

test('TC-A11Y-02: điều hướng form bằng bàn phím', async ({ page }) => {
  // axe không kiểm tra được việc dùng bàn phím — phần này phải viết tay,
  // và cũng là lỗi hay gặp nhất trong thực tế.
  await page.goto('/login');

  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/email|tài khoản/i)).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/mật khẩu|password/i)).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /đăng nhập/i })).toBeFocused();
});

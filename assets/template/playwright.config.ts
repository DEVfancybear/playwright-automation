import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || '{{BASE_URL}}';
const API_URL = process.env.API_URL || '{{API_URL}}';

export default defineConfig({
  testDir: './tests',

  // Chạy song song cả trong cùng một file. Đổi thành false nếu suite cũ còn phụ thuộc nhau.
  fullyParallel: true,

  // Chặn merge nhầm code còn test.only
  forbidOnly: !!process.env.CI,

  // CI hay nhiễu vì máy/mạng; local để 0 để lỗi thật lộ ra ngay.
  // Test phải retry mới pass vẫn bị đánh dấu "flaky" trong report — đó là việc cần sửa.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,

  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Hai option này đổi format ngày/số của app — đặt theo môi trường tester dùng khi log bug.
    locale: process.env.TEST_LOCALE || 'vi-VN',
    timezoneId: process.env.TEST_TZ || 'Asia/Ho_Chi_Minh',
    // Bật khi môi trường staging dùng chứng chỉ tự ký
    ignoreHTTPSErrors: true,
  },

  projects: [
    // Đăng nhập một lần, lưu phiên vào .auth/user.json
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /.*\.api\.spec\.ts/,
    },

    // Test API — không cần trình duyệt nên chạy rất nhanh
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: API_URL,
        extraHTTPHeaders: { Accept: 'application/json' },
      },
    },

    // Mở khi cần cross-browser / responsive.
    // Chạy toàn bộ suite trên cả 3 trình duyệt làm thời gian gấp ba mà đa số bug là bug chung —
    // thực dụng hơn là chỉ chạy bộ @smoke trên firefox/webkit.
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'], storageState: '.auth/user.json' },
    //   dependencies: ['setup'],
    //   grep: /@smoke/,
    // },
    // {
    //   name: 'mobile',
    //   use: { ...devices['Pixel 7'], storageState: '.auth/user.json' },
    //   dependencies: ['setup'],
    // },
  ],

  // Tự bật server khi test app chạy local.
  // webServer: {
  //   command: 'npm run dev',
  //   url: '{{BASE_URL}}',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});

# Dựng và cấu hình dự án

Mục lục: [Cài đặt](#cài-đặt) · [Cấu trúc thư mục](#cấu-trúc-thư-mục) · [playwright.config.ts](#playwrightconfigts) · [Đa môi trường](#đa-môi-trường-dev--staging--prod) · [webServer](#tự-động-khởi-động-server) · [npm scripts](#npm-scripts) · [tsconfig](#tsconfig) · [Thêm vào dự án có sẵn](#thêm-vào-dự-án-đã-có)

## Cài đặt

Cách nhanh nhất là dùng `scripts/scaffold.mjs` (đã gồm mọi thứ dưới đây). Nếu cần làm tay:

```bash
npm init -y
npm i -D @playwright/test typescript dotenv
npx playwright install --with-deps chromium
```

`--with-deps` cài luôn thư viện hệ thống mà trình duyệt cần — bắt buộc trên Linux/CI, bỏ qua được trên máy Windows/macOS cá nhân. Chỉ cài `chromium` khi mới bắt đầu; thêm `firefox webkit` khi thật sự cần cross-browser, vì mỗi trình duyệt tốn vài trăm MB.

Gói thêm theo nhu cầu:

```bash
npm i -D @axe-core/playwright        # accessibility
npm i -D @faker-js/faker             # sinh dữ liệu test
npm i -D allure-playwright           # report Allure
npm i -D ajv                         # kiểm tra JSON schema của API
npm i -D xlsx                        # đọc test case Excel bằng JS (nếu không dùng script Python)
```

## Cấu trúc thư mục

```
e2e/
├── playwright.config.ts
├── .env                     # KHÔNG commit
├── .env.example             # commit — mẫu để người khác biết cần biến gì
├── pages/                   # Page Object: chỉ chứa locator + hành động, không chứa assertion nghiệp vụ
│   ├── BasePage.ts
│   ├── LoginPage.ts
│   └── components/          # phần dùng lại: Header, Sidebar, DataTable, Modal
├── tests/
│   ├── ui/
│   ├── api/
│   ├── visual/
│   └── a11y/
├── fixtures/
│   ├── test-fixtures.ts     # extend base test: page đã login, dữ liệu, apiClient
│   └── data/                # dữ liệu tĩnh: users.json, products.json
├── utils/                   # helper thuần: date, format, random, đọc excel/csv
├── .auth/                   # storageState — .gitignore
└── test-results/            # output khi chạy — .gitignore
```

Nguyên tắc phân tầng để suite không rối khi lớn lên:

- **`pages/`** biết *cách bấm*, không biết *cần bấm để làm gì*. Không đặt `expect` nghiệp vụ ở đây (trừ vài assert kỹ thuật kiểu "đã điều hướng xong").
- **`tests/`** biết *nghiệp vụ*, không biết selector. Nếu thấy `page.locator(...)` trong file spec, nghĩa là locator đó đang thiếu chỗ đứng trong Page Object.
- **`fixtures/`** lo phần chuẩn bị và dọn dẹp, để spec chỉ còn phần nghiệp vụ.

## playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  // Chạy các test trong cùng 1 file song song. Tắt nếu app không chịu nổi tải.
  fullyParallel: true,
  // Chặn merge nhầm code còn test.only
  forbidOnly: !!process.env.CI,
  // CI hay chập chờn vì máy yếu/mạng; local thì retry sẽ giấu bug thật của script
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],  // cho Jenkins/TestRail/Xray
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    // 'on-first-retry' là điểm cân bằng tốt: không phình dung lượng, mà lúc fail vẫn có trace
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    // Bật khi test môi trường staging dùng chứng chỉ tự ký
    ignoreHTTPSErrors: true,
  },

  // Timeout của cả 1 test; assertion có timeout riêng
  timeout: 60_000,
  expect: { timeout: 10_000 },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
    // Mở khi cần cross-browser
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] }, dependencies: ['setup'] },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] },
    // { name: 'mobile',  use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: process.env.API_URL },
    },
  ],
});
```

Vài lựa chọn đáng giải thích cho tester:

- `retries: 2` trên CI **không phải để giấu test flaky**. Nó để hạ nhiễu hạ tầng. Test nào phải retry mới pass thì HTML report vẫn đánh dấu "flaky" — coi đó là việc cần sửa, đừng bỏ qua.
- `trace: 'on-first-retry'` nghĩa là lần chạy đầu không ghi trace (nhanh), fail rồi chạy lại mới ghi. Muốn luôn có trace thì `'on'`, nhưng file sẽ rất nặng.
- `fullyParallel: true` rất nhanh nhưng đòi test phải độc lập. Nếu suite cũ còn phụ thuộc nhau, tạm để `false`, rồi sửa dần.

## Đa môi trường (dev / staging / prod)

Đừng làm nhiều file config. Dùng một config đọc biến môi trường:

`.env.example`
```bash
BASE_URL=https://staging.example.com
API_URL=https://api-staging.example.com
TEST_USER=tester@example.com
TEST_PASS=changeme
ADMIN_USER=admin@example.com
ADMIN_PASS=changeme
```

Chạy trên môi trường khác:

```bash
BASE_URL=https://uat.example.com npx playwright test
```

Trên Windows PowerShell:

```powershell
$env:BASE_URL="https://uat.example.com"; npx playwright test
```

Trong `.gitignore`:

```
.env
.auth/
test-results/
playwright-report/
blob-report/
node_modules/
```

Tài khoản test là bí mật thật — kể cả tài khoản staging. Lộ ra là lộ luôn cửa vào hệ thống nội bộ, nên đừng bao giờ đưa mật khẩu vào code hay vào file test case đính kèm ticket.

## Tự động khởi động server

Khi app chạy local, để Playwright tự lo vòng đời server thay vì bảo người dùng mở thêm terminal:

```typescript
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,   // local: dùng server đang chạy sẵn nếu có
  timeout: 120_000,
},
```

Nhiều server (backend + frontend) thì truyền mảng:

```typescript
webServer: [
  { command: 'npm run api', url: 'http://localhost:4000/health', reuseExistingServer: !process.env.CI },
  { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI },
],
```

`url` nên trỏ tới endpoint health thật sự trả 200 khi app sẵn sàng — nếu trỏ vào trang chưa build xong, test sẽ chạy sớm và fail vô cớ.

## npm scripts

```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:smoke": "playwright test --grep @smoke",
    "test:regression": "playwright test --grep @regression",
    "test:api": "playwright test --project=api",
    "test:visual": "playwright test --project=visual",
    "test:update-snapshots": "playwright test --update-snapshots",
    "report": "playwright show-report",
    "codegen": "playwright codegen"
  }
}
```

Gắn tag ngay trong tên test để lọc được về sau — rẻ và rất hữu ích khi suite lớn:

```typescript
test('TC-LOGIN-01: đăng nhập thành công @smoke @regression', async ({ page }) => { ... });
```

## tsconfig

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@pages/*": ["pages/*"],
      "@fixtures/*": ["fixtures/*"],
      "@utils/*": ["utils/*"]
    }
  },
  "include": ["**/*.ts"]
}
```

## Thêm vào dự án đã có

Nếu repo đã có test Playwright: **đọc `playwright.config.ts` và một spec tiêu biểu trước khi viết gì thêm**. Bám theo convention có sẵn (cách đặt tên, có dùng POM không, fixture nào đang có) quan trọng hơn là áp khung "chuẩn" trong tài liệu này. Một suite nhất quán nhưng khác chuẩn vẫn dễ bảo trì hơn một suite nửa nọ nửa kia.

Nếu repo đang dùng Cypress/Selenium và người dùng muốn chuyển sang Playwright: đừng dịch máy móc từng dòng. Chuyển từng luồng nghiệp vụ một, bắt đầu bằng bộ smoke, chạy song song hai suite tới khi tin được suite mới.

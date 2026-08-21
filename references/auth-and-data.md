# Đăng nhập một lần và quản lý dữ liệu test

Mục lục: [Vì sao cần storageState](#vì-sao-cần-storagestate) · [Setup project](#thiết-lập-setup-project) · [Nhiều role](#nhiều-role-user--admin) · [Đăng nhập qua API](#đăng-nhập-qua-api-nhanh-nhất) · [Per-worker auth](#per-worker-auth) · [Hai role trong một test](#hai-role-trong-cùng-một-test) · [OTP / 2FA](#otp-và-2fa) · [Sinh dữ liệu test](#sinh-dữ-liệu-test) · [Dọn dữ liệu](#dọn-dữ-liệu-sau-test) · [Data-driven](#chạy-một-test-với-nhiều-bộ-dữ-liệu)

> **Ở bước EXPLORE**, đăng nhập là việc của `scripts/auth-login.mjs` — chạy `--check` trước, hết phiên thì nó tự đăng nhập bằng credential trong `.env` rồi lưu `storageState`. Agent không gõ mật khẩu và không đọc giá trị mật khẩu; nó chỉ truyền tên biến. File đó dùng lại luôn ở bước GENERATE, nên spec không phải login qua UI.
>
> **Ép hết phiên / xoá cookie đăng nhập thì bắt buộc dùng spec.** Cookie phiên thường là `HttpOnly`, `document.cookie` không thấy và JS trong trang không xoá được. Chỉ hai đường: `await context.clearCookies({ name: 'access_token' })` trong Playwright, hoặc chờ hết TTL thật (đọc `Max-Age` trên `Set-Cookie` lúc login để biết phải chờ bao lâu).

## Đăng nhập tự động ở bước EXPLORE

> **Kiểm topology trước.** Runtime chạy script của agent và trình duyệt agent lái có thể là hai máy khác nhau. `curl --max-time 8 <target>` từ runtime agent: ra mã HTTP thì dùng cách dưới; timeout mà trình duyệt vẫn mở được target thì phải [bắc cầu bằng file phiên](#bắc-cầu-file-phiên-qua-ranh-giới-mạng). Bảng đầy đủ ở `SKILL.md`.

Trước khi thao tác gì trên app cần đăng nhập, chạy hai lệnh này. Không gõ mật khẩu bằng tay, không hỏi mật khẩu trong hội thoại.

```bash
# Còn phiên dùng được thì thôi (exit 0); hết hạn thì exit 3.
node scripts/auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json --check   || node scripts/auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json
```

Credential đọc từ `.env` cạnh dự án — agent chỉ truyền **tên biến**:

```bash
TEST_USER=qa_user01
TEST_PASS=...
TEST_TOTP_SECRET=...      # chỉ khi app bật 2FA bằng Authenticator
```

Script tự dò ô tài khoản/mật khẩu/nút submit theo nhãn và role, nên phần lớn form đăng nhập chạy được ngay mà không cần khai selector. Dò sai thì truyền `--user-selector` / `--pass-selector` / `--submit-selector` lấy từ cây accessibility.

**Ba thứ script làm mà auth setup viết vội thường quên:**

| | Vì sao quan trọng |
|---|---|
| Chờ tín hiệu đăng nhập xong rồi mới lưu | Lưu ngay sau khi click thì cookie phiên có thể chưa set kịp → file rỗng, mọi test sau fail rất khó truy |
| Mở lại bằng context sạch để xác minh | Chứng minh phiên thật sự dùng được, không phải chỉ "file có tồn tại" |
| Nhớ trang đích sau đăng nhập (`.meta.json`) | Nhiều app vẫn hiện form login ở `/` kể cả khi đã đăng nhập; xác minh ở đó sẽ luôn kết luận sai là hết phiên |

**Bảo mật — ba điều cấm.** Không hỏi mật khẩu trong hội thoại (transcript được lưu). Không truyền mật khẩu qua tham số dòng lệnh (nằm trong `ps` và shell history). Không hard-code trong spec. `.env` và `.auth/` đều phải nằm trong `.gitignore`.

Với app không gắn phiên vào cookie/localStorage (token chỉ sống trong `sessionStorage`, hoặc cần header riêng), `storageState` không tái lập được phiên — script sẽ báo rõ ở bước xác minh. Khi đó dùng [đăng nhập qua API](#đăng-nhập-qua-api-nhanh-nhất) rồi bơm token.

## Bắc cầu file phiên qua ranh giới mạng

Agent chạy trong container bị chặn egress không chạy `auth-login.mjs` tới staging được — nhưng nó vẫn lái được trình duyệt trên máy người dùng, và trình duyệt đó thì tới được. Thứ đi qua ranh giới là **file phiên**, không phải kết nối.

Người dùng chạy một lần trên máy mình:

```bash
node scripts/auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json
```

Rồi nạp vào trình duyệt agent lái. **Nếu agent lái Chrome thật của người dùng thì không cần bước này** — chỉ cần đăng nhập một lần trong chính Chrome đó, phiên nằm trong profile và sống qua nhiều lượt. Ba lệnh dưới chỉ dành cho Playwright MCP:

```bash
# Cách 1 — gọn nhất: mọi tab agent mở đều đã đăng nhập
npx @playwright/mcp@latest --storage-state .auth/staging.json

# Cách 2 — profile bền: đăng nhập một lần trong profile, sống qua nhiều phiên
npx @playwright/mcp@latest --user-data-dir ~/.pw-profile-staging

# Cách 3 — agent tự nạp giữa chừng (đổi role): bật --caps=storage
#   rồi gọi tool browser_set_storage_state
```

Ba tuỳ chọn này là của Playwright MCP, và `storageState` mà `auth-login.mjs` sinh ra đúng định dạng Playwright nên nạp thẳng được.

Sau bước một-lần đó, agent không phải nhờ người dùng đăng nhập nữa — kể cả lượt cần soi DOM/network trực tiếp. Còn nếu **trình duyệt cũng** nằm trong container bị chặn thì không cứu được: báo `Blocked` kèm điều kiện mở egress hoặc chuyển agent sang máy có VPN.

## Vì sao cần storageState

Nếu mỗi test đều đăng nhập qua giao diện, một suite 100 test sẽ tốn thêm khoảng 100 × 5 giây = hơn 8 phút chỉ để gõ lại cùng một mật khẩu, và thêm 100 cơ hội để test fail vì lý do không liên quan đến thứ đang test.

`storageState` giải quyết bằng cách đăng nhập **một lần**, lưu cookie + localStorage ra file, rồi mọi test khởi động ở trạng thái đã đăng nhập sẵn.

## Thiết lập setup project

`tests/auth.setup.ts`:

```typescript
import { test as setup, expect } from '@playwright/test';

const authFile = '.auth/user.json';

setup('đăng nhập tài khoản người dùng', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_USER!);
  await page.getByLabel('Mật khẩu').fill(process.env.TEST_PASS!);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // Chờ tín hiệu đăng nhập THẬT SỰ xong trước khi lưu state.
  // Lưu quá sớm sẽ được file rỗng và mọi test sau đó fail một cách khó hiểu.
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('button', { name: 'Tài khoản' })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
```

`playwright.config.ts`:

```typescript
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
    dependencies: ['setup'],   // luôn chạy setup trước
  },
],
```

Thêm `.auth/` vào `.gitignore`. File này chứa cookie phiên thật — ai có nó là đăng nhập được vào tài khoản đó mà không cần mật khẩu.

Test cần trạng thái chưa đăng nhập (ví dụ chính test đăng nhập) thì tự tắt:

```typescript
test.use({ storageState: { cookies: [], origins: [] } });

test('TC-LOGIN-02: báo lỗi khi sai mật khẩu', async ({ page }) => { ... });
```

## Nhiều role (user / admin)

```typescript
// tests/auth.setup.ts
const roles = [
  { name: 'user',  file: '.auth/user.json',  env: ['TEST_USER', 'TEST_PASS'] },
  { name: 'admin', file: '.auth/admin.json', env: ['ADMIN_USER', 'ADMIN_PASS'] },
] as const;

for (const role of roles) {
  setup(`đăng nhập ${role.name}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env[role.env[0]]!);
    await page.getByLabel('Mật khẩu').fill(process.env[role.env[1]]!);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL('**/dashboard');
    await page.context().storageState({ path: role.file });
  });
}
```

Chọn role trong spec:

```typescript
test.describe('Chức năng quản trị', () => {
  test.use({ storageState: '.auth/admin.json' });

  test('admin xem được danh sách người dùng', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Quản lý người dùng' })).toBeVisible();
  });
});
```

Và nhớ có test kiểm tra chiều ngược lại — user thường **không** vào được trang admin. Bug phân quyền thường nghiêm trọng hơn bug chức năng:

```typescript
test('user thường không truy cập được trang quản trị', async ({ page }) => {
  await page.goto('/admin/users');
  await expect(page.getByText('Bạn không có quyền truy cập')).toBeVisible();
});
```

## Đăng nhập qua API (nhanh nhất)

Nếu hệ thống có API đăng nhập, bỏ hẳn bước bấm giao diện — nhanh hơn nhiều và không gãy khi trang login đổi layout:

```typescript
setup('đăng nhập bằng API', async ({ request }) => {
  const res = await request.post(`${process.env.API_URL}/api/auth/login`, {
    data: { username: process.env.TEST_USER, password: process.env.TEST_PASS },
  });
  expect(res.ok()).toBeTruthy();
  const { accessToken } = await res.json();

  // Token nằm ở cookie
  await request.storageState({ path: '.auth/user.json' });

  // Hoặc token nằm ở localStorage — phải chèn qua trình duyệt
  // const page = await browser.newPage();
  // await page.goto('/');
  // await page.evaluate(t => localStorage.setItem('access_token', t), accessToken);
  // await page.context().storageState({ path: '.auth/user.json' });
});
```

Đánh đổi: cách này bỏ qua chính luồng đăng nhập, nên vẫn cần **ít nhất một test đăng nhập qua UI** trong bộ smoke, nếu không sẽ có ngày trang login hỏng mà toàn bộ suite vẫn xanh.

## Per-worker auth

Khi test có ghi/sửa dữ liệu của tài khoản, dùng chung một tài khoản cho nhiều worker song song sẽ gây xung đột. Cho mỗi worker một tài khoản riêng:

```typescript
// fixtures/auth-fixtures.ts
import { test as base } from '@playwright/test';
import fs from 'fs';

export const test = base.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  workerStorageState: [async ({ browser }, use) => {
    const id = test.info().parallelIndex;
    const file = `.auth/worker-${id}.json`;

    if (!fs.existsSync(file)) {
      const page = await browser.newPage({ storageState: undefined });
      await page.goto('/login');
      await page.getByLabel('Email').fill(`tester${id}@example.com`);
      await page.getByLabel('Mật khẩu').fill(process.env.TEST_PASS!);
      await page.getByRole('button', { name: 'Đăng nhập' }).click();
      await page.waitForURL('**/dashboard');
      await page.context().storageState({ path: file });
      await page.close();
    }
    await use(file);
  }, { scope: 'worker' }],
});
```

Cách này cần chuẩn bị sẵn `tester0@`, `tester1@`... trên môi trường test. Chỉ dựng khi thật sự gặp xung đột — nó thêm một tầng phức tạp không nhỏ.

## Hai role trong cùng một test

Kiểm tra tương tác giữa hai người dùng (chat, duyệt đơn, thông báo):

```typescript
test('admin duyệt đơn thì user thấy trạng thái đổi', async ({ browser }) => {
  const userCtx  = await browser.newContext({ storageState: '.auth/user.json' });
  const adminCtx = await browser.newContext({ storageState: '.auth/admin.json' });

  const userPage  = await userCtx.newPage();
  const adminPage = await adminCtx.newPage();

  await userPage.goto('/orders/123');
  await expect(userPage.getByTestId('status')).toHaveText('Chờ duyệt');

  await adminPage.goto('/admin/orders/123');
  await adminPage.getByRole('button', { name: 'Duyệt' }).click();

  await userPage.reload();
  await expect(userPage.getByTestId('status')).toHaveText('Đã duyệt');

  await userCtx.close();
  await adminCtx.close();
});
```

## OTP và 2FA

Ba cách, theo thứ tự nên thử:

1. **Tài khoản test được miễn OTP** — xin backend bật cờ cho vài tài khoản trên staging. Đơn giản và ổn định nhất.
2. **OTP cố định trên môi trường test** — ví dụ luôn là `123456`.
3. **Lấy OTP từ nguồn khác** — API nội bộ, hoặc hộp thư test như Mailosaur/MailHog:
   ```typescript
   const otp = await getOtpFromTestInbox(email);   // helper tự viết, gọi API mail
   await page.getByLabel('Mã OTP').fill(otp);
   ```

Đừng cố tự động hóa SMS thật. Chi phí và độ chập chờn luôn vượt giá trị nhận được; ghi vào báo cáo là ca này kiểm thử thủ công.

## Sinh dữ liệu test

Dữ liệu cố định (`test01@example.com`) sẽ đụng nhau khi chạy song song và bẩn dần qua mỗi lần chạy. Luôn sinh dữ liệu duy nhất:

```typescript
// utils/data.ts
export const unique = (prefix = 'test') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
export const uniqueEmail = () => `${unique('auto')}@example.com`;
export const uniquePhone = () => `09${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
```

Với dữ liệu thật hơn, dùng `@faker-js/faker` (có locale `vi`):

```typescript
import { fakerVI as faker } from '@faker-js/faker';

const customer = {
  name: faker.person.fullName(),          // "Nguyễn Văn Hùng"
  phone: faker.phone.number(),
  address: faker.location.streetAddress(),
  company: faker.company.name(),
};
```

Nhớ kiểm thử cả dữ liệu "xấu" — tester giỏi luôn nghĩ tới nhóm này:

```typescript
export const edgeCases = {
  emptyString: '',
  spacesOnly: '   ',
  veryLong: 'A'.repeat(256),
  vietnameseAccents: 'Nguyễn Thị Hồng Ánh',
  emoji: '🎉 Khuyến mãi 🎁',
  sqlLike: "'; DROP TABLE users; --",
  htmlLike: '<script>alert(1)</script>',
  leadingZero: '0123456789',
  negativeNumber: '-1',
};
```

Hai giá trị `sqlLike` và `htmlLike` ở đây dùng để kiểm tra app **escape và validate đầu vào đúng cách** — kỳ vọng là hệ thống lưu/hiển thị nguyên văn hoặc báo lỗi, chứ không thực thi. Đó là kiểm thử phòng thủ trên chính sản phẩm của mình, không phải tấn công hệ thống khác.

## Dọn dữ liệu sau test

```typescript
test.describe('Quản lý khách hàng', () => {
  const created: number[] = [];

  test('tạo khách hàng mới', async ({ page, request }) => {
    const name = unique('KH');
    await page.goto('/customers/new');
    await page.getByLabel('Tên khách hàng').fill(name);
    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Tạo thành công')).toBeVisible();

    created.push(Number(await page.getByTestId('customer-id').textContent()));
  });

  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: process.env.API_URL });
    for (const id of created) await ctx.delete(`/api/customers/${id}`).catch(() => {});
    await ctx.dispose();
  });
});
```

Dọn bằng API luôn tốt hơn dọn bằng UI: nhanh hơn, và vẫn chạy được khi giao diện đang hỏng. Bọc `.catch(() => {})` để việc dọn dẹp thất bại không làm cả suite đỏ — nhưng nếu thấy dữ liệu rác tích tụ thì phải xử lý, đừng để lâu.

Nếu môi trường test cho phép, phương án sạch nhất là reset toàn bộ dữ liệu về trạng thái gốc trong `globalSetup` (chạy script seed DB) — mọi lần chạy đều bắt đầu từ cùng một điểm.

## Chạy một test với nhiều bộ dữ liệu

Cách này biến bảng test case trong Excel thành code rất tự nhiên:

```typescript
const cases = [
  { id: 'TC-LOGIN-02', email: '',                pass: '123456', error: 'Vui lòng nhập email' },
  { id: 'TC-LOGIN-03', email: 'sai-dinh-dang',   pass: '123456', error: 'Email không hợp lệ' },
  { id: 'TC-LOGIN-04', email: 'a@b.com',         pass: '',       error: 'Vui lòng nhập mật khẩu' },
  { id: 'TC-LOGIN-05', email: 'a@b.com',         pass: 'sai',    error: 'Email hoặc mật khẩu không đúng' },
];

for (const c of cases) {
  test(`${c.id}: đăng nhập lỗi — "${c.email || '(trống)'}" / "${c.pass || '(trống)'}"`, async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(c.email, c.pass);
    await login.expectError(c.error);
  });
}
```

Mỗi bộ dữ liệu thành một test riêng trong report, nên khi fail bạn biết chính xác ca nào — khác hẳn với việc nhét vòng lặp *bên trong* một test, lúc đó fail ca đầu là các ca sau không chạy nữa.

# Đăng nhập một lần và quản lý dữ liệu test

Mục lục: [Vì sao cần storageState](#vì-sao-cần-storagestate) · [Setup project](#thiết-lập-setup-project) · [Nhiều role](#nhiều-role-user--admin) · [Đăng nhập qua API](#đăng-nhập-qua-api-nhanh-nhất) · [Per-worker auth](#per-worker-auth) · [Hai role trong một test](#hai-role-trong-cùng-một-test) · [OTP / 2FA](#otp-và-2fa) · [Sinh dữ liệu test](#sinh-dữ-liệu-test) · [Dọn dữ liệu](#dọn-dữ-liệu-sau-test) · [Data-driven](#chạy-một-test-với-nhiều-bộ-dữ-liệu)

> **Ở bước EXPLORE**, đăng nhập là việc của `scripts/auth-login.mjs` — gọi một lần là đủ: helper tự dùng lại phiên còn sống hoặc đăng nhập lại bằng credential trong `.env` rồi lưu `storageState`. Agent không mở/in giá trị và chỉ truyền tên biến; helper process được phép nạp secret nội bộ để điền form. Thực thi helper là đường an toàn bắt buộc, không phải lý do từ chối login. File phiên dùng lại luôn ở bước GENERATE, nên spec không phải login qua UI.
>
> **Ép hết phiên / xoá cookie đăng nhập thì bắt buộc dùng spec.** Cookie phiên thường là `HttpOnly`, `document.cookie` không thấy và JS trong trang không xoá được. Chỉ hai đường: `await context.clearCookies({ name: 'access_token' })` trong Playwright, hoặc chờ hết TTL thật (đọc `Max-Age` trên `Set-Cookie` lúc login để biết phải chờ bao lâu).

## Đăng nhập tự động ở bước EXPLORE

> **Kiểm topology trước.** Runtime chạy script của agent và browser agent lái có thể là hai máy khác nhau. `curl --max-time 8 <target>` từ runtime agent: ra mã HTTP thì dùng cách dưới; runtime bị chặn nhưng browser tới được target thì dùng [local MCP auth bridge](#local-mcp-auth-bridge-qua-ranh-giới-mạng). Bảng đầy đủ ở `SKILL.md`.

Trước khi thao tác gì trên app cần đăng nhập, chạy một lệnh idempotent. Không gõ mật khẩu bằng tay, không hỏi mật khẩu trong hội thoại.

```bash
# Fresh clone: lệnh standalone/helper cũng tự tạo file này khi thiếu.
npm run auth:setup

# Còn phiên thì dùng lại; hết hạn/chưa có thì tự đăng nhập và xác minh lại.
node scripts/auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json
```

Credential đọc từ `.env` riêng ở root dự án — agent chỉ truyền **tên biến**. Helper tạo skeleton rỗng một lần, không overwrite file hiện có. Dotenv trong `assets/template`, `examples`, `fixtures`, `samples` hoặc file `*.example`/`*.sample` luôn bị từ chối, kể cả khi chứa giá trị trông giống tài khoản thật:

```bash
TEST_USER=qa_user01
TEST_PASS=...
TEST_TOTP_SECRET=...      # chỉ khi app bật 2FA bằng Authenticator
```

Script tự dò ô tài khoản/mật khẩu/nút submit theo nhãn và role, hỗ trợ cả form một trang và luồng username → Tiếp tục → password. Nếu thấy TOTP và `.env` có `TEST_TOTP_SECRET`, helper tự sinh mã; tên biến khác thì dùng `--totp-env`. Dò sai thì truyền `--user-selector` / `--next-selector` / `--pass-selector` / `--submit-selector` lấy từ cây accessibility. `--check` chỉ dùng khi cần chẩn đoán riêng trạng thái phiên, không dùng để dựng một nhánh shell cho pipeline bình thường.

Nếu certificate lỗi trên target đã xác nhận local/dev/QA/staging/UAT, Agent không nhờ tester click native warning. Chạy context riêng:

```bash
node scripts/auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json \
  --ignore-https-errors --confirm-non-production
```

Hai cờ phải đi cùng nhau. Chúng bị cấm trên production/unknown; báo cáo phải ghi TLS validation đã bị bypass, không được nói certificate hợp lệ.

**Ba thứ script làm mà auth setup viết vội thường quên:**

| | Vì sao quan trọng |
|---|---|
| Chờ tín hiệu đăng nhập xong rồi mới lưu | Lưu ngay sau khi click thì cookie phiên có thể chưa set kịp → file rỗng, mọi test sau fail rất khó truy |
| Mở lại bằng context sạch để xác minh | Chứng minh phiên thật sự dùng được, không phải chỉ "file có tồn tại" |
| Nhớ trang đích sau đăng nhập (`.meta.json`) và bind đúng login URL | Nhiều app vẫn hiện form login ở `/` kể cả khi đã đăng nhập; sidecar target cũ hoặc khác tenant/query không được làm bỏ qua target mới |

**Bảo mật — các điều cấm.** Không hỏi mật khẩu trong hội thoại (transcript được lưu). Không truyền mật khẩu qua tham số dòng lệnh (nằm trong `ps` và shell history). Không hard-code trong spec. `.env` và `.auth/` đều phải nằm trong `.gitignore`. Helper tự tắt debug mode của Playwright có thể in `fill(secret)`; nếu `NODE_DEBUG`/`NODE_DEBUG_NATIVE` đang bật thì helper fail closed trước khi spawn browser — unset rồi chạy lại, không cố lách guard.

Với app không gắn phiên vào cookie/localStorage (token chỉ sống trong `sessionStorage`, hoặc cần header riêng), `storageState` không tái lập được phiên — script sẽ báo rõ ở bước xác minh. Khi đó dùng [đăng nhập qua API](#đăng-nhập-qua-api-nhanh-nhất) rồi bơm token.

## Local MCP auth bridge qua ranh giới mạng

Agent chạy trong container bị chặn egress không thể dùng `auth-login.mjs` tới staging, nhưng browser trên máy người dùng vẫn tới được. Khi `.env` đã có credential, đường mặc định là chạy **MCP server ngay trên máy người dùng** và gắn nó vào tab Chrome/Edge hiện có qua Playwright Extension:

```bash
# Kiểm config mà không start server và không in secret value.
node scripts/mcp-auth-bridge.mjs \
  --env C:/path/to/project/.env \
  --login-url https://staging.example.com/login \
  --ignore-https-errors \
  --confirm-non-production \
  --user-env CMS_ADMIN_USER \
  --pass-env CMS_ADMIN_PASS \
  --select-selector 'select[name="role"]' \
  --select-value admin \
  --dry-run
```

Khai command `node` và toàn bộ argument trên (bỏ `--dry-run`) thành một local MCP server của Claude/Codex. Chỉ giữ hai cờ TLS khi certificate lỗi trên non-production đã xác nhận. Playwright Extension cần được cài và kết nối với đúng tab; extension token, nếu dùng để bỏ bước approve kết nối, đặt trong secret config của MCP host chứ không commit vào repo. Bridge pin `@playwright/mcp`, bật `--extension`, nạp adapter `mcp-auth-init.cjs` bằng `--init-page`, và dùng `--secrets` để redaction. Giá trị credential chỉ được đọc bên trong local MCP process; Agent chỉ truyền **tên biến**.

Các tuỳ chọn form:

| Tình huống | Argument |
|---|---|
| Form hai bước | `--next-selector <css>` |
| Dropdown Quản trị viên/Đối tác/tenant | `--select-selector <css> --select-value <value-hoặc-label>` |
| Selector app khác mặc định | `--user-selector`, `--pass-selector`, `--submit-selector`, `--otp-selector` |
| Password/OTP chuyển sang URL khác | Lặp `--login-url <exact-url>` cho từng URL được phép |
| Tên biến TOTP khác | `--totp-env <TÊN_BIẾN>` |

Exact login URL là ranh giới credential: khác protocol, host, path, query hoặc fragment thì bridge không điền. Không dùng wildcard. Không suy diễn credential từ định dạng — số điện thoại 10 số và PIN 6 số vẫn có thể là tài khoản CMS admin hợp lệ. Khi các tên biến đã cấu hình đều có giá trị, phải thử bridge một lần; **chỉ kết quả đăng nhập thật** mới chứng minh credential sai. Không được tự kết luận dựa trên hình dạng rồi bắt tester login tay.

Fallback khi không thể cắm local MCP/extension:

```bash
# Tạo file phiên trên máy tới được target, rồi nạp lúc start MCP.
node scripts/auth-login.mjs --url https://staging.example.com/login --out .auth/staging.json
npx @playwright/mcp@0.0.79 --storage-state .auth/staging.json

# Hoặc dùng profile bền.
npx @playwright/mcp@0.0.79 --user-data-dir ~/.pw-profile-staging
```

Sau khi bridge đã cắm, Agent không được hỏi người dùng đăng nhập tay trừ khi extension không kết nối, app trả auth failure thật, hoặc gặp CAPTCHA/WebAuthn/SMS/approval cần người. Nếu browser cũng không tới target thì báo `Blocked` kèm điều kiện mở egress hoặc chuyển agent sang máy có VPN.

## Phiên hết hạn nhanh hơn một lượt chạy

Đăng nhập một lần chỉ ăn thua khi phiên sống đủ lâu. Gặp CMS đặt TTL 15–30 phút thì người dùng bị kéo vào vòng lặp: cứ nửa tiếng lại phải gõ mật khẩu một lần.

Cách gọn nhất khi `.env` đã có credential và agent có thể dùng local MCP là auth bridge: mỗi khi tab quay lại exact login URL, bridge tự điền và submit lại trong local process. Nếu không cắm được bridge, để trình quản lý mật khẩu của Chrome điền hộ hoặc tick "Ghi nhớ đăng nhập"/xin BE nâng TTL trên staging; file `storageState` là fallback còn lại.

Dù chọn cách nào, **báo TTL ngắn lên như một finding về môi trường**. Nó phá mọi lượt chạy dài — regression đầy đủ, hay bug race cần vài chục attempt — chứ không chỉ gây phiền.

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

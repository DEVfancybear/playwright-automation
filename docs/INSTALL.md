# Hướng dẫn cài đặt

Mục lục: [Chọn cách cài](#chọn-cách-cài) · [npm](#cách-nhanh-nhất--npm) · [Codex cá nhân](#cách-1--codex-dùng-cho-mọi-dự-án) · [Codex theo repo](#cách-2--codex-theo-dự-án-chia-sẻ-cho-cả-team) · [claude.ai](#cách-3--claudeai-web--desktop) · [Claude Code](#cách-4--claude-code) · [Bridge login local](#cấu-hình-bridge-login-local-cho-claude--chromeedge) · [Kiểm tra](#kiểm-tra-đã-cài-được-chưa) · [Công cụ đi kèm](#cài-công-cụ-để-chạy-test) · [Cập nhật & gỡ](#cập-nhật) · [Sự cố](#sự-cố-thường-gặp)

## Chọn cách cài

| Bạn dùng agent ở đâu | Cách cài | Ai dùng được |
|---|---|---|
| Chỉ muốn clone rồi test ngay trong terminal | `git clone` → `npm run test:standalone` | Bất kỳ tester nào có Node ≥ 20; không cần project khác |
| Codex CLI / IDE / desktop | `npx @duong.dev/playwright-automation install --codex` | Chỉ mình bạn, ở mọi dự án trên máy |
| Codex, muốn chia sẻ cho team | Thêm `--project` rồi commit `.agents/skills/` | Cả team, khi làm việc trong dự án đó |
| Claude Code (terminal / IDE) | `npx @duong.dev/playwright-automation install` | Chỉ mình bạn, ở mọi dự án trên máy |
| Claude Code, muốn chia sẻ cho team | Thêm `--project` rồi commit `.claude/skills/` | Cả team, khi làm việc trong dự án đó |
| Codex hoặc Claude Code, muốn sửa skill | Clone bằng git vào thư mục skill tương ứng | Chỉ mình bạn, sửa trực tiếp được |
| claude.ai (web hoặc app desktop) | Upload file `.skill` vào profile | Chỉ mình bạn, ở mọi cuộc trò chuyện |

Cài nhiều cách cùng lúc cũng được. Bản trong dự án sẽ được ưu tiên hơn bản cá nhân.

---

## Chạy độc lập ngay trong repo clone

Đây là luồng dành cho tester muốn kiểm tra repository hoặc dùng tool terminal mà **không import skill vào project nào khác**:

Nếu dùng Agent, tester chỉ cần mở clone này trong Codex/Claude Code rồi nói **“Test repo này.”** Root `AGENTS.md`/`CLAUDE.md` hướng Agent chạy `npm run test:standalone`; Agent tự bootstrap và không được hỏi tester cài npm dependency hay Playwright browser thủ công. `npm test` chỉ dành cho yêu cầu full regression.

Nếu tự gõ terminal:

```bash
git clone https://github.com/DEVfancybear/playwright-automation.git
cd playwright-automation
npm run test:standalone
```

Lần chạy đầu tự thực hiện ba việc còn thiếu trên một clone sạch:

1. `npm ci` từ lockfile đã commit, nếu chưa có `@playwright/test`.
2. Tải đúng Chromium của Playwright nếu chưa có; `test:url -- --browser firefox|webkit` sẽ tải browser được chọn khi thiếu.
3. Tạo `.env` rỗng ở root (đã gitignore) nếu chưa có. Runner không đọc và không overwrite file hiện có; tester chỉ điền local khi target thật cần login.

Sau đó runner dùng Chromium thật với fixture local đi kèm, kiểm script `explore.mjs`, contract của skill và các evidence đầu ra. Thành công phải có marker `STANDALONE_OK` và exit code `0`. Lệnh không ghi vào `.agents/skills`, `.claude/skills`, không tạo project con và không cần tài khoản staging.

Các chế độ khác:

```bash
# Chạy toàn bộ regression suite (đây cũng là lệnh Agent tự chọn khi chỉ nghe “test”)
npm test
# Bí danh tường minh: npm run test:standalone:full

# Trinh sát/smoke một URL thật ngay từ repo clone
npm run test:url -- --url https://playwright.dev

# Mở browser để tester quan sát và chọn thư mục evidence riêng
npm run test:url -- --url https://staging.example.com --headed --out ./recon/staging

# Chỉ khi certificate lỗi trên staging/non-production đã xác nhận
npm run test:url -- --url https://staging.example.com \
  --ignore-https-errors --confirm-non-production
```

`TERMINAL_TEST_OK` xác nhận tool đã hoàn tất và evidence đã được ghi; nó không biến hành vi đang quan sát thành expected result nghiệp vụ. Hai cờ TLS phải đi cùng nhau và bị cấm trên production/unknown. Agent không dùng dotenv dưới `assets/template`, examples, fixtures hoặc file sample làm credential thật. Luồng tự hiểu yêu cầu, lập plan, generate, execute/heal và verdict vẫn cần Codex/Claude nạp skill.

---

## Cách nhanh nhất — npm

```bash
npx @duong.dev/playwright-automation install --codex    # Codex
npx @duong.dev/playwright-automation install            # Claude Code (tương thích lệnh cũ)
```

Với Codex, skill được copy vào `$CODEX_HOME/skills/playwright-automation/` khi `CODEX_HOME` đã cấu hình; nếu không thì dùng `~/.codex/skills/playwright-automation/`. Riêng cài theo dự án vẫn dùng `.agents/skills/`. Với Claude Code, skill được copy vào `~/.claude/skills/playwright-automation/`.

Các lệnh khác:

```bash
npx @duong.dev/playwright-automation install --codex --project  # cài vào .agents/skills/ của dự án
npx @duong.dev/playwright-automation install --codex --force    # ghi đè bản Codex đã cài
npx @duong.dev/playwright-automation install --claude --project # cài vào .claude/skills/ của dự án
npx @duong.dev/playwright-automation install --dir <đường-dẫn>/playwright-automation # thư mục skill đích
npx @duong.dev/playwright-automation where --codex       # xem bản Codex ở đâu
npx @duong.dev/playwright-automation uninstall --codex   # gỡ bản Codex
npx @duong.dev/playwright-automation --help
```

`--dir` là **thư mục skill đích chính xác**, không phải thư mục cha. Để tránh xoá nhầm dữ liệu, `install --force` và `uninstall` chỉ xoá khi đích không phải filesystem root/home/cwd/source repo và `SKILL.md` tại đó khai báo `name: playwright-automation`. Đích không xác minh được sẽ bị từ chối; installer không tự dọn một thư mục tuỳ ý.

Cập nhật lên bản mới: chạy lại lệnh `install --force`. `npx` luôn lấy phiên bản mới nhất trên npm.

Cách này không dựng liên kết tới repo, nên nếu bạn định **sửa nội dung skill** thì dùng cách clone bằng git bên dưới sẽ tiện hơn.

---

## Cách 1 — Codex (dùng cho mọi dự án)

```bash
CODEX_SKILLS_DIR="${CODEX_HOME:-$HOME/.codex}/skills"
git clone https://github.com/DEVfancybear/playwright-automation.git "$CODEX_SKILLS_DIR/playwright-automation"
```

Trên Windows PowerShell:

```powershell
$codexRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
git clone https://github.com/DEVfancybear/playwright-automation.git (Join-Path $codexRoot 'skills\playwright-automation')
```

Cấu trúc sau khi cài:

```
$CODEX_HOME/skills/ (hoặc ~/.codex/skills/)
└── playwright-automation/
    ├── SKILL.md
    ├── agents/openai.yaml
    ├── references/
    ├── scripts/
    └── assets/
```

Codex thường tự nhận thay đổi. Dùng `/skills` để xem danh sách hoặc gọi trực tiếp `$playwright-automation`. Nếu chưa thấy skill, khởi động lại Codex.

---

## Cách 2 — Codex theo dự án (chia sẻ cho cả team)

Đặt skill tại `.agents/skills/playwright-automation` trong repo dự án:

```bash
cd <thư mục dự án>
git clone --depth 1 https://github.com/DEVfancybear/playwright-automation.git .agents/skills/playwright-automation
rm -rf .agents/skills/playwright-automation/.git
git add .agents/skills/playwright-automation
git commit -m "chore: thêm skill playwright-automation cho Codex"
```

Codex quét `.agents/skills` từ thư mục làm việc hiện tại lên tới gốc repository. `SKILL.md` phải nằm ngay trong thư mục skill.

---

## Cách 3 — claude.ai (web / desktop)

### Bước 1: Có file `.skill`

Tự đóng gói từ mã nguồn:

```bash
git clone https://github.com/DEVfancybear/playwright-automation.git
cd playwright-automation
zip -r ../playwright-automation.skill SKILL.md agents references scripts assets LICENSE
```

Trên Windows PowerShell:

```powershell
git clone https://github.com/DEVfancybear/playwright-automation.git
cd playwright-automation
Compress-Archive -Path SKILL.md,agents,references,scripts,assets,LICENSE -DestinationPath ..\playwright-automation.zip
Rename-Item ..\playwright-automation.zip ..\playwright-automation.skill
```

Danh sách file này phải khớp `SKILL_CONTENT` trong `bin/install.mjs` — sửa một chỗ thì sửa cả hai.

> File `.skill` thực chất là file zip, bên trong có `SKILL.md` ở gốc. Đổi đuôi `.zip` thành `.skill` là xong.

### Bước 2: Upload

**Settings → Capabilities → Skills → Upload skill** → chọn file `.skill` → bật công tắc cho skill.

### Bước 3: Thử

Mở cuộc trò chuyện mới và gõ:

```
Dựng giúp tôi khung automation test Playwright cho https://example.com
```

Nếu skill được nạp, Claude sẽ nhắc tới quy trình LIVE → CODIFY, hoặc `scaffold.mjs` (vì đây là yêu cầu dựng khung rõ ràng). Với câu hỏi kiểu "xem hộ trang này lỗi gì", skill được nạp đúng sẽ **mở trình duyệt trước** để lấy evidence thật, rồi tiếp tục plan → generate → execute/heal → verdict. Chỉ yêu cầu thuần thao tác có từ giới hạn rõ như “chỉ mở”, “chỉ chụp ảnh” hoặc “chỉ lấy locator” mới dừng mà không codify test.

---

## Cách 4 — Claude Code

```bash
git clone https://github.com/DEVfancybear/playwright-automation.git ~/.claude/skills/playwright-automation
```

Trên Windows (Git Bash):

```bash
git clone https://github.com/DEVfancybear/playwright-automation.git "$HOME/.claude/skills/playwright-automation"
```

Trên Windows PowerShell:

```powershell
git clone https://github.com/DEVfancybear/playwright-automation.git "$env:USERPROFILE\.claude\skills\playwright-automation"
```

Cấu trúc sau khi cài phải như sau — **`SKILL.md` nằm ngay trong thư mục tên skill**, không lồng thêm một tầng:

```
~/.claude/skills/
└── playwright-automation/
    ├── SKILL.md
    ├── references/
    ├── scripts/
    └── assets/
```

Khởi động lại Claude Code để nó quét lại danh sách skill.

---

### Theo dự án (chia sẻ cho cả team)

Đặt skill trong chính repo dự án để ai clone về cũng có:

```bash
cd <thư mục dự án>
git clone --depth 1 https://github.com/DEVfancybear/playwright-automation.git .claude/skills/playwright-automation
rm -rf .claude/skills/playwright-automation/.git
git add .claude/skills/playwright-automation
git commit -m "chore: thêm skill playwright-automation cho team"
```

Xoá `.git` bên trong là cần thiết — nếu để lại, Git sẽ coi đó là submodule và người khác clone về sẽ nhận thư mục rỗng.

Muốn theo dõi cập nhật từ upstream thì dùng submodule thật thay vì clone:

```bash
git submodule add https://github.com/DEVfancybear/playwright-automation.git .claude/skills/playwright-automation
```

---

## Cấu hình bridge login local cho Claude + Chrome/Edge

Mục này dành cho topology: Claude runtime bị chặn egress tới staging nhưng tab Chrome/Edge trên máy bạn vẫn mở được, và credential đã nằm trong `.env`. Cấu hình **một lần**; từ những lần sau Claude phải tự login, không hỏi bạn gõ lại mật khẩu.

1. Cài **Playwright MCP Bridge** extension chính thức của Microsoft vào Chrome/Edge.
2. Kiểm cấu hình từ terminal local; command này chỉ in tên biến/argument, không in giá trị credential:

   ```powershell
   node "$env:USERPROFILE\.claude\skills\playwright-automation\scripts\mcp-auth-bridge.mjs" `
     --env "C:\path\to\your-project\.env" `
     --login-url "https://staging.example.com/login" `
     --user-env CMS_ADMIN_USER `
     --pass-env CMS_ADMIN_PASS `
     --select-selector 'select[name="role"]' `
     --select-value admin `
     --dry-run
   ```

3. Thêm local stdio server vào MCP config mà Claude Desktop/Claude Code đang đọc. Ví dụ JSON (merge vào object `mcpServers` hiện có):

   ```json
   {
     "mcpServers": {
       "playwright-auth-bridge": {
         "command": "node",
         "args": [
           "C:\\Users\\<you>\\.claude\\skills\\playwright-automation\\scripts\\mcp-auth-bridge.mjs",
           "--env", "C:\\path\\to\\your-project\\.env",
           "--login-url", "https://staging.example.com/login",
           "--user-env", "CMS_ADMIN_USER",
           "--pass-env", "CMS_ADMIN_PASS",
           "--select-selector", "select[name=\"role\"]",
           "--select-value", "admin"
         ]
       }
     }
   }
   ```

4. Restart Claude, mở đúng tab login rồi cho Playwright Extension kết nối. Đây là approval kết nối một lần, không phải nhập credential mỗi lượt. Nếu dùng extension token để auto-connect, đặt `PLAYWRIGHT_MCP_EXTENSION_TOKEN` trong secret config local của MCP host; không commit token vào `.mcp.json` hay repo.

`--login-url` là **exact URL allowlist**. Nếu bước password hoặc TOTP chuyển sang URL khác, lặp thêm `--login-url` cho từng URL. Form hai bước dùng `--next-selector`; TOTP dùng `--totp-env`; dropdown Quản trị viên/Đối tác dùng cặp `--select-selector` + `--select-value`. Chạy `node ...\mcp-auth-bridge.mjs --help` để xem đủ tuỳ chọn.

Bridge không đánh giá credential theo hình dạng. Số điện thoại, email, mã nhân viên, PIN sáu số đều được coi là opaque value; chỉ phản hồi đăng nhập thật từ app mới cho phép kết luận credential sai. Secret được đọc trong process MCP local và không đi qua conversation/tool arguments của Claude.

---

## Kiểm tra đã cài được chưa

Với Codex, mở `/skills` hoặc gọi trực tiếp:

```
$playwright-automation Hãy tái hiện bug này và verify bản fix của dev.
```

Với Claude, hỏi:

```
Bạn có skill nào về automation testing không?
```

Hoặc thử một yêu cầu thật:

```
Tôi cần lấy locator của trang https://playwright.dev để viết test
```

Skill hoạt động đúng khi agent **mở trình duyệt lấy element thật** (cây accessibility) rồi trả lời kèm bằng chứng — thay vì tự bịa selector hay viết sẵn một dự án test. Agent chỉ dùng `explore.mjs` khi môi trường không có công cụ browser, hoặc khi đang chuẩn bị codify.

Kiểm tra file trên đĩa:

```bash
ls "${CODEX_HOME:-$HOME/.codex}/skills/playwright-automation/SKILL.md" # Codex
ls ~/.claude/skills/playwright-automation/SKILL.md # Claude Code
```

---

## Cài công cụ để chạy test

Skill là phần hướng dẫn; để **chạy** test thì cần các công cụ sau. Không cài trước cũng được — agent sẽ hướng dẫn đúng lúc cần.

### Node.js (bắt buộc)

Cần Node ≥ 20. Kiểm tra:

```bash
node --version
```

Chưa có thì tải ở [nodejs.org](https://nodejs.org) (chọn bản LTS).

### Playwright (bắt buộc để chạy test)

Nếu đang đứng trong **repository skill vừa clone**, không cần cài tay: `npm run test:standalone` tự dùng lockfile và tải Chromium khi thiếu.

Nếu đã cài skill vào Agent và muốn sinh/chạy test trong **một dự án ứng dụng bên ngoài**, cài Playwright trong dự án test đó, không cài toàn cục:

```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

`--with-deps` cài thêm thư viện hệ thống mà trình duyệt cần — bắt buộc trên Linux/CI, bỏ qua được trên Windows và macOS.

Chỉ cài `chromium` lúc đầu. Thêm `firefox webkit` khi thật sự cần cross-browser, vì mỗi trình duyệt tốn vài trăm MB.

### Python + openpyxl (chỉ khi cần đọc file Excel)

```bash
python --version        # cần ≥ 3.9
pip install openpyxl
```

Không muốn cài vào Python hệ thống thì dùng môi trường ảo:

```bash
python -m venv venv
venv/Scripts/python.exe -m pip install openpyxl        # Windows
./venv/bin/pip install openpyxl                        # macOS / Linux
```

### Gói tuỳ chọn

```bash
npm i -D @axe-core/playwright     # kiểm thử accessibility
npm i -D @faker-js/faker          # sinh dữ liệu test thật hơn
npm i -D allure-playwright        # report Allure (cần thêm Java)
```

---

## Cập nhật

**Cài bằng npm** (cách ở đầu tài liệu):

```bash
npx @duong.dev/playwright-automation install --codex --force
npx @duong.dev/playwright-automation install --claude --force
```

**Chỉ với bản clone bằng git**:

```bash
cd "${CODEX_HOME:-$HOME/.codex}/skills/playwright-automation"
git pull

# Hoặc Claude Code
cd ~/.claude/skills/playwright-automation
git pull
```

Sau khi cập nhật, mở phiên Agent mới để catalog skill được nạp lại.

Trên claude.ai: xoá skill cũ trong Settings rồi upload file `.skill` mới.

## Gỡ cài

```bash
npx @duong.dev/playwright-automation uninstall --codex
npx @duong.dev/playwright-automation uninstall --claude
```

Trên claude.ai: **Settings → Capabilities → Skills** → xoá skill.

---

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Codex không thấy skill | Sai vị trí, còn bản legacy hoặc chưa quét lại | Chạy `where --codex`, kiểm tra `$CODEX_HOME/skills/playwright-automation/SKILL.md` (fallback `~/.codex/skills/...`), rồi mở phiên Codex mới; bản global cũ trong `~/.agents/skills` không phải đích cài hiện tại |
| Agent không tự dùng skill | Yêu cầu quá chung chung | Gọi `$playwright-automation` trong Codex, hoặc nhắc rõ "Playwright", "reproduce bug", "verify bug fix" |
| Claude không dùng skill dù đã cài | Chưa khởi động lại Claude Code, hoặc skill chưa được bật | Khởi động lại; kiểm tra công tắc trong Settings |
| Cấu trúc thư mục sai | Clone tạo thêm một tầng lồng nhau | `SKILL.md` phải nằm ngay trong `playwright-automation/`, không phải `playwright-automation/playwright-automation/` |
| `Executable doesn't exist at ...` | Chưa tải trình duyệt | `npx playwright install --with-deps chromium` |
| `Host system is missing dependencies` | Thiếu thư viện hệ thống (Linux) | `npx playwright install-deps`, hoặc dùng Docker image chính thức |
| `npm run test:standalone` báo thiếu `package-lock.json` | Clone/tải source chưa đầy đủ hoặc đang ở sai thư mục | Clone lại repository và chạy tại thư mục có cả `package.json` lẫn `package-lock.json` |
| `STANDALONE_FAIL` khi bootstrap | Mạng/npm registry bị chặn hoặc không có quyền cài system dependency | Kiểm tra kết nối npm; trên Linux cấp quyền phù hợp cho bước Playwright `--with-deps`, rồi chạy lại cùng lệnh |
| `Thiếu thư viện openpyxl` | Chưa cài gói Python | `pip install openpyxl` |
| `Không tìm thấy Playwright` khi chạy `explore.mjs` | Playwright cài ở dự án, script chạy từ thư mục khác | Chạy script **từ trong thư mục dự án** có `node_modules` |
| Script Python in ra ký tự lạ trên Windows | Console dùng bảng mã cp1252 | Script đã tự ép UTF-8; nếu vẫn lỗi, chạy `chcp 65001` trước |
| Upload `.skill` báo lỗi định dạng | `SKILL.md` không nằm ở gốc file zip | Nén **nội dung bên trong** thư mục, không nén cả thư mục |

# Hướng dẫn cài đặt

Mục lục: [Chọn cách cài](#chọn-cách-cài) · [npm](#cách-nhanh-nhất--npm) · [Codex cá nhân](#cách-1--codex-dùng-cho-mọi-dự-án) · [Codex theo repo](#cách-2--codex-theo-dự-án-chia-sẻ-cho-cả-team) · [claude.ai](#cách-3--claudeai-web--desktop) · [Claude Code](#cách-4--claude-code) · [Kiểm tra](#kiểm-tra-đã-cài-được-chưa) · [Công cụ đi kèm](#cài-công-cụ-để-chạy-test) · [Cập nhật & gỡ](#cập-nhật) · [Sự cố](#sự-cố-thường-gặp)

## Chọn cách cài

| Bạn dùng agent ở đâu | Cách cài | Ai dùng được |
|---|---|---|
| Codex CLI / IDE / desktop | `npx @duong.dev/playwright-automation install --codex` | Chỉ mình bạn, ở mọi dự án trên máy |
| Codex, muốn chia sẻ cho team | Thêm `--project` rồi commit `.agents/skills/` | Cả team, khi làm việc trong dự án đó |
| Claude Code (terminal / IDE) | `npx @duong.dev/playwright-automation install` | Chỉ mình bạn, ở mọi dự án trên máy |
| Claude Code, muốn chia sẻ cho team | Thêm `--project` rồi commit `.claude/skills/` | Cả team, khi làm việc trong dự án đó |
| Codex hoặc Claude Code, muốn sửa skill | Clone bằng git vào thư mục skill tương ứng | Chỉ mình bạn, sửa trực tiếp được |
| claude.ai (web hoặc app desktop) | Upload file `.skill` vào profile | Chỉ mình bạn, ở mọi cuộc trò chuyện |

Cài nhiều cách cùng lúc cũng được. Bản trong dự án sẽ được ưu tiên hơn bản cá nhân.

---

## Cách nhanh nhất — npm

```bash
npx @duong.dev/playwright-automation install --codex    # Codex
npx @duong.dev/playwright-automation install            # Claude Code (tương thích lệnh cũ)
```

Với Codex, skill được copy vào `~/.agents/skills/playwright-automation/`. Với Claude Code, skill được copy vào `~/.claude/skills/playwright-automation/`.

Các lệnh khác:

```bash
npx @duong.dev/playwright-automation install --codex --project  # cài vào .agents/skills/ của dự án
npx @duong.dev/playwright-automation install --codex --force    # ghi đè bản Codex đã cài
npx @duong.dev/playwright-automation install --claude --project # cài vào .claude/skills/ của dự án
npx @duong.dev/playwright-automation install --dir <đường dẫn>   # cài vào chỗ tự chọn
npx @duong.dev/playwright-automation where --codex       # xem bản Codex ở đâu
npx @duong.dev/playwright-automation uninstall --codex   # gỡ bản Codex
npx @duong.dev/playwright-automation --help
```

Cập nhật lên bản mới: chạy lại lệnh `install --force`. `npx` luôn lấy phiên bản mới nhất trên npm.

Cách này không dựng liên kết tới repo, nên nếu bạn định **sửa nội dung skill** thì dùng cách clone bằng git bên dưới sẽ tiện hơn.

---

## Cách 1 — Codex (dùng cho mọi dự án)

```bash
git clone https://github.com/DEVfancybear/playwright-automation.git ~/.agents/skills/playwright-automation
```

Trên Windows PowerShell:

```powershell
git clone https://github.com/DEVfancybear/playwright-automation.git "$env:USERPROFILE\.agents\skills\playwright-automation"
```

Cấu trúc sau khi cài:

```
~/.agents/skills/
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

Tải từ [Releases](../../releases), hoặc tự đóng gói từ mã nguồn:

```bash
git clone https://github.com/DEVfancybear/playwright-automation.git
cd playwright-automation
zip -r ../playwright-automation.skill . -x ".git/*" -x "docs/*"
```

Trên Windows PowerShell:

```powershell
git clone https://github.com/DEVfancybear/playwright-automation.git
Compress-Archive -Path playwright-automation\* -DestinationPath playwright-automation.zip
Rename-Item playwright-automation.zip playwright-automation.skill
```

> File `.skill` thực chất là file zip, bên trong có `SKILL.md` ở gốc. Đổi đuôi `.zip` thành `.skill` là xong.

### Bước 2: Upload

**Settings → Capabilities → Skills → Upload skill** → chọn file `.skill` → bật công tắc cho skill.

### Bước 3: Thử

Mở cuộc trò chuyện mới và gõ:

```
Dựng giúp tôi khung automation test Playwright cho https://example.com
```

Nếu skill được nạp, Claude sẽ nhắc tới `scaffold.mjs` hoặc quy trình Recon → Codify.

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

Skill hoạt động đúng khi agent nhắc tới trinh sát (recon), tái hiện bug có kiểm chứng, hoặc `explore.mjs` thay vì tự bịa selector.

Kiểm tra file trên đĩa:

```bash
ls ~/.agents/skills/playwright-automation/SKILL.md  # Codex
ls ~/.claude/skills/playwright-automation/SKILL.md # Claude Code
```

---

## Cài công cụ để chạy test

Skill là phần hướng dẫn; để **chạy** test thì cần các công cụ sau. Không cài trước cũng được — agent sẽ hướng dẫn đúng lúc cần.

### Node.js (bắt buộc)

Cần Node ≥ 18. Kiểm tra:

```bash
node --version
```

Chưa có thì tải ở [nodejs.org](https://nodejs.org) (chọn bản LTS).

### Playwright (bắt buộc để chạy test)

Cài trong **thư mục dự án test**, không cài toàn cục:

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

```bash
cd ~/.agents/skills/playwright-automation
git pull

# Hoặc Claude Code
cd ~/.claude/skills/playwright-automation
git pull
```

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
| Codex không thấy skill | Sai vị trí hoặc chưa quét lại | Kiểm tra `~/.agents/skills/playwright-automation/SKILL.md`, mở `/skills`, rồi khởi động lại nếu cần |
| Agent không tự dùng skill | Yêu cầu quá chung chung | Gọi `$playwright-automation` trong Codex, hoặc nhắc rõ "Playwright", "reproduce bug", "verify bug fix" |
| Claude không dùng skill dù đã cài | Chưa khởi động lại Claude Code, hoặc skill chưa được bật | Khởi động lại; kiểm tra công tắc trong Settings |
| Cấu trúc thư mục sai | Clone tạo thêm một tầng lồng nhau | `SKILL.md` phải nằm ngay trong `playwright-automation/`, không phải `playwright-automation/playwright-automation/` |
| `Executable doesn't exist at ...` | Chưa tải trình duyệt | `npx playwright install --with-deps chromium` |
| `Host system is missing dependencies` | Thiếu thư viện hệ thống (Linux) | `npx playwright install-deps`, hoặc dùng Docker image chính thức |
| `Thiếu thư viện openpyxl` | Chưa cài gói Python | `pip install openpyxl` |
| `Không tìm thấy Playwright` khi chạy `explore.mjs` | Playwright cài ở dự án, script chạy từ thư mục khác | Chạy script **từ trong thư mục dự án** có `node_modules` |
| Script Python in ra ký tự lạ trên Windows | Console dùng bảng mã cp1252 | Script đã tự ép UTF-8; nếu vẫn lỗi, chạy `chcp 65001` trước |
| Upload `.skill` báo lỗi định dạng | `SKILL.md` không nằm ở gốc file zip | Nén **nội dung bên trong** thư mục, không nén cả thư mục |

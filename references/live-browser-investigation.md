# Điều tra trực tiếp trên trình duyệt (bước EXPLORE)

Mục lục: [Khi nào dùng](#khi-nào-dùng) · [Chọn trình duyệt](#chọn-trình-duyệt-xác-minh-trước-đừng-tin-tên-công-cụ) · [Năng lực cần có](#năng-lực-cần-có) · [Vòng điều tra](#vòng-điều-tra-chuẩn) · [Lấy element](#lấy-element-không-đoán-selector) · [Đọc bằng chứng](#đọc-bằng-chứng) · [Gọi API bằng session](#gọi-api-bằng-session-đang-mở) · [Giới hạn](#giới-hạn-phải-nói-ra) · [An toàn](#luật-an-toàn) · [Bàn giao cho GENERATE](#bàn-giao-cho-generate-chuyển-cái-gì) · [Mẫu báo cáo](#mẫu-báo-cáo-explore)

## Khi nào dùng

File này là **bước EXPLORE** của pipeline bắt buộc trong `SKILL.md`, và là công cụ chẩn đoán của **bước HEAL**. Mọi lượt kiểm thử đều phải đi qua đây — cấm lập plan hoặc sinh spec khi chưa mở app thật.

Dùng để:

- Trả lời ngay "trang này đang lỗi gì", "console báo gì", "API nào fail" — báo **kết luận sơ bộ** cho người dùng luôn, đừng bắt họ chờ hết pipeline.
- Lấy route, label, `role + name`, endpoint + status **thật** để bước GENERATE không phải đoán selector.
- Đi lại đúng các bước tester mô tả khi tái hiện bug.
- Chẩn đoán ở bước HEAL: test đỏ thì mở lại app, đi tới bước đang fail, đọc DOM hiện tại rồi mới sửa.

**Điểm mấu chốt**: EXPLORE cho ra *kết luận sơ bộ*, không phải verdict. **Dừng ở đây là chưa xong** — PLAN, CONFIRM, GENERATE, EXECUTE và VERDICT vẫn còn phía sau. Danh sách những gì bắt buộc phải chốt lại trước khi đóng trình duyệt nằm ở [Bàn giao cho GENERATE](#bàn-giao-cho-generate-chuyển-cái-gì).

Có kịch bản thao tác tay không kiểm được (cadence dưới ~500 ms, tỷ lệ `x/y`, cookie HttpOnly, mock, hai actor song song) — xem [Giới hạn](#giới-hạn-phải-nói-ra). Chúng không bị loại khỏi phạm vi; chúng chỉ chuyển oracle xuống bước EXECUTE bằng spec.

## Chọn trình duyệt: xác minh trước, đừng tin tên công cụ

Nhiều host có **hai** bộ công cụ browser trở lên. Ưu tiên bộ nào mang **profile thật của người dùng** — nó có sẵn phiên đăng nhập, ngoại lệ cert, proxy/VPN và DNS nội bộ, nên vào được staging/UAT mà bộ cô lập bị chặn; và nó đúng là thứ tester nhìn thấy lúc báo bug.

**Nhưng tên công cụ KHÔNG cho biết nó điều khiển cái gì.** Một bộ công cụ tên có chữ "chrome" hoàn toàn có thể đang lái một Chromium tự động hoá chạy headless với profile tạm. Ca thật gặp phải:

```
C:\...\ms-playwright\chromium-1234\chrome-win64\chrome.exe
  --user-data-dir=C:\...\Temp\playwright_chromiumdev_profile-JQYkv5
  --ignore-certificate-errors
```

Tất cả tiến trình đều có `MainWindowHandle = 0` → không có cửa sổ nào. Người dùng hỏi "sao tôi không thấy trình duyệt hiển thị" mới lộ ra. Hệ quả: không có session nào của họ, và nó vào được site cert hỏng **nhờ cờ dòng lệnh** chứ không phải nhờ ngoại lệ đã lưu.

### Xác minh trước khi kết luận đang lái cái gì

```bash
# Windows
powershell -c "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Select-Object ProcessId, CommandLine | Format-List"
powershell -c "Get-Process chrome | Select-Object Id, MainWindowHandle, MainWindowTitle"

# macOS / Linux
ps -eo pid,command | grep -i 'chrome\|chromium' | grep -v grep
```

Ba thứ cần đọc trong dòng lệnh:

| Dấu hiệu | Nghĩa là |
|---|---|
| Đường dẫn binary có `ms-playwright`, `puppeteer`, `.cache/chromium` | Chromium tự động hoá, **không** phải Chrome của người dùng |
| `--user-data-dir` trỏ vào `Temp`/`tmp` | Profile tạm — trắng session, mọi đăng nhập phải làm lại |
| `--ignore-certificate-errors`, `--headless`, `MainWindowHandle = 0` | Bỏ qua cert / không có cửa sổ để người dùng nhìn |

### Chọn cái nào

| | Trình duyệt profile thật | Trình duyệt tự động hoá / sandbox |
|---|---|---|
| Phiên đăng nhập | Có sẵn | Trắng |
| Cert lỗi/hết hạn | Hiện cảnh báo, người dùng bấm "Nâng cao → Tiếp tục" | Hoặc chặn thẳng (`navigation denied`), hoặc **âm thầm bỏ qua** nếu bật `--ignore-certificate-errors` |
| Proxy/VPN, DNS nội bộ | Theo cấu hình máy | Thường không có |
| Người dùng nhìn thấy | Có | Không, nếu headless |
| Rủi ro | Chạm vào phiên và dữ liệu thật | Cô lập, an toàn |

Chọn profile thật khi: cần đúng session/quyền của người dùng, cần mạng nội bộ, hoặc **người dùng muốn tự nhìn màn hình**. Chọn bộ tự động hoá khi: cần profile sạch không session (luồng người dùng mới, ép state chưa đăng nhập), chạy song song không đụng cửa sổ người dùng, hoặc không có trình duyệt thật kết nối được.

**Luôn nói rõ trong báo cáo mình đã chạy trên cái nào.** "Đăng nhập được" trên profile tạm và trên profile thật là hai kết luận khác nhau.

### Cạm bẫy cert — hai chiều, đều dẫn tới kết luận sai

- **Chiều chặn**: công cụ trả `navigation denied` cho cả server chết, DNS sai lẫn cert không hợp lệ. Đừng báo "site không truy cập được" khi chưa phân biệt.
- **Chiều bỏ qua**: bộ chạy `--ignore-certificate-errors` vào tuốt. Đừng báo "cert bình thường" — nó chỉ chứng minh cờ đang bật, không chứng minh gì về cert.

```bash
# -k bỏ qua verify cert. Ra 200 = server sống, vấn đề nằm ở cert chứ không phải site chết.
curl -sk -o /dev/null -w "%{http_code}" https://<host>/<path>; echo

# Đọc hạn thật của cert, rồi so notAfter với giờ UTC thật của máy
echo | openssl s_client -connect <host>:443 -servername <host> 2>/dev/null | openssl x509 -noout -dates
date -u
```

`curl -sk` ra 200 mà bỏ `-k` thì fail → server sống, lỗi nằm ở cert. Lúc đó dùng trình duyệt profile thật để bấm qua cảnh báo, hoặc chạy Playwright với `ignoreHTTPSErrors: true`; đồng thời báo người dùng cert hết hạn kèm ngày `notAfter` đọc được. Đừng đổ cho đồng hồ máy khi chưa đối chiếu `date -u` — timezone lệch **không** ảnh hưởng validate TLS, vì cert so theo UTC tuyệt đối.

**Thao tác trên profile thật là chạm vào phiên thật của người dùng.** Áp dụng đầy đủ [Luật an toàn](#luật-an-toàn) bên dưới, và thêm: không đăng xuất hộ, không đóng tab người dùng đang mở dở, không xoá cookie/lịch sử của profile đó, mở tab mới thay vì chiếm tab đang có. Cần state sạch thì nói rõ và chuyển sang bộ tự động hoá, đừng dọn profile thật.

## Năng lực cần có

Tên công cụ khác nhau tuỳ môi trường (Claude Code, Codex, claude.ai, IDE). Tra danh sách công cụ đang có rồi ánh xạ theo cột "Năng lực" — đừng bám cứng vào tên.

| Năng lực | Tên thường gặp | Dùng để |
|---|---|---|
| Điều hướng | `navigate` | Mở URL, `back`/`forward` |
| Đọc cấu trúc trang | `read_page` | Cây accessibility, mỗi element có `ref` tham chiếu được |
| Tìm element theo mô tả | `find` | Lọc nhanh trong cây vừa đọc |
| Trích text | `get_page_text` | Đọc nội dung chữ đang hiển thị |
| Chuột/bàn phím/ảnh | `computer` | `left_click`, `type`, `scroll`, `screenshot`, `hover` |
| Điền form | `form_input` | Set giá trị input/select/checkbox theo `ref` |
| Chạy JS trong trang | `javascript_tool` | Soi state, gọi API bằng session hiện tại |
| Đọc console | `read_console_messages` | Lỗi JS |
| Đọc network | `read_network_requests` | URL, status, body response |
| Đổi viewport | `resize_window` | mobile / tablet / desktop, light/dark |
| Quản lý tab | `tabs_*` | Liệt kê / chuyển / đóng tab khi thao tác mở tab mới |

Có host đặt tên theo họ khác (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_take_screenshot`…). Đối chiếu theo cột "Năng lực", đừng tìm đúng chữ.

Nếu phải nạp công cụ trước khi dùng, nạp **một lượt duy nhất** cho cả bộ — nạp lẻ từng cái tốn một vòng gọi mỗi lần.

**Nếu môi trường không có công cụ browser nào**, nói rõ với người dùng trước khi làm gì tiếp, rồi chọn theo năng lực của host:

- **Host chạy được lệnh** (Claude Code, Codex, IDE): thử **khôi phục EXPLORE** trước bằng cách cắm Playwright MCP rồi nạp lại danh sách công cụ:

  ```bash
  claude mcp add playwright npx @playwright/mcp@latest
  ```

  Server này cung cấp đúng bộ năng lực trong bảng trên (`browser_navigate`, `browser_snapshot` trả cây accessibility, `browser_click`, `browser_type`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_requests`, `browser_tabs`), nên EXPLORE chạy bình thường. Cần cài Node ≥ 20 và tải browser lần đầu (`npx playwright install chromium`). Xin phép người dùng trước khi thêm MCP server vào cấu hình của họ.

  Chỉ khi không cắm được — chặn mạng, không chạy được `npx`, người dùng từ chối — mới hạ xuống `scripts/explore.mjs` trinh sát một lượt. Ghi rõ trong PLAN là chưa quan sát được trạng thái sau tương tác, và đánh dấu những scenario dựng từ dump tĩnh là rủi ro cao.
- **Host không chạy được lệnh** (ví dụ claude.ai): không trinh sát được. Báo `Blocked: không có công cụ browser và không chạy được script`, rồi (a) nhờ người dùng dán ảnh chụp / log console / log network / HTML của màn hình cần xem, hoặc (b) soạn sẵn các bước để người dùng tự thao tác và báo lại quan sát. Tuyệt đối không suy đoán hành vi app rồi báo như đã kiểm.

## Vòng điều tra chuẩn

1. **Mở đúng môi trường người dùng nói.** Staging thì vào staging, không tự đổi sang local cho tiện. Nếu đổi, phải nói rõ và nêu hệ quả lên kết luận.
2. **Đọc cây accessibility** để xác nhận đang ở đúng màn hình/state trước khi thao tác.
3. **Đi đúng các bước tester mô tả, không rút gọn.** Bug thường nằm ở đúng cái bước trông có vẻ thừa.
4. **Sau mỗi bước quan trọng**: đọc network (endpoint + status), đọc console, chụp ảnh tại observation point.
5. **Xác minh state phía server** bằng cách gọi API với chính session đang mở.
6. **Kết luận + bằng chứng**, rồi tự chốt thành regression spec theo pipeline. Không hỏi lại; chỉ bỏ codify khi người dùng đã nói rõ không muốn file.

Nguyên tắc quan sát: **đọc lại 2–3 lần khi màn hình còn đang đổi**. Một snapshot duy nhất chụp đúng lúc đang loading sẽ dẫn tới kết luận sai — đây là phiên bản thủ công của lỗi "assertion không tự chờ".

Ở chế độ này không có `networkidle` và không có assertion tự chờ, nên "đã render xong chưa" phải tự xác định bằng tín hiệu quan sát được:

| Tín hiệu | Cách kiểm |
|---|---|
| Skeleton / spinner / "Đang tải" đã biến mất | Đọc lại cây accessibility hoặc trích text |
| Nội dung thật đã thay chỗ placeholder | So text hai lần đọc liên tiếp — giống nhau là đã đứng yên |
| Request của màn hình đó đã trả về | Đọc network, tìm endpoint tương ứng + status |
| Nút hành động đã bật | Node không còn `disabled` |

Hai lần đọc liên tiếp giống nhau thì coi là đã ổn định. Nếu sau vài lần đọc vẫn đang tải, đó **là** một quan sát đáng báo (chậm/treo), không phải lý do bỏ qua bước. Tuyệt đối không kết luận "màn hình không có phần tử X" từ một lần đọc duy nhất.

## Điều hướng: khi nào gõ URL, khi nào phải bấm

Với SPA (Angular/React/Vue, mini app), **gõ URL = tải lại trang từ đầu**: store trong bộ nhớ, form đang điền dở, draft chưa lưu và bước wizard hiện tại đều mất; nhiều app còn đá về trang chủ hoặc màn hình đăng nhập vì thiếu state.

| Tình huống | Làm gì |
|---|---|
| Mở màn hình đầu tiên của lượt điều tra | Gõ URL |
| Đi tiếp trong một luồng đang dở (wizard, giỏ hàng, draft) | **Bấm đúng nút/link như người dùng**, không gõ URL để nhảy cóc |
| Bug về giữ state khi quay lại | Đi đúng đường tester mô tả: nút "Quay lại" trong app khác với nút back của trình duyệt — hai đường chạy code khác nhau và thường chỉ một đường lỗi |
| Cần chứng minh dữ liệu đã lưu thật (persistence) | Lúc này tải lại mới là đúng: gõ lại URL hoặc reload rồi kiểm tra |

Gõ URL để nhảy tới giữa luồng chính là một dạng **rút gọn bước** (xem bước 3 của Vòng điều tra). Nếu buộc phải làm vì không tới được bằng thao tác, ghi rõ trong báo cáo là đã nhảy bước — kết luận "không tái hiện được" sau một cú nhảy URL gần như vô giá trị.

## Lấy element, không đoán selector

Cây accessibility trả về node kèm `ref`:

```
textbox "Số điện thoại" [ref_3] type="tel" placeholder="Số điện thoại"
textbox "Mật khẩu"      [ref_4] type="password"
button  "Đăng nhập"     [ref_9] type="submit"
link    "Quên mật khẩu" [ref_8] href="/forgot-password"
```

`ref_N` **là element có thật đang tồn tại**, không phải phỏng đoán. Click/điền theo `ref` là xong.

Để **lái** trong phiên này thì `ref` là đủ, không cần thiết kế selector chống refactor. Nhưng phải **ghi lại `role + name`** của mọi element đã chạm vào: `ref` chết theo phiên, còn `role + name` là thứ bước GENERATE quy đổi thành `getByRole(role, { name })`. Chạm mà không ghi thì bước sau lại phải đoán.

### `ref` hết hạn sau mỗi lần DOM đổi

`ref_N` chỉ đúng với **lần đọc cây gần nhất**. Sau bất kỳ thay đổi nào của DOM — chuyển màn, mở modal/bottom-sheet, danh sách load xong, form hiện lỗi validate — số thứ tự được đánh lại: `ref_9` có thể trỏ sang phần tử khác, hoặc không còn.

Luật: **đọc lại cây ngay trước mỗi thao tác trên một màn hình/state mới.** Không tái sử dụng danh sách `ref` lấy từ màn trước, kể cả khi trông vẫn là màn hình đó.

Nó hỏng *im lặng*: click vào `ref` cũ vẫn "thành công" nhưng trúng nhầm phần tử. Đọc lại một lần cho cả loạt thao tác thì rẻ, còn sai thì không có gì báo.

Sang bước GENERATE mới quy đổi:

| Node trong cây | Locator Playwright |
|---|---|
| `button "Đăng nhập"` | `getByRole('button', { name: 'Đăng nhập' })` |
| `textbox "Số điện thoại"` | `getByRole('textbox', { name: 'Số điện thoại' })` |
| `link "Quên mật khẩu"` | `getByRole('link', { name: 'Quên mật khẩu' })` |
| `heading "Trang chủ"` | `getByRole('heading', { name: 'Trang chủ' })` |

Cẩn thận tên khớp lỏng: `{ name: 'Đăng nhập' }` sẽ trúng cả nút "Lưu thông tin đăng nhập" nếu phần tử đó cũng có `role=button`. Cây accessibility cho thấy điều này ngay — dùng `exact: true` khi cần.

## Đọc bằng chứng

| Muốn biết | Làm gì |
|---|---|
| Trang có lỗi JS không | Đọc console, lọc theo mức error |
| Request nào fail | Đọc network, tìm status 4xx/5xx |
| Response trả về gì | Đọc network theo `requestId` để lấy body |
| Có phần tử nào che nút không | `document.elementFromPoint(x, y)` |
| Giá trị thật trong input | `document.querySelector('...').value` |
| Trang đã render xong chưa | Đọc lại cây accessibility, so với lần trước |

Lỗi console từ domain bên thứ ba (analytics, ảnh CDN hết hạn cert) thường là nhiễu — nói rõ là nhiễu thay vì gộp vào kết luận.

## Bốn kiểu hỏng im lặng khi thao tác trực tiếp

Khác với spec — thao tác không được thì test đỏ ngay — thao tác trực tiếp thường "thành công" mà không làm gì cả.

**1. Overlay / modal / bottom-sheet che phần tử.** Click theo toạ độ trúng lớp phủ chứ không trúng nút, và không có lỗi nào báo. Cây accessibility còn liệt kê cả phần tử nền phía sau sheet (nhiều app không set `aria-hidden`), nên `ref` vẫn có sẵn để bấm nhầm. Trước khi kết luận "bấm nút X không ăn": chụp màn hình xem có gì đang phủ lên, hoặc chạy `document.elementFromPoint(x, y)`. Đóng overlay bằng đúng nút đóng/Escape rồi thao tác lại.

**2. Thao tác mở tab/cửa sổ mới.** Công cụ vẫn trỏ vào tab cũ, nên đọc trang sau đó thấy y hệt lúc trước. Sau mỗi cú bấm có thể mở tab mới (`target=_blank`, "Xem hoá đơn", cổng thanh toán): liệt kê tab → chuyển sang tab mới → mới đọc. Xong thì đóng tab để không lẫn state.

**3. Phần tử ngoài viewport hoặc trong danh sách ảo hoá.** Cuộn tới phần tử trước khi bấm, nhất là khi bấm bằng toạ độ. Với danh sách dài/vô hạn, dòng chưa cuộn tới thì **chưa tồn tại trong DOM**; cây accessibility cũng có thể bị cắt bớt khi trang quá dài. Vì vậy **"không thấy trong cây" chưa phải là "không có"**: cuộn, dùng chức năng tìm element theo mô tả, hoặc dùng chính ô tìm kiếm/bộ lọc của app rồi mới kết luận.

**4. Dialog gốc của trình duyệt (`alert`/`confirm`/`beforeunload`).** Nó chặn trang: sau cú bấm, mọi lời gọi công cụ có thể treo hoặc lỗi. Nếu trang "chết" ngay sau nút Xoá/Rời trang, nghi dialog trước khi nghi app hỏng — chụp màn hình xác nhận, xử lý bằng phím rồi đi tiếp; nội dung dialog cũng là bằng chứng.

Nguyên tắc chung: sau mỗi thao tác quan trọng, xác nhận **trạng thái đã thật sự đổi** (URL, tiêu đề màn hình, một request mới) trước khi đi bước tiếp. Không suy ra kết quả từ việc lời gọi công cụ trả về thành công.

## Gọi API bằng session đang mở

Đây là điểm mạnh riêng của chế độ trực tiếp: chạy `fetch` **trong trang** thì tự động mang theo cookie, header và quyền của phiên hiện tại — không phải dựng lại auth.

```js
// Kiểm tra phiên còn sống không
await (await fetch('/api/auth/session', { credentials: 'include' })).json()

// Xem endpoint trả gì với đúng quyền của user đang đăng nhập
const r = await fetch('/api/orders?page=1', { credentials: 'include' });
({ status: r.status, body: await r.json() })
```

Dùng để **đối chiếu UI với server**: giao diện có thể còn hiển thị dữ liệu cũ trong khi phiên đã chết. Kết luận dựa trên cả hai mới chắc.

## Giới hạn phải nói ra

**Cookie HttpOnly không đọc/xoá được bằng JS trong trang.** `document.cookie` không thấy nó. Hệ quả: mọi kịch bản "ép token hết hạn", "ép mất phiên", "xoá cookie đăng nhập" **không kiểm được ở bước EXPLORE** — chúng phải thành scenario trong PLAN và được kiểm ở bước EXECUTE bằng spec.

Hai đường hợp lệ, phải nêu cả hai cho người dùng chọn:

- **Đưa oracle xuống spec** (bước GENERATE, đây là ca bắt buộc): `await context.clearCookies({ name: '<tên-cookie-phiên-của-app>' })` rồi thao tác tiếp. Tên cookie lấy từ network → response `Set-Cookie` lúc đăng nhập, **không đoán theo tên thường gặp**. Filter `{ name }` cần Playwright ≥ 1.43 — bản cũ hơn bỏ qua tham số và xoá **toàn bộ** cookie, khi đó phải `context.cookies()` trước, `clearCookies()`, rồi `addCookies()` lại phần muốn giữ.
- **Chờ hết TTL thật**: đọc `Max-Age` trên `Set-Cookie` lúc đăng nhập để biết phải chờ bao lâu, rồi quay lại thao tác.

```
# Đọc Set-Cookie ở response đăng nhập của chính app đang test:
set-cookie: <access-cookie>=…;  Max-Age=<N>   → N/60 phút
set-cookie: <refresh-cookie>=…; Max-Age=<M>   → M/3600 giờ
# Không có TTL "chuẩn": mỗi hệ thống đặt khác nhau, phải đọc từ chính response, không lấy theo trí nhớ.
```

**Tuyệt đối không kết luận "không có bug" khi phần chưa kiểm được nằm ngoài tầm thao tác tay.** Đúng verdict là `Inconclusive` cho phần đó, kèm cách kiểm tiếp.

Các giới hạn khác của thao tác tay: không đo được cadence dưới ~500 ms, không chạy được ≥10 lượt có reset state, không mock/chặn response, không chạy hai actor song song, không arm listener trước hành động (download, dialog). Không giới hạn nào trong số này loại kịch bản khỏi phạm vi — chúng chỉ nói rằng oracle nằm ở spec chứ không nằm ở EXPLORE. Bảng đầy đủ ở mục **Kịch bản cần năng lực chỉ spec mới có** trong `SKILL.md`.

## Luật an toàn

Áp dụng cùng mode trong `autonomous-execution.md`: `relaxed` tự tiếp tục với thao tác an toàn trên non-production; `guarded` giữ cổng duyệt. Các ranh giới secret, production và side effect thật không đổi theo mode.

- **Không start chồng dev server.** Kiểm tra trước:
  ```bash
  # <PORT> = cổng trong URL người dùng đưa (3000, 4200, 5173, 8080… tuỳ stack)
  netstat -ano | findstr :<PORT>      # Windows
  lsof -i :<PORT>                     # macOS/Linux
  ```
  Có sẵn thì dùng cái đang chạy và nói rõ là đang dùng tiến trình có sẵn. Không có, target là local và repo có script dev rõ ràng thì `relaxed` được tự start ngầm; ghi command + PID và cuối lượt chỉ dừng đúng process do mình tạo. `guarded` hỏi trước. Start chồng vừa fail vừa có thể giết bản build người dùng đang xem.

- **Kiểm topology trước khi bàn đăng nhập.** `curl --max-time 8 <target>` từ runtime agent. Không tới được mà trình duyệt vẫn mở được target ⇒ runtime bị chặn egress: bắc cầu bằng file phiên (`--storage-state` / `--user-data-dir` của Playwright MCP), xem `SKILL.md`. Đừng bảo người dùng chạy script rồi tưởng là xong.
- **Đăng nhập bằng một lần gọi `scripts/auth-login.mjs`, không gõ tay.** Lệnh mặc định tự dùng lại hoặc gia hạn phiên, helper process tự nạp credential từ `.env`, điền form và lưu `storageState`. Agent chỉ truyền **tên biến**, không mở/in giá trị; quyền chạy helper này là explicit và không được diễn giải thành lý do từ chối login. Không hỏi mật khẩu trong hội thoại và không truyền nó qua tham số dòng lệnh — cả hai đều để lại vết. Thiếu `.env` thì đưa một hướng dẫn cho người dùng tự điền vào file rồi tiếp tục từ checkpoint.

- **Xác minh backend thật sự là gì trước khi kết luận.** Một cổng localhost có thể là mock, cũng có thể là tunnel tới môi trường thật. Đọc header response để biết:
  ```
  server: nginx/1.22.1
  via: 1.1 kong/3.9.0          → có gateway thật phía sau
  x-envoy-upstream-service-time
  ```
  Kết luận "không tái hiện được" trên mock gần như vô giá trị; trên BE thật thì có giá trị nghiệm thu. Nêu rõ mình đã chạy trên cái nào.

- **Production hoặc host chưa xác định: chỉ thao tác đọc.** Mọi hành động tạo/sửa/xoá phải được người dùng cho phép rõ ràng; `allow_hosts` không thay cho quyền ghi.

- **Thao tác trực tiếp trên staging/UAT tạo ra dữ liệu thật.** Đơn hàng, hồ sơ, yêu cầu duyệt agent tạo ra nằm lại trong hệ thống và có thể chạy tiếp vào job, báo cáo hoặc hàng chờ của người khác. Trước khi đi luồng có ghi dữ liệu:
  - dùng dữ liệu **nhận ra được là của test**: tên/ghi chú có tiền tố cố định (`AUTOTEST-…`), SĐT/email test do người dùng cấp — không dùng SĐT/email/CCCD của người thật;
  - ghi lại **mọi bản ghi đã tạo** (mã đơn, ID hồ sơ, thời điểm) và đưa vào phần bằng chứng của báo cáo, kể cả khi không dọn được;
  - trong `relaxed`, được tự tạo record có tiền tố `AUTOTEST-<run-id>`, ghi exact ID và tự dọn **đúng record do lượt này tạo**; không sửa/xoá bản ghi có sẵn;
  - **hỏi trước** khi thao tác chạm ra ngoài hệ thống: gửi OTP/SMS/email, đẩy thông báo, gọi cổng thanh toán — staging thường vẫn dùng gateway thật;
  - dọn bằng UI/API đã nằm trong scope và chỉ với exact ID đã ghi. Nếu không dọn được, nói rõ "cần DEV/DBA dọn giúp các bản ghi sau: …"; không mở rộng sang API/DB xoá diện rộng.

## Bàn giao cho GENERATE: chuyển cái gì

Bước GENERATE ăn trực tiếp từ bảng này. Mang sang những thứ **đã xác minh** ở lượt trực tiếp — không viết lại từ đầu, không đoán bù:

| Thu được ở LIVE | Dùng trong spec |
|---|---|
| URL từng màn đã đi qua | `page.goto(path)` |
| Node `role + name` | `getByRole(role, { name })` |
| Endpoint + status quan sát được | `page.waitForResponse(...)`, assertion trên status |
| Tín hiệu "đã xong" nhìn thấy trên màn hình | `await expect(...).toBeVisible()` |
| Shape response đọc từ network | assertion schema |
| Bước nào sinh ra lỗi | biên của `test.step` |
| Cây accessibility tại điểm chốt | `expect(page.locator('main')).toMatchAriaSnapshot(...)` — chốt cả cấu trúc màn hình, không chỉ một phần tử |
| Phiên đăng nhập đã mở được | `storageState` (xem `auth-and-data.md`) — khỏi login lại qua UI |
| HAR của luồng | `routeFromHAR` khi cần chạy lại ổn định/offline (xem `network-mocking.md`) |

**Ghi lại trước khi đóng trình duyệt.** Một lượt LIVE tốt tốn công đi qua login, wizard nhiều bước, feature flag — mà `ref` thì hết hạn, session thì rụng. Trước khi kết thúc, chốt lại tối thiểu: nhật ký hành trình (mỗi màn một dòng `URL — tiêu đề — đã làm gì — quan sát được gì`), cây accessibility tại các điểm chốt, và `storageState` nếu có đăng nhập. Nhật ký này vừa là bản nháp `test.step` cho spec, vừa là bản nháp test case thủ công nếu tester chưa có file test case. Đây là đầu vào bắt buộc của PLAN và GENERATE: **hai bước đó không được bắt đầu lại từ số 0 rồi đoán selector**.

Một chi tiết hay bị bỏ sót: **API trả 204 chứ không phải 200** khi login chỉ set cookie mà không có body. Quan sát ở LIVE rồi mới viết assertion thì tránh được ca fail giả kiểu chốt cứng `toBe(200)`.

## Mẫu báo cáo EXPLORE

```
Kết luận sơ bộ: <một câu trả lời thẳng câu hỏi của người dùng — chưa phải verdict>
Oracle:   <SRS §… / TC-… đã dựa vào, hoặc "chưa có acceptance criterion —
           phần dưới chỉ mô tả hành vi quan sát được, không phán đúng/sai">

Đã làm:
  1. Mở <URL> (<môi trường>, BE phía sau: <thật/mock, căn cứ>)
  2. <bước> → <quan sát>
  3. <bước> → <quan sát>

Bằng chứng:
  - Network: <METHOD path → status>, ...
  - Console: <dòng lỗi liên quan / "không có lỗi ứng dụng">
  - State: <kết quả gọi API bằng session>
  - Ảnh: <observation point>

Fact / Inference / Unknown:
  - Fact: <chỉ thứ quan sát trực tiếp được>
  - Inference: <suy luận, ghi rõ là suy luận>
  - Unknown: <chưa kiểm được + vì sao>

Chưa kiểm được: <ví dụ: ép token hết hạn — cookie HttpOnly không xoá được bằng JS>
Cách kiểm tiếp: <spec dùng context.clearCookies({ name }), hoặc chờ hết TTL đọc được từ Set-Cookie>

Lặp lại bằng tay: <các bước ngắn gọn để người dùng tự làm>

Có muốn chốt case này thành test chạy lại được không?
```

Với bug log, giữ nguyên bộ khung `Pre` / bước / `KQTT` / `KQMM` / evidence / tần suất của `references/bug-reproduction.md` — chế độ điều tra đổi, cách báo cáo bug thì không.

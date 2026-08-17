# Điều tra trực tiếp trên trình duyệt (chế độ mặc định)

Mục lục: [Khi nào dùng](#khi-nào-dùng) · [Năng lực cần có](#năng-lực-cần-có) · [Vòng điều tra](#vòng-điều-tra-chuẩn) · [Lấy element](#lấy-element-không-đoán-selector) · [Đọc bằng chứng](#đọc-bằng-chứng) · [Gọi API bằng session](#gọi-api-bằng-session-đang-mở) · [Giới hạn](#giới-hạn-phải-nói-ra) · [An toàn](#luật-an-toàn) · [Chuyển sang spec](#chuyển-sang-spec-khi-nào-và-chuyển-cái-gì) · [Mẫu báo cáo](#mẫu-báo-cáo-live)

## Khi nào dùng

Đây là chế độ **mặc định** của skill. Dùng khi người dùng muốn biết *chuyện gì đang xảy ra* — không phải khi họ muốn có một bộ test.

Hợp:

- "Xem hộ trang này đang lỗi gì", "console báo gì", "API nào fail"
- "Test giúp chức năng X xem chạy đúng không"
- Tái hiện một bug deterministic theo đúng các bước tester mô tả
- Verify nhanh sau khi DEV báo đã fix
- Kiểm tra validate form, nội dung màn hình, dữ liệu bảng, responsive

Không hợp — xem [Giới hạn](#giới-hạn-phải-nói-ra) và bảng "Thao tác tay KHÔNG làm được" trong `SKILL.md`.

**Điểm mấu chốt**: kết thúc bằng một câu trả lời có bằng chứng là **đã hoàn thành**. Không có file spec không phải là làm dở.

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

- **Host chạy được lệnh** (Claude Code, Codex, IDE): dùng `scripts/explore.mjs` trinh sát một lượt rồi sang Pha 2.
- **Host không chạy được lệnh** (ví dụ claude.ai): không trinh sát được. Báo `Blocked: không có công cụ browser và không chạy được script`, rồi (a) nhờ người dùng dán ảnh chụp / log console / log network / HTML của màn hình cần xem, hoặc (b) soạn sẵn các bước để người dùng tự thao tác và báo lại quan sát. Tuyệt đối không suy đoán hành vi app rồi báo như đã kiểm.

## Vòng điều tra chuẩn

1. **Mở đúng môi trường người dùng nói.** Staging thì vào staging, không tự đổi sang local cho tiện. Nếu đổi, phải nói rõ và nêu hệ quả lên kết luận.
2. **Đọc cây accessibility** để xác nhận đang ở đúng màn hình/state trước khi thao tác.
3. **Đi đúng các bước tester mô tả, không rút gọn.** Bug thường nằm ở đúng cái bước trông có vẻ thừa.
4. **Sau mỗi bước quan trọng**: đọc network (endpoint + status), đọc console, chụp ảnh tại observation point.
5. **Xác minh state phía server** bằng cách gọi API với chính session đang mở.
6. **Kết luận + bằng chứng**, rồi hỏi có cần chốt thành regression không.

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

Ở chế độ này **không cần locator "bền"** — phiên chỉ sống vài phút. Đừng mất công thiết kế selector chống refactor cho việc dùng một lần.

### `ref` hết hạn sau mỗi lần DOM đổi

`ref_N` chỉ đúng với **lần đọc cây gần nhất**. Sau bất kỳ thay đổi nào của DOM — chuyển màn, mở modal/bottom-sheet, danh sách load xong, form hiện lỗi validate — số thứ tự được đánh lại: `ref_9` có thể trỏ sang phần tử khác, hoặc không còn.

Luật: **đọc lại cây ngay trước mỗi thao tác trên một màn hình/state mới.** Không tái sử dụng danh sách `ref` lấy từ màn trước, kể cả khi trông vẫn là màn hình đó.

Nó hỏng *im lặng*: click vào `ref` cũ vẫn "thành công" nhưng trúng nhầm phần tử. Đọc lại một lần cho cả loạt thao tác thì rẻ, còn sai thì không có gì báo.

Khi sang Pha 2 mới quy đổi:

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

**Cookie HttpOnly không đọc/xoá được bằng JS trong trang.** `document.cookie` không thấy nó. Hệ quả: mọi kịch bản "ép token hết hạn", "ép mất phiên", "xoá cookie đăng nhập" **không làm được ở chế độ trực tiếp**.

Hai đường hợp lệ, phải nêu cả hai cho người dùng chọn:

- **Chuyển sang spec** (dấu QUYỀN của cổng CODIFY): `await context.clearCookies({ name: '<tên-cookie-phiên-của-app>' })` rồi thao tác tiếp. Tên cookie lấy từ network → response `Set-Cookie` lúc đăng nhập, **không đoán theo tên thường gặp**. Filter `{ name }` cần Playwright ≥ 1.43 — bản cũ hơn bỏ qua tham số và xoá **toàn bộ** cookie, khi đó phải `context.cookies()` trước, `clearCookies()`, rồi `addCookies()` lại phần muốn giữ.
- **Chờ hết TTL thật**: đọc `Max-Age` trên `Set-Cookie` lúc đăng nhập để biết phải chờ bao lâu, rồi quay lại thao tác.

```
# Đọc Set-Cookie ở response đăng nhập của chính app đang test:
set-cookie: <access-cookie>=…;  Max-Age=<N>   → N/60 phút
set-cookie: <refresh-cookie>=…; Max-Age=<M>   → M/3600 giờ
# Không có TTL "chuẩn": mỗi hệ thống đặt khác nhau, phải đọc từ chính response, không lấy theo trí nhớ.
```

**Tuyệt đối không kết luận "không có bug" khi phần chưa kiểm được nằm ngoài tầm thao tác tay.** Đúng verdict là `Inconclusive` cho phần đó, kèm cách kiểm tiếp.

Các giới hạn khác: không đo được cadence dưới ~500 ms, không chạy được ≥10 lượt có reset state, không mock/chặn response, không chạy hai actor song song, không arm listener trước hành động (download, dialog). Xem bảng đầy đủ trong `SKILL.md`.

## Luật an toàn

- **Không tự khởi động dev server khi cổng đã có tiến trình chạy.** Kiểm tra trước:
  ```bash
  # <PORT> = cổng trong URL người dùng đưa (3000, 4200, 5173, 8080… tuỳ stack)
  netstat -ano | findstr :<PORT>      # Windows
  lsof -i :<PORT>                     # macOS/Linux
  ```
  Có sẵn thì dùng cái đang chạy và nói rõ là đang dùng tiến trình có sẵn. Start chồng vừa fail vừa có thể giết bản build người dùng đang xem.

- **Không tự điền mật khẩu.** Username/SĐT và dữ liệu test thì điền bình thường; tới ô mật khẩu thì dừng, nhờ người dùng nhập và bấm đăng nhập, chờ họ báo xong rồi đi tiếp. Nói rõ lý do để họ không tưởng là mình bị kẹt.

- **Xác minh backend thật sự là gì trước khi kết luận.** Một cổng localhost có thể là mock, cũng có thể là tunnel tới môi trường thật. Đọc header response để biết:
  ```
  server: nginx/1.22.1
  via: 1.1 kong/3.9.0          → có gateway thật phía sau
  x-envoy-upstream-service-time
  ```
  Kết luận "không tái hiện được" trên mock gần như vô giá trị; trên BE thật thì có giá trị nghiệm thu. Nêu rõ mình đã chạy trên cái nào.

- **Production hoặc dữ liệu thật: chỉ thao tác đọc.** Mọi hành động tạo/sửa/xoá phải được người dùng cho phép rõ ràng trước, từng lần một.

- **Thao tác trực tiếp trên staging/UAT tạo ra dữ liệu thật.** Đơn hàng, hồ sơ, yêu cầu duyệt agent tạo ra nằm lại trong hệ thống và có thể chạy tiếp vào job, báo cáo hoặc hàng chờ của người khác. Trước khi đi luồng có ghi dữ liệu:
  - dùng dữ liệu **nhận ra được là của test**: tên/ghi chú có tiền tố cố định (`AUTOTEST-…`), SĐT/email test do người dùng cấp — không dùng SĐT/email/CCCD của người thật;
  - ghi lại **mọi bản ghi đã tạo** (mã đơn, ID hồ sơ, thời điểm) và đưa vào phần bằng chứng của báo cáo, kể cả khi không dọn được;
  - **hỏi trước** khi thao tác chạm ra ngoài hệ thống: gửi OTP/SMS/email, đẩy thông báo, gọi cổng thanh toán — staging thường vẫn dùng gateway thật;
  - dọn bằng chính chức năng huỷ/xoá của app nếu có; nếu không, nói rõ "cần DEV/DBA dọn giúp các bản ghi sau: …". Không tự gọi API xoá ngoài phạm vi được cho phép.

## Chuyển sang spec: khi nào và chuyển cái gì

Khi qua cổng CODIFY (xem `SKILL.md`), mang sang những thứ **đã xác minh** ở lượt trực tiếp — không viết lại từ đầu:

| Thu được ở LIVE | Dùng trong spec |
|---|---|
| URL từng màn đã đi qua | `page.goto(path)` |
| Node `role + name` | `getByRole(role, { name })` |
| Endpoint + status quan sát được | `page.waitForResponse(...)`, assertion trên status |
| Tín hiệu "đã xong" nhìn thấy trên màn hình | `await expect(...).toBeVisible()` |
| Shape response đọc từ network | assertion schema |
| Bước nào sinh ra lỗi | biên của `test.step` |

Một chi tiết hay bị bỏ sót: **API trả 204 chứ không phải 200** khi login chỉ set cookie mà không có body. Quan sát ở LIVE rồi mới viết assertion thì tránh được ca fail giả kiểu chốt cứng `toBe(200)`.

## Mẫu báo cáo LIVE

```
Kết luận: <một câu trả lời thẳng câu hỏi của người dùng>

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

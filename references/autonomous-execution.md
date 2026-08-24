# Vận hành tự chủ: `relaxed` và `guarded`

Đọc file này khi Agent được giao một target sống để explore, reproduce, generate rồi chạy test. Mục tiêu của `relaxed` là hoàn tất cả pipeline với **zero-touch sau lần cấp secret đầu tiên**, không biến tester thành người bấm nút tiếp tục cho Agent.

`relaxed` nới cổng hội thoại, không nới quyền. Nó không cho phép Agent ghi production, làm lộ secret, kích hoạt tiền/gửi ra ngoài, xoá dữ liệu không do mình tạo, bỏ qua oracle hay làm test xanh giả.

## Chọn mode

Thứ tự ưu tiên:

1. Yêu cầu hiện tại của người dùng (`relaxed`, `guarded`, "tự chạy hết", "chờ tôi duyệt từng bước").
2. `autonomy.mode` của target trong `.testagent.yaml`.
3. Mặc định theo môi trường: local/dev/QA/staging/UAT → `relaxed`; production hoặc chưa xác định → `guarded`.

Một host nằm trong `allow_hosts` chỉ có nghĩa là được kết nối tới host đó. Nó không tự biến production thành non-production và không cấp quyền mutate.

## Zero-touch loop

Trong `relaxed`, chạy liền mạch theo thứ tự dưới đây. Gửi update ngắn khi có kết quả hữu ích, nhưng update không phải câu hỏi xin phép.

Một prompt ngắn dạng `mở <non-production-login-url> và test <feature/màn hình>` đã cấp mục tiêu đầu-cuối: launch browser → ensure auth từ `.env`/secret store → explore → plan/self-approve → generate → execute/heal → report. Không dừng sau bước `navigate`, không đẩy thao tác login cho tester, và không đòi người dùng phải liệt kê lại tám bước. URL/feature trong prompt chỉ là input của lượt chạy; không biến chúng thành domain, selector hay workflow hard-code trong skill.

1. **Resolve** — đọc `.testagent.yaml`, yêu cầu/SRS/bug row, Playwright config, `package.json`, lockfile, `.env.example` và suite hiện có. Suy ra target, scope, output dir, package manager và browser. Không mở/in nội dung `.env` trong ngữ cảnh Agent.
2. **Preflight** — phân loại môi trường, kiểm cổng/process, thử target từ runtime và browser, xác minh backend thật/mock. Ghi mode và các giả định.
3. **Ensure auth** — runtime tới được target thì gọi `auth-login.mjs` một lần. Runtime bị chặn nhưng browser tới được thì dùng local `mcp-auth-bridge.mjs` gắn vào browser qua Playwright Extension. Mỗi trusted helper process được phép tự nạp secret từ `.env`, điền form nội bộ và chỉ trả trạng thái; Agent không nhận giá trị secret. Đây là đường tự động chuẩn, không phải lý do dừng hoặc từ chối login.
4. **Explore** — đi đúng journey, lấy locator từ DOM/accessibility, console/network/evidence và ghi artefact.
5. **Plan + self-approve** — ghi bảng scenario và phần ngoài phạm vi vào `test-plan.md`, đánh dấu `Approval: agent-self-approved (relaxed)`, rồi tiếp tục nếu mọi action nằm trong cột **Tự tiếp tục** ở bảng dưới.
6. **Generate** — theo convention hiện có; chưa có suite thì scaffold. Cài đúng dependency/browser còn thiếu bằng package manager/lockfile của repo, không upgrade phần không liên quan.
7. **Execute + heal** — chạy tập nhỏ nhất trước, rồi cổng ổn định; mở trace/live app khi fail, sửa tối đa `max_heal_attempts`, tự chạy lại. Quarantine flaky có tỷ lệ; không bật retry để che.
8. **Verdict + cache** — trả số liệu, phân loại app bug/script/config/data/infra, ghi target config không chứa secret, giữ auth/artefact ở đường dẫn gitignored và dừng đúng server do Agent đã start.

Không hỏi "có tiếp tục không?", "plan được chưa?", "có chạy test không?", "có lưu config không?" nếu câu trả lời không thay đổi ranh giới quyền hoặc oracle.

## Decision table

| Tự tiếp tục trong `relaxed` | Dừng và xin đúng một quyền/đầu vào |
|---|---|
| Đọc repo, config, requirement, bug log, browser state, console/network | Không có URL/build nào có thể suy ra hoặc cả runtime lẫn browser đều không tới target |
| Dùng Chromium khi không có yêu cầu browser; chọn output dir theo suite hiện có hoặc `e2e/` | Secret bắt buộc chưa nằm trong env/file bảo mật; yêu cầu tester điền **tên biến** được chỉ ra, không gửi giá trị qua chat |
| Gọi auth helper; runtime bị chặn nhưng browser tới được thì dùng local MCP bridge; dùng lại/gia hạn storage state, TOTP từ env | Bridge/extension không kết nối được sau setup, CAPTCHA, WebAuthn, SMS thật, approval trên thiết bị hoặc MFA cần người |
| Tự start script dev đã khai trong repo khi port trống; tự dừng đúng PID/process tree mình tạo | Port có process nhưng target không đáp ứng và muốn restart/kill process không do Agent tạo |
| Cài dev dependency/browser thật sự thiếu bằng package manager + lockfile hiện có | Cần đổi package manager, nâng cấp dependency diện rộng, sửa hạ tầng hoặc tác động ngoài workspace |
| Tự duyệt scenario read-only và scenario ghi non-production bằng dữ liệu riêng của lượt test | Production/host chưa xác định cần create/update/delete; ngay cả khi target có trong `allow_hosts` |
| Tạo record `AUTOTEST-<run-id>-...`, ghi ID, sửa/xoá đúng ID đó trong teardown | Xoá/sửa record có sẵn, dữ liệu người khác, huỷ đăng ký, disable account hoặc cleanup không xác định được exact ID |
| Mock/sandbox đã xác minh cho payment, email, SMS, notification | Tiền/chuyển khoản/mua hàng, email/SMS/notification thật, duyệt/phát hành hồ sơ, gateway chưa chứng minh là sandbox |
| Bổ sung ca edge/smoke nằm trong feature người dùng giao; ghi assumption vào plan | Mở rộng sang feature/hệ thống khác hoặc tăng đáng kể thời gian/chi phí ngoài scope |
| Kiểm technical invariant khi chưa có business oracle: không 5xx, schema hợp lệ, UI phản hồi; verdict business là `Inconclusive` | Acceptance criteria mâu thuẫn khiến chính expected result của ca trọng tâm không thể xác định |
| Sửa locator/setup/fixture sau khi re-observe; giữ nguyên intent assertion | Muốn đổi expected/giảm assertion mà không có requirement mới chống lưng |

Khi phải dừng, gom mọi blocker đã biết vào **một tin nhắn** gồm: việc đã tự hoàn tất, điều duy nhất cần người dùng làm/quyết định, và checkpoint Agent sẽ tiếp tục. Không hỏi password/token; yêu cầu họ đặt vào `.env` hoặc secret store.

## Cấu hình `.testagent.yaml`

```yaml
version: 1
targets:
  - name: checkout-staging
    url: https://staging.example.com
    autonomy:
      mode: relaxed                 # relaxed | guarded
      auto_start_dev_server: true   # chỉ local + port trống + script repo rõ ràng
      auto_install_dependencies: true
      max_heal_attempts: 3
    auth:
      strategy: form
      login_url: https://staging.example.com/login
      credentials_env: [TEST_USER, TEST_PASS]
      totp_env: TEST_TOTP_SECRET
      storage_state: .auth/checkout-staging.json
    scope:
      feature: checkout
    success:
      stability_runs: 3
    output_dir: e2e/tests
```

Giá trị mặc định khi không khai:

| Key | `relaxed` | `guarded` |
|---|---:|---:|
| `auto_start_dev_server` | `true` cho local | `false` |
| `auto_install_dependencies` | `true` | `false` |
| `max_heal_attempts` | `3` | `2` |
| PLAN approval | Agent tự duyệt phần an toàn | Người dùng duyệt trước phần ghi/rủi ro |
| Cleanup dữ liệu Agent tạo | Tự chạy theo exact ID | Trình trong plan |

Không ghi credential, cookie, token hoặc TOTP value vào YAML. `credentials_env`/`totp_env` chỉ chứa **tên biến**.

## Auto-login không kéo tester vào vòng lặp

Lệnh chuẩn là idempotent:

```bash
node scripts/auth-login.mjs \
  --url https://staging.example.com/login \
  --out .auth/checkout-staging.json
```

Không cần gọi `--check` rồi tự viết nhánh shell: lệnh mặc định đã kiểm phiên trước. Helper tự xử lý form một trang, username → Next → password và TOTP khi `TEST_TOTP_SECRET` có mặt. Tên biến khác thì truyền `--user-env`, `--pass-env`, `--totp-env`; không truyền giá trị. Quy tắc “Agent không đọc secret” **không cấm thực thi helper**: chính helper phải đọc giá trị trong process riêng để điền form, nhưng tuyệt đối không trả giá trị đó ra stdout/stderr.

Một lần tương tác hợp lệ là tester đặt secret còn thiếu vào `.env`/secret store. Sau đó Agent phải tự chạy lại helper/bridge và tiếp tục pipeline; đừng nhờ tester tự đăng nhập hoặc nhắc lại secret ở mỗi lượt.

Nếu runtime bị chặn nhưng browser tới được và `.env` đã có credential, dùng `scripts/mcp-auth-bridge.mjs` theo `auth-and-data.md` **trước khi** hỏi đăng nhập tay. Không suy diễn credential từ định dạng/hình dạng: email, số điện thoại, mã nhân viên, PIN sáu số hay chuỗi bất kỳ đều chỉ là opaque value. Chỉ phản hồi đăng nhập thật của app mới cho phép kết luận credential sai. Nếu cả hai không tới được thì `Blocked` là đúng, không lặp lại câu hỏi đăng nhập.

## Server, dữ liệu và cleanup

- Trước khi start local server, kiểm port. Port bận thì dùng process hiện có; không kill/restart để "thử cho sạch".
- Khi tự start, lưu command + PID/process tree, chờ URL readiness, và chỉ dừng process đó sau khi thu artefact xong.
- Mọi dữ liệu tạo ra mang `AUTOTEST-<run-id>` hoặc định danh duy nhất tương đương. Ghi exact ID ngay sau khi tạo; teardown chỉ nhận danh sách ID đó.
- Cleanup thất bại không được che. Verdict liệt kê record còn lại và lý do; không mở rộng sang API/DB xoá diện rộng.

## Không nới chất lượng test

Mode không thay đổi các invariant sau:

- locator lấy từ UI thật, ưu tiên role/label;
- không `waitForTimeout` để đồng bộ readiness;
- assertion theo requirement, không theo hành vi lỗi hiện tại;
- test độc lập, dữ liệu duy nhất, storageState dùng lại;
- cổng ổn định chạy với `retries=0`; flaky báo tỷ lệ và quarantine;
- heal bằng trace + re-observe, không hạ assertion;
- production read-only nếu chưa có quyền cụ thể.

Một lượt zero-touch có thể kết thúc `FAIL`, `Blocked` hoặc `Inconclusive`. Tự chủ nghĩa là Agent tự hoàn tất phần có thể hoàn tất và đưa ra verdict trung thực, không phải ép mọi thứ thành `PASS`.

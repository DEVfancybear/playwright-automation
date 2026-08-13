# Đọc, tái hiện và retest bug thực tế

Mục lục: [Nguyên tắc tổng quát](#nguyên-tắc-tổng-quát) · [Ngôn ngữ tester](#ngôn-ngữ-tester) · [Dạng bug log](#các-dạng-bug-log-phổ-biến) · [Chuẩn hóa một issue](#chuẩn-hóa-một-issue) · [Đọc evidence](#đọc-evidence) · [Quy trình tái hiện](#quy-trình-tái-hiện) · [Luồng dài/race](complex-flow-race-reproduction.md) · [Phân loại](#phân-loại-nguyên-nhân) · [Verify sau khi DEV fix](#verify-bug-sau-khi-dev-fix) · [Regression](#regression-sau-verify) · [Báo cáo](#mẫu-báo-cáo)

## Nguyên tắc tổng quát

Bug log do người thật viết thường tối ưu cho giao tiếp nhanh trong team, không phải cho parser: tiêu đề có thể ngắn, precondition nằm giữa steps, Actual/Expected dùng viết tắt, evidence ở file khác, status cũ mâu thuẫn với comment mới. Đọc nó như một **tập bằng chứng có lịch sử**, không như một specification hoàn chỉnh.

Giữ tài liệu này độc lập với từng dự án:

- Không đưa tên sản phẩm, module, đối tác, đội, mã field hoặc rule nghiệp vụ của một artifact vào luật chung.
- Tạo glossary tạm thời từ chính workbook/repository đang xử lý; hủy giả định đó khi đổi dự án.
- Dùng ví dụ nguồn để kiểm chứng parser và workflow, không coi từ vựng nguồn là ontology chung.
- Xác nhận stage từ tab/URL/build thật. Tên workbook hoặc lời mô tả chung không đủ chứng minh lỗi ở production.
- Không sao chép dữ liệu định danh từ artifact vào test; chỉ dùng dữ liệu synthetic, alias hoặc masked.

## Ngôn ngữ tester

Tester có thể trộn tiếng Việt, tiếng Anh, viết tắt và khẩu ngữ trong cùng một ô. Chuẩn hóa để hiểu nhưng giữ nguyên label, input và message khi chúng là oracle:

| Dấu hiệu thường gặp | Cách hiểu ban đầu |
|---|---|
| `Pre`, `Precondition` | Trạng thái bắt buộc trước bước đầu tiên |
| KQMM, KQTT | Kết quả mong muốn, kết quả thực tế/thực hiện |
| EVD | Evidence/bằng chứng |
| `>>`, `=>`, `->` | Biên giữa màn hình, action, state hoặc kết quả; phải đọc theo ngữ cảnh |
| `click`, `button`, `field`, `msg`, `inline`, `back`, `disable`, `validate` | Thuật ngữ UI giữ nguyên nếu khớp giao diện thật |
| `ko`, `k`, `đc`, `yc`, `hthi`, `tbao` | Shorthand cần normalize trong bản phân tích, không tự sửa exact UI copy |

Với từ viết tắt riêng của dự án, suy nghĩa từ header, các row lân cận, repository, tài liệu được cấp hoặc hỏi người dùng khi nó chặn tái hiện. Không ghi nghĩa suy đoán vào skill dùng chung.

## Các dạng bug log phổ biến

### Trước khi đọc row: lập inventory toàn workbook

Khi người dùng đưa một workbook nhiều tab và yêu cầu “đọc kỹ” hoặc học cách team log bug, không được chỉ đọc tab đang mở hay tab trong URL:

1. Liệt kê toàn bộ tab cùng trạng thái `visible/hidden/veryHidden` và sheet ID. UI có thể không lộ hidden sheets; khi người dùng cung cấp bản workbook export, đọc workbook metadata để kiểm tra nhưng không tự unhide hay sửa file nguồn.
2. Phân loại từng tab thành `bug-list`, `evidence`, `lookup/metadata`, `plan/report`, `empty/scratch` hoặc `unknown`.
3. Với mỗi `bug-list`, xác minh vùng dữ liệu có ý nghĩa và **dò header theo semantic label**, không theo số hàng/cột cố định. `max_row/max_column` có thể bị phình bởi style, validation, helper formula hoặc dữ liệu phụ ở xa; cột Evidence, Solution hoặc helper có thể dịch vị trí giữa các tab.
4. Với `evidence`, kiểm text anchor và **xem trực quan** ảnh/drawing nổi; export text có thể bỏ qua toàn bộ evidence.
5. Với lookup/plan/report, chỉ rút vocabulary, ownership hoặc lifecycle khi nó thực sự giải thích bug log; không biến nội dung kế hoạch thành bug.
6. Phân loại từng hàng sau header thành `complete issue`, `unnumbered issue`, `stub/draft`, `helper-only` hoặc `trailing blank`. Không đếm bug chỉ bằng ID vì ID có thể thiếu/trùng; cũng không biến dòng nhập dở thành issue hoàn chỉnh.
7. Đối chiếu dashboard/pivot với detail: tổng theo status/severity, số issue thực đọc được và dấu hiệu filter. Filter range có thể đã cũ trong khi tester append issue bên dưới, nên vẫn phải dò tiếp các core field sau range đó. Nếu dashboard nói nhiều hơn các row đang visible, ghi `filtered/partial view`; không tuyên bố đã đọc các row bị ẩn và không tự thay đổi filter trên artifact của người dùng. Nếu người dùng cung cấp bản `.xlsx`, có thể đọc cached values/row metadata ở chế độ read-only để cover hidden rows và phải nói rõ nguồn nào đã dùng.
8. Báo rõ coverage: `đã đọc X/Y tab`, tab nào chỉ metadata/report, tab nào bị filter, tab nào chưa xem ảnh. Không dùng “đã xem hết” nếu mới đọc tab đích hoặc chỉ đọc text export.

Các tab ẩn hoặc không truy cập được phải được ghi là `not inspected`, không suy rằng chúng trống. Hidden lookup có thể chứa severity/status definition, environment URL, account hoặc dữ liệu nhạy cảm: chỉ rút schema/vocabulary cần thiết ở runtime, không chép giá trị vào docs dùng chung, log hay evidence.

### Format tách cột

Ví dụ header thường gặp:

`Mã lỗi | Môi trường | Chức năng | Mô tả lỗi | Các bước thực hiện | Kết quả mong muốn | Priority | Status | Người tạo | Ngày tạo | Assign | Deadline | Comment | Ngày update | Closed date`

Đây là semantic map, không phải schema bắt buộc. Dò cả synonym tiếng Việt/Anh, header nhiều dòng, cột gộp và ô carry-forward; giữ lại cột lạ thay vì bỏ.

Ánh xạ:

- `Môi trường` có thể trộn surface + platform + product + stage; tách được gì thì tách, phần thiếu ghi `Unknown`.
- `Mô tả lỗi` là **Actual**. Phần sau marker `EVD:` là evidence reference.
- `Các bước thực hiện` thường mở bằng `Pre:` rồi đánh số action và kết thúc bằng “Quan sát hiển thị”.
- `Kết quả mong muốn` đôi khi là câu giao việc như “Fix sao cho…” hoặc “Bổ sung…”. Chuyển nó thành acceptance criterion quan sát được, nhưng giữ nguyên câu gốc.
- `Priority` dùng thang Blocker/Critical/Major/Minor/Trivial, thực tế đóng vai severity. Không tự đổi nhãn nguồn.
- Cột helper ghép kiểu `MajorClosed` chỉ phục vụ pivot; không dùng thay Priority và Status gốc.
- Dùng ngày tạo/deadline/comment/ngày update/closed date để dựng timeline. Comment retest có thể phủ định status cuối tại một thời điểm.

### Format gộp trong một ô

Ví dụ header thường gặp:

`STT | Nội dung | Các bước thực hiện | Evidence | Topic | Hệ điều hành | Mức độ nghiêm trọng | Mức độ ưu tiên | Trạng thái | Người tạo | Ngày tạo | Tester | DEV xử lý | Giải pháp xử lý | Hạn xử lý | Ghi chú`

Tên và thứ tự cột có thể khác; ánh xạ theo nội dung và kiểm tra một vài row đại diện trước khi phân tích hàng loạt.

Quy tắc đọc:

- `Nội dung` thường là `[Feature] triệu chứng`, nhưng nhiều title lặp hoặc quá chung. Luôn đọc full row.
- `Các bước thực hiện` có thể chứa cả action, `KQMM`, `KQTT`, note và test data. Nhận cả dạng đầy đủ “kết quả mong muốn/thực tế/thực hiện”.
- Nhận đường dẫn thao tác bằng `>>`, `=>`, `->` và numbering. Không giả định KQMM luôn đứng trước KQTT; trong dữ liệu thật có cả hai thứ tự.
- `Hệ điều hành` thực tế trộn channel và platform (`Mobile web`, `IOS`, `Android`, `Cả 2 app`). Không suy ra device/browser/app build.
- `Giải pháp xử lý` và `Ghi chú` là lịch sử triage: root cause, phụ thuộc, quyết định BA, deploy/retest hoặc phase sau; không phải lúc nào cũng là fix đã kiểm chứng.
- ID có thể trùng, thiếu hoặc lệch. Dedupe theo module + state + action + symptom + actual, không theo ID/title duy nhất.

## Chuẩn hóa một issue

Trước khi mở app, chuyển row thành record sau. Giữ song song `raw` và `normalized`; không làm mất ngôn ngữ nguồn.

```yaml
source:
  document: "..."
  tab: "..."
  sheet_id: "..."
  row_or_range: "..."
id: "..."
raw_title: "..."
module: "..."
symptom: "..."
environment:
  stage: development | test | staging | uat | production | Unknown
  surface: "source value or project-defined normalized value"
  platforms: []
  url: Unknown
  build: Unknown
  device_browser: Unknown
preconditions:
  - session/account state
  - existing business/data state
test_data:
  - masked value or synthetic replacement
actions:
  - ordered visible action
scenario_map: [] # dùng cho log dài/multi-screen/timing-sensitive; mỗi step giữ raw anchor
observation_points:
  - before submit / after submit / after navigation
actual: "KQTT/mô tả lỗi"
expected: "KQMM/acceptance criterion"
evidence:
  - source reference and what it visibly proves
severity: "source value"
priority: "source value"
status: "source value"
timeline: []
triage_notes: []
facts: []
inferences: []
unknowns: []
contradictions: []
```

### Cách tách dữ liệu

1. Lấy source anchor chính xác: document, tab/sheet ID, row/range và issue ID nếu có.
2. Tách `[Feature]` khỏi triệu chứng; không suy module chỉ từ prefix ID cũ.
3. Parse môi trường thành stage/surface/platform. Ghi `Unknown` cho URL, build, device, browser, account nếu không có.
4. Kéo các điều kiện nhúng trong prose ra `preconditions`: đã/chưa login, role/quyền, bản ghi mới/đã tồn tại, draft/đã submit, feature flag, config hoặc data state hiện tại.
5. Tách action theo numbering và các dấu `>>`, `=>`, `->`. Mỗi action phải là thao tác quan sát được. Với log dài, nhiều actor/page/state hoặc có từ chỉ timing/lặp, không dừng ở `actions[]`: lập scenario map và chạy completeness gate theo `complex-flow-race-reproduction.md`; mọi clause nguồn phải truy vết được hoặc ghi `Unknown`.
6. Map `Mô tả lỗi`, `KQTT`, “kết quả thực hiện/thực tế” sang `actual`; map `KQMM`, “kết quả mong muốn”, “phải…” sang `expected`.
7. Giữ exact input, error copy và UI label trong dấu nháy. Thay PII bằng alias/masked value trong artifact mới.
8. Đưa phản hồi DEV vào `triage_notes`; không trộn với sự thật đã quan sát của tester.
9. So ID/title/module/state/symptom với issue khác để phát hiện duplicate hoặc tham chiếu “tương tự bug X”.
10. Nếu text, evidence và status mâu thuẫn, giữ cả ba trong `contradictions`; không tự chọn một bản đúng.

Ví dụ mâu thuẫn cần biến thành test matrix, không đoán:

- Text nói “quá N chữ số”, screenshot lại chứa chữ cái, expected nói “N ký tự” → kiểm riêng **length** và **character class**, đồng thời yêu cầu rule chính thức nếu chưa có.
- Step yêu cầu quan sát inline validation rồi sau đó bấm Lưu, evidence còn có toast generic → kiểm cả trạng thái trước submit và outcome sau submit.
- Status `Closed` nhưng comment cùng timeline nói “vẫn chưa được fixed” → retest độc lập và báo rõ timestamp mỗi tín hiệu.

## Đọc evidence

### Evidence nằm trong spreadsheet

Marker `EVD:` có thể trỏ tới một spreadsheet khác hoặc tab evidence trong cùng document, kèm sheet ID và cell range.

1. Mở đúng document + sheet ID + range, không chỉ mở trang đầu.
2. Đọc anchor kiểu `No.17`, `No.65` rồi quan sát các hàng/vùng lân cận.
3. Chờ ảnh tải và kiểm tra trực quan. Screenshot thường là **floating image**, nên CSV/GViz có thể trả ô trống dù evidence tồn tại.
4. Đọc khung/callout đỏ, toast, label, platform và các ảnh ghép iOS/Android.
5. Ghi evidence chứng minh điều gì; đừng chỉ ghi lại URL.

### Evidence nằm ngoài sheet

`Đã gửi video lên group`, link storage không truy cập được, hoặc một label triệu chứng không có nghĩa agent đã xem bằng chứng. Ghi `Evidence unavailable/not inspected` và xin đúng attachment khi nó chặn kết luận.

### Evidence tối thiểu khi tái hiện mới

- timestamp + timezone;
- stage, URL/app build, platform/device/browser;
- account alias/role và state cần thiết, không chứa credential;
- numbered steps, exact Actual và Expected;
- screenshot/video ở observation point; console/network/trace/log khi liên quan;
- ID nghiệp vụ hoặc giao dịch đã mask nếu cần đối chiếu;
- tần suất `x/y` và platform matrix nếu lỗi không ổn định.

## Quy trình tái hiện

### 1. Readiness gate

Từ normalized record, chỉ hỏi những unknown thật sự chặn:

- URL/build/stage đích;
- tài khoản test/role hoặc seed data an toàn;
- attachment ngoài sheet cần để hiểu symptom;
- acceptance criterion khi actual/expected mâu thuẫn;
- quyền thực hiện action có side effect.

Không bắt người dùng nhắc lại module, steps hoặc expected đã có trong row.

### 2. Guardrail cho production

Mặc định chỉ làm thao tác read-only hoặc có thể hoàn tác. Không tự tạo giao dịch thật, thanh toán, gửi OTP/SMS/email, phát hành bản ghi nghiệp vụ, sửa dữ liệu/config, upload file, hay dùng tài khoản/dữ liệu người dùng production. Nếu tái hiện bắt buộc có side effect, dừng trước action đó và xin phê duyệt rõ target + dữ liệu + tác động; ưu tiên môi trường test/sandbox tương đương.

### 3. Fingerprint môi trường

Ghi stage, URL/build, platform/device/browser, locale/timezone, role, session state và dữ liệu seed. `Môi trường A pass, môi trường B fail` là tín hiệu so sánh config/data/build, không tự động là code bug.

### 4. Recon trước thao tác

Mở app thật, chờ render, xác minh visible label/DOM và state đầu vào. Với UI, lấy locator từ DOM thật theo `references/ui-e2e.md`; không dịch shorthand tester thành selector phỏng đoán.

### 5. Replay đúng state và observation point

- Thực hiện action theo thứ tự nguồn, không “tối ưu” bỏ bước có thể tạo state.
- Dùng test data tương đương nhưng synthetic/masked.
- Nếu nguồn liệt kê nhiều platform/surface, tạo execution matrix và ghi target nào đã/chưa chạy.
- Với validation, quan sát khi type/change/blur, trước submit và sau submit nếu flow nguồn đi qua các điểm đó.
- Với stateful bug, giữ đúng chuỗi nhiều phiên: tạo draft → thoát → sửa profile → quay lại đơn, hoặc mua lần hai sau giao dịch trước.
- Thu UI + network/console/API ở cùng timestamp khi symptom có thể do backend/config.

Nếu flow qua nhiều màn hình/tab/role hoặc bug phụ thuộc “ngay/nhanh/liên tục”, đọc `complex-flow-race-reproduction.md`. Giữ toàn bộ causal chain trong một test/attempt, chia `setup → critical burst → oracle`; không thêm readiness wait/assertion ở giữa burst rồi vô tình làm mất trigger.

### 6. Lặp và đối chứng

Nếu an toàn, chạy lại cùng state ít nhất một lần và ghi `x/y`; với suspected race/flaky, chọn attempt budget và cadence/instrumentation profile trước khi chạy. Reset state cho từng attempt; ở pha đo dùng một worker và không retry để denominator không bị trộn. Ghi requested/observed timing thay vì chỉ nói “đã bấm nhanh”; xem `complex-flow-race-reproduction.md`.

Sau khi replay nguyên bản, chạy **một controlled variation** nếu nó an toàn và giúp cô lập trigger: chỉ đổi một biến như platform, session state, data class, blur/submit hoặc build; giữ các biến còn lại cố định. Ghi rõ đây là đối chứng, không âm thầm thay thế case tester đã log.

### 7. Kết luận theo bằng chứng

Không dùng một tín hiệu duy nhất như status, HTTP 500 hoặc locator timeout để kết luận. Đối chiếu screenshot/trace, DOM, request/response, dữ liệu đầu vào, build/config và replay thủ công. Nếu thiếu dữ liệu, kết luận `Chưa đủ bằng chứng`, không gán nhãn chắc chắn.

## Phân loại nguyên nhân

Trước hết ghi outcome tái hiện, tách khỏi root cause:

| Reproduction outcome | Nghĩa |
|---|---|
| `Reproduced` | Quan sát được đúng symptom trên fingerprint đã ghi |
| `Not reproduced` | Đã chạy đủ steps nhưng không thấy symptom; không đồng nghĩa bug không tồn tại |
| `Intermittent` | Cùng fingerprint có cả pass/fail; bắt buộc ghi `x/y` |
| `Blocked` | Không thể đi tới observation point vì thiếu quyền/data/dependency hoặc guardrail an toàn |
| `Inconclusive` | Đã quan sát nhưng evidence/oracle còn mâu thuẫn hoặc chưa đủ để quyết định |

Giữ `Status` từ sheet nguyên văn và thêm `classification` riêng:

| Classification | Dùng khi |
|---|---|
| `product-code-defect` | Hành vi sai acceptance criterion trên đúng build/config/data |
| `environment-config-data` | Thiếu migrate/seed, config hoặc data lệch giữa các môi trường |
| `infra-or-dependency` | Storage, identity, notification, external API hoặc dịch vụ phụ thuộc gây lỗi |
| `expected-behavior` | Hành vi khớp rule đã xác nhận; vẫn ghi user impact |
| `requirement-gap` | KQMM là mong muốn mới/câu hỏi, chưa có rule chốt |
| `duplicate` | Cùng flow + state + symptom + root cause với issue khác |
| `deferred-or-out-of-scope` | Chưa bàn giao/chưa phát triển/đẩy phase sau |
| `automation-or-test-data` | Locator/wait/data/setup của test sai, app không tái hiện symptom |
| `intermittent` | Có bằng chứng pass/fail trên cùng fingerprint, ghi tỷ lệ |
| `insufficient-evidence` | Thiếu attachment, build, state hoặc acceptance criterion |

`Notbug` có thể bao gồm config/data, chức năng chưa làm, dependency, expected behavior, duplicate hoặc deferred. Vì vậy **Notbug không đồng nghĩa không có vấn đề**. Luôn thêm reason code, impact và owner/follow-up.

Không hard-code lifecycle. `Resolved` có thể là đã xử lý/chờ verify và `Closed` có thể là terminal, nhưng sheet không định nghĩa chính thức. Dựng timeline từ status + comment + solution + dates, rồi retest.

Severity và priority là hai trục riêng. Giữ giá trị nguồn; nếu thiếu/sai cột, ghi data-quality issue và chỉ đề xuất mức mới kèm lý do, không âm thầm sửa.

## Verify bug sau khi DEV fix

Fix verification là một cuộc kiểm thử có hai mốc độc lập:

1. **Baseline reproduction** — chính agent chạy và chứng minh đúng symptom tester mô tả đã xảy ra trên fingerprint gốc, rồi lưu steps + evidence làm oracle trước khi DEV sửa.
2. **Fixed-build verification** — chạy lại cùng trigger trên deployment chứa bản sửa, chứng minh symptom biến mất **và** KQMM thật sự đạt.

Không được rút gọn thành “mở bản mới, không thấy lỗi, Close”. Evidence lịch sử giúp agent hiểu case nhưng không thay thế lượt tái hiện baseline trong workflow này. Nếu chính agent chưa tái hiện được bug gốc, verdict tối đa là `Not reproduced on target build`, `Blocked` hoặc `Inconclusive`, không phải `Verified fixed`.

### 1. Verification readiness gate

Trước khi chạy, phải có hoặc ghi `Unknown` cho từng mục:

- source issue truy vết được: ID + document/tab/row;
- raw steps, KQTT, KQMM và evidence gốc;
- baseline do agent đã chạy: `Reproduced x/y`, stage, build, platform/device/browser, role/session, data class, config/feature state và evidence;
- target deployment chứa fix: stage + build/release/commit hoặc deploy timestamp có thể đối chiếu;
- fix scope/root-cause note nếu DEV cung cấp; đây là thông tin định hướng regression, không thay cho quan sát;
- test account/data synthetic và quyền thực hiện side effect;
- dependency/config/data seed cần thiết để tới đúng observation point.

Nếu ticket chỉ ghi “fixed” nhưng không xác định được build đã deploy, dừng ở `Blocked: fix build not identifiable`. Không verify nhầm build rồi kết luận cho DEV.

Các comment như “test done”, “confirmed fixed”, “không tái hiện” hoặc status `Closed/Resolved` là tín hiệu lịch sử, không phải bằng chứng verify của agent. Dùng chúng để dựng timeline và chọn case, nhưng vẫn chạy lại baseline/target theo gate bên dưới.

### 2. Thiết lập baseline

Thực hiện theo thứ tự:

1. Tái hiện trực tiếp trên build/env gốc còn khả dụng, thu evidence mới và tỷ lệ `x/y`.
2. Nếu không tái hiện được, cô lập từng blocker: sai build, thiếu data/state/role, dependency, evidence không truy cập được, oracle mâu thuẫn hoặc action bị chặn vì an toàn production.
3. Thử lại sau khi bổ sung đúng điều kiện. Nếu vẫn không thấy symptom, báo `Not reproduced`; nếu không thể tới observation point, báo `Blocked`; nếu oracle/evidence chưa đủ, báo `Inconclusive`.
4. Nếu build gốc đã bị thay thế trước khi agent kịp chạy, evidence lịch sử chỉ dùng để dựng case và ghi rủi ro. Không nâng kết quả sau fix thành `Verified fixed`.

Baseline phải khớp **bug tester mô tả**, không phải một lỗi khác xuất hiện giữa đường. Nếu flow bị chặn bởi lỗi khác, outcome là `Blocked` và ghi blocker riêng.

Trước khi DEV sửa, agent phải bàn giao một reproduction package gồm normalized issue, fingerprint, exact steps, `KQTT`, `KQMM`, tần suất, evidence, console/network/log liên quan và phạm vi chưa chạy. Đây là baseline bắt buộc để lượt verify sau dùng lại đúng case, không diễn giải lại ticket theo trí nhớ.

### 3. Chạy fixed-build verification

1. Xác nhận target build/deployment ngay trước khi chạy và ghi timestamp.
2. Khôi phục cùng precondition, role/session, data class và platform của baseline. Dùng dữ liệu mới tương đương khi cần tránh state bẩn.
3. Replay nguyên vẹn steps gốc tới đúng observation point; không bỏ bước “có vẻ thừa” vì nó có thể tạo trigger.
4. Xác nhận **negative assertion**: KQTT/symptom cũ không còn xảy ra.
5. Xác nhận **positive assertion**: KQMM xảy ra đúng về nội dung, trạng thái, điều hướng, validation, dữ liệu hoặc side effect. Chỉ “không crash/không hiện lỗi” là chưa đủ.
6. Nếu hành vi phải lưu dữ liệu, kiểm persistence/read-back bằng refresh, reopen, relogin, API/back-office hoặc nguồn dữ liệu quan sát được phù hợp. Không truy cập DB production nếu chưa được cấp quyền rõ ràng.
7. Chạy lại ít nhất hai lần với lỗi deterministic. Với lỗi intermittent, dùng số lần đủ để so tỷ lệ trước/sau và luôn báo `x/y`; một lần pass không chứng minh đã fix.
8. Chạy targeted regression theo fix scope/root cause và ít nhất một controlled variation an toàn. Chỉ đổi một biến mỗi lần.
9. Thu evidence sau fix ở cùng observation point với baseline; kèm trace/network/console/log khi liên quan.

### 4. Verdict độc lập với status ticket

| Verification verdict | Điều kiện tối thiểu |
|---|---|
| `Verified fixed` | Baseline do agent đã `Reproduced`; đúng target build; symptom cũ không còn; KQMM đạt; persistence/side effect liên quan đúng; targeted regression không phát hiện lỗi |
| `Failed verification` | Đúng symptom gốc vẫn tái hiện trên target build; ghi `x/y` và evidence |
| `Partial fix` | Chỉ một phần platform/path/data class đạt, phần còn lại vẫn lỗi; không đề xuất Close |
| `Regression introduced` | Bug gốc hết nhưng bản sửa tạo hành vi sai mới; liên kết evidence và phạm vi ảnh hưởng |
| `Not reproduced on target build` | Không thấy symptom nhưng baseline hoặc số lần chạy chưa đủ để chứng minh fix |
| `Blocked` | Không tới được observation point hoặc không xác định được target build/data/dependency |
| `Inconclusive` | Evidence/oracle mâu thuẫn, kết quả không ổn định hoặc không đủ căn cứ quyết định |

Giữ ba trường riêng:

- `source_status`: giá trị đang có trong sheet/tracker;
- `verification_verdict`: kết quả agent vừa quan sát;
- `status_recommendation`: ví dụ `Close`, `Reopen`, `Remain Resolved`, `Need clarification` theo workflow dự án.

Agent không tự sửa status, comment hay dữ liệu tracker trừ khi người dùng yêu cầu rõ và hành động đó nằm trong quyền được cấp. Không hard-code rằng `Resolved → Closed` hoặc `Closed → Reopen`; mỗi dự án có workflow khác nhau.

### 5. Ma trận verify bắt buộc

| Target | Fingerprint | Attempts | Symptom gốc | KQMM | Persistence/side effect | Regression gần | Evidence | Verdict |
|---|---|---:|---|---|---|---|---|---|
| baseline | env/build/platform/state | x/y | có/không | n/a | n/a | n/a | link/trace | reproduction outcome |
| fixed build | env/build/platform/state | x/y | còn/hết | đạt/không đạt | đạt/không chạy | pass/fail/not run | link/trace | verification verdict |

Không ghi `Pass` cho platform, role, data class hoặc breakpoint chưa chạy; ghi `Not run` và lý do.

### 6. Oracle theo loại bug

- **Validation:** kiểm trigger timing (`change/blur/submit`), exact inline copy + vị trí, dữ liệu sai không được submit, dữ liệu hợp lệ vẫn submit được và không có toast generic ngoài dự kiến.
- **Visual/responsive:** chạy đúng device/OS/browser/viewport gốc, rồi breakpoint lân cận; kiểm overlap, clipping, hidden control, scroll và orientation nếu liên quan.
- **State/session:** lặp đúng chuỗi tạo/sửa/quay lại/back/refresh/relogin; kiểm state không reset, stale hoặc duplicate.
- **API/data/config:** kiểm request/response, trạng thái UI, persistence/read-back và parity build/config; HTTP 2xx một mình không chứng minh nghiệp vụ đúng.
- **Async/race/intermittent:** giữ cùng fingerprint + cadence + instrumentation profile, đo tỷ lệ trước/sau và ghi timing/network; không tuyên bố fixed sau một lần pass. Nếu trace/video làm tỷ lệ thay đổi, báo riêng từng profile và ghi đây là suspected observer effect, không gộp denominator.
- **Permission/role:** verify đúng role gốc và thêm role đối chứng; không dùng tài khoản quyền cao để vô tình bỏ qua bug.

## Regression sau verify

Sau replay chính, chọn regression gần theo root cause thay vì chạy ngẫu nhiên:

- session persistence khi back/chuyển menu/lọc dữ liệu;
- state retention khi revisit, lặp flow, tiếp tục draft hoặc sửa source data sau khi tạo bản ghi;
- data propagation từ UI qua transaction tới back-office;
- boundary ngày/tuổi/thời hạn và timezone;
- validation length + character class + exact inline copy + dữ liệu hợp lệ;
- responsive/overlay trên các platform và viewport thuộc fix scope;
- config parity giữa các môi trường, dependency healthy/unhealthy khi phù hợp.

Chỉ codify regression sau khi có bước và oracle đủ rõ. Đặt tên theo bug ID + symptom; nếu ID trùng/thiếu, thêm source row/module. Dùng visible locator thật, giữ `Actual` làm message chẩn đoán và `Expected` làm assertion.

Không chạy `scripts/excel_to_spec.py` trực tiếp trên bug list. Script đó dành cho test case có expected rõ và hiện không bảo toàn đầy đủ Actual, Status, Evidence, Solution hay timeline của issue.

## Mẫu báo cáo

Giữ giọng ngắn gọn của tester nhưng bổ sung metadata còn thiếu:

```text
[Feature] Triệu chứng quan sát được

Mã/nguồn: <bug id> — <document/tab/row>
Môi trường: <stage> | <surface> | <platform/device/browser> | build <...>
Pre:
- <session/account/business state>
Test data: <synthetic hoặc masked>

Các bước thực hiện:
1. <visible action>
2. <visible action>
3. <observation point>

KQTT:
- <hành vi/message/value thực tế, exact copy khi cần>

KQMM:
- <acceptance criterion quan sát được>

Tần suất: <x/y> — <platform matrix>
EVD: <screenshot/video/trace/network/log và điều nó chứng minh>
Phân loại: <classification + reason>
Status nguồn / retest: <giữ riêng hai giá trị>
Unknown/Need clarification: <chỉ phần còn thiếu>
```

Mẫu fix-verification — không gộp kết quả này với status nguồn:

```text
[Bug ID] Fix verification — <triệu chứng>

Nguồn: <document/tab/row> | Source status: <...>
Baseline: <env/build/platform/state> | Reproduction: <Reproduced x/y hoặc evidence lịch sử>
Target fix: <env/build/release/deploy timestamp>

Replay steps: <same as original / liệt kê khác biệt có lý do>
KQTT sau fix: <symptom cũ còn/hết + điều quan sát được>
KQMM sau fix: <đạt/không đạt từng oracle>
Persistence/side effect: <pass/fail/not run>
Targeted regression: <scope + pass/fail/not run>
EVD: <before/after screenshot, video, trace, network/log>
Attempts: <x/y cho từng target/platform>

Verification verdict: <Verified fixed | Failed verification | Partial fix |
  Regression introduced | Not reproduced on target build | Blocked | Inconclusive>
Status recommendation: <theo workflow dự án, không tự mutate tracker>
Remaining risk/Not run: <...>
```

Ví dụ normalize an toàn:

```text
[Biểu mẫu] Reset ngày đã chọn khi bật tùy chọn bổ sung
Pre: Đang ở biểu mẫu; đã chọn ngày khác mặc định.
1. Chọn ngày hiệu lực.
2. Chọn quyền lợi bổ sung.
KQTT: Ngày hiệu lực reset về mặc định.
KQMM: Giữ nguyên ngày đã chọn.
```

Trong báo cáo cuối, phân biệt rõ `Reproduced`, `Not reproduced`, `Intermittent`, `Blocked` và `Not run`. Không dùng `Pass/Fail` cho platform chưa chạy.

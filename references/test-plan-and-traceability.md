# Kế hoạch test, truy vết và verdict

File này là bước **PLAN** (và mẫu verdict của bước **VERDICT**) trong pipeline bắt buộc ở `SKILL.md`. Mọi lượt kiểm thử đều đi qua đây — kể cả yêu cầu nhỏ nhất, khi đó plan chỉ có một scenario chốt lại đúng điều vừa quan sát ở EXPLORE.

Đầu vào: nguồn grounding thu ở bước FRAME + quan sát thật thu ở bước EXPLORE. Đầu ra: một bảng scenario có decision record ở bước CONFIRM — Agent tự duyệt phần an toàn trong `relaxed`, người dùng duyệt khi `guarded` hoặc chạm ranh giới quyền.

## Thứ tự tin cậy của nguồn

Khi nhiều nguồn cùng nói về một hành vi, chúng **không ngang nhau**. Nạp theo thứ tự này và nói rõ mình đang dựa vào hạng nào:

| Hạng | Nguồn | Vai trò |
|---|---|---|
| 1 | SRS / requirement / acceptance criteria | **Điều gì phải đúng** — oracle cao nhất |
| 2 | Test case thủ công (Excel UAT, KQMM) | Oracle do người viết: đã chốt cách kiểm và kết quả mong đợi |
| 3 | Quy tắc nghiệp vụ, tài liệu domain | Giải thích *vì sao*; phân xử khi hạng 1–2 không nói tới |
| 4 | Source code | App **đang** làm gì — không phải nó **nên** làm gì |
| 5 | Quan sát app đang chạy (lượt LIVE) | Route, label, locator, shape response — dùng để *thao tác*, không dùng để *phán đúng sai* |

Ba luật đi kèm:

- **App đang chạy không phải oracle.** "Bấm ra như vậy" không chứng minh "như vậy là đúng". Không có nguồn hạng 1–3 thì ghi `Unknown — chưa có acceptance criterion`; vẫn tự kiểm technical invariant (không 5xx, UI phản hồi, schema hợp lệ) và kết luận phần nghiệp vụ là `Inconclusive`. Chỉ hỏi khi expected bị thiếu/mâu thuẫn làm chính ca trọng tâm không thể định nghĩa; đừng lấy hành vi hiện tại làm chuẩn rồi đóng băng nó thành assertion.
- **Ý định lệch hiện thực thì báo, đừng lặng lẽ viết theo code.** Requirement nói `tổng = tiền hàng + thuế` mà màn hình trả lệch 1 đồng: đó là một finding, không phải con số để chép vào `expect`. Viết assertion theo requirement, để test đỏ, rồi báo — đó mới là test có giá trị.
- **Nguồn hạng thấp không phủ quyết nguồn hạng cao.** Đọc code thấy nhánh cho qua khi mã bưu chính rỗng, trong khi test case nói phải chặn: kết luận là *code sai*, không phải *test case cũ*.

Khi báo cáo, ghi luôn mình đã nạp gì: `Grounding: SRS §4.2, TC-ORD-01..07, không có tài liệu domain`. Nếu không có nguồn nào cả, nói thẳng `exploration-only` — người đọc cần biết kế hoạch này dựng từ quan sát chứ không từ yêu cầu.

## Kế hoạch có tầng

Xếp scenario theo năm tầng, chạy theo đúng thứ tự này:

| Tầng | Chứa gì | Hỏng thì sao |
|---|---|---|
| `setup` | Đăng nhập, seed data, chọn chi nhánh/kỳ, bật feature flag | Mọi tầng sau vô nghĩa — dừng sớm |
| `smoke` | Vài ca p0 chứng minh app còn sống và luồng chính mở được | Không cần chạy tiếp phần còn lại |
| `core` | Luồng nghiệp vụ chính, happy path có dữ liệu thật | Đây là phần người dùng quan tâm nhất |
| `edge` | Validate, giá trị biên, quyền, ca âm | Thường là chỗ bug thật nằm |
| `teardown` | Dọn dữ liệu agent tạo ra, trả state về ban đầu | Bỏ qua thì lần chạy sau bẩn |

Không tầng nào bắt buộc phải có. Nhưng nếu bỏ `teardown` thì phải nói rõ ai dọn.

Mỗi scenario ghi đủ sáu trường:

| Trường | Ví dụ | Vì sao cần |
|---|---|---|
| `id` | `checkout-no-postal` | Đặt tên file spec, tra cứu trong report |
| Tiêu đề | Thiếu mã bưu chính bị chặn ở bước 1 | Tester đọc là hiểu ngay |
| Tầng | `edge` | Quyết định thứ tự chạy và mức độ ưu tiên khi cắt |
| Layer | `ui` / `api` | Cùng một quy tắc có thể kiểm ở tầng rẻ hơn |
| Ưu tiên | `p0` / `p1` / `p2` | Khi hết thời gian thì cắt từ dưới lên |
| Truy vết | `TC-ORD-07`, `SRS §4.2` | Không truy vết được thì không chứng minh được độ phủ |

Thêm `Phụ thuộc` khi scenario cần scenario khác chạy trước (`checkout-happy` cần `auth-login`).

## Bảng plan và decision record

Lập và ghi bảng này **trước khi gõ dòng code đầu tiên**. Tester vẫn có thể sửa scope bất đồng bộ; `relaxed` không chờ một lượt gật đầu nếu plan chỉ gồm action an toàn trên non-production.

```
Kế hoạch test — <target>   (<N> scenario, grounding: <nguồn đã nạp>)
Mode: relaxed
Approval: agent-self-approved (relaxed) at <timestamp>

TẦNG     ID                    LAYER  ƯU TIÊN  TRUY VẾT            TIÊU ĐỀ
-------------------------------------------------------------------------------
setup    auth-login            ui     p0       TC-LOGIN-01         Đăng nhập tài khoản hợp lệ
smoke    cart-badge            ui     p0       TC-ORD-03           Badge giỏ hàng đếm đúng số món
core     checkout-happy        ui     p0       SRS §4.2, TC-ORD-01 Đặt hàng thành công tới màn xác nhận
core     checkout-total        ui     p0       SRS §4.4            Tổng = tiền hàng + thuế
edge     checkout-no-postal    ui     p1       TC-ORD-07           Thiếu mã bưu chính bị chặn
teardown cleanup-orders        api    p2       —                   Xoá đơn agent tạo ra

Ngoài phạm vi (cố tình không cover):
  - Thanh toán thật qua cổng — sẽ mock, không bấm tiền thật
  - Gửi OTP qua SMS — không kiểm được tự động, cần tester làm tay
  - Luồng hoàn tiền — chưa có acceptance criterion
```

Trong `relaxed`, luôn ghi bảng vào `.testagent/<target>/test-plan.md`, kể cả plan ngắn, vì file là audit trail cho việc tự duyệt. In tóm tắt rồi sang GENERATE. Trong `guarded`, thay dòng approval bằng `user-approved` kèm phạm vi/action được duyệt và chỉ đi tiếp sau khi nhận quyền. CI/non-interactive đánh dấu phần vượt ranh giới là `Blocked`, không treo chờ input. Decision table: `autonomous-execution.md`.

## "Ngoài phạm vi" là phần bắt buộc

Phần dễ bị bỏ nhất và gây hại nhất. Một báo cáo chỉ liệt kê cái đã kiểm sẽ bị đọc thành *"những thứ khác đều ổn"*.

Bắt buộc viết ra, kèm lý do, ba nhóm:

- **Không kiểm được tự động**: OTP qua SMS thật, captcha, ký số bằng USB token, thanh toán thật.
- **Cố tình bỏ để giữ phạm vi**: "chỉ test luồng đặt hàng, không đụng tới quản lý kho".
- **Bị chặn**: thiếu tài khoản role admin, thiếu data seed, guardrail production.

Nhóm thứ ba khác hai nhóm đầu ở chỗ nó **có thể mở lại** — luôn kèm "cần gì để làm được".

## Ma trận truy vết

Hai chiều, phục vụ hai câu hỏi khác nhau.

**Chiều xuôi — "yêu cầu này đã được test chưa?"**

| Yêu cầu / TC | Scenario | Spec | Trạng thái |
|---|---|---|---|
| SRS §4.2 | `checkout-happy` | `tests/ui/checkout-happy.spec.ts` | pass |
| SRS §4.4 | `checkout-total` | `tests/ui/checkout-total.spec.ts` | fail — lệch 1đ |
| TC-ORD-07 | `checkout-no-postal` | `tests/ui/checkout-no-postal.spec.ts` | pass |
| SRS §4.5 | — | — | **chưa cover** |

**Chiều ngược — "test này đang bảo vệ điều gì?"** Đưa mã TC vào tên test:

```typescript
test('TC-ORD-07: thiếu mã bưu chính bị chặn ở bước 1', async ({ page }) => { /* … */ });
```

Spec không truy vết được về nguồn nào là ứng viên số một để xoá: không ai biết nó bảo vệ cái gì, nên khi nó đỏ sẽ không ai dám sửa cho đúng.

Với đầu vào là file Excel, `scripts/excel_to_spec.py` đã sinh sẵn `test-map.json` làm chiều xuôi — xem `references/excel-to-spec.md`.

## Một scenario, một spec

Đừng dồn nhiều scenario vào một file lớn. Lý do thực dụng:

- Mỗi lần sinh code dài dễ bị cắt giữa chừng; file to là file dễ hỏng nhất.
- Fail một ca thì chỉ chạy lại một file, không chạy lại cả cụm.
- Test flaky tách ra `@quarantine` được từng ca một, không phải bỏ cả file.
- Report hiện đúng một dòng cho một ca test case của tester.

Helper dùng chung thì đưa vào Page Object; đừng chia sẻ *state* giữa các spec.

## Definition of done cho một lượt chạy bộ test

Một bộ test coi là **PASS** khi đủ cả bốn:

1. Số scenario được nhận ≥ số tối thiểu đã thoả thuận (đừng để "1 test pass" được báo là xanh).
2. Không còn ca fail sau khi đã sửa xong.
3. Không ca nào được nhận mà còn flaky — flaky bị tách riêng, không tính vào xanh.
4. Mọi lần sửa test đều giữ nguyên ý định assertion (không hạ chuẩn để cho xanh).

Mẫu verdict:

```
Verdict: FAIL

  Scenario lập kế hoạch : 6
  Nhận vào suite        : 4
  Fail                  : 1  (checkout-total — tổng lệch 1đ, nghi bug làm tròn phía BE)
  Tách vì flaky         : 1  (cart-badge — 7/10 lượt pass, badge cập nhật chậm sau khi thêm món)
  Đã sửa test           : 2  (đổi locator sau khi app đổi label; không đổi assertion nào)

  Lý do FAIL: còn 1 ca fail và ca đó truy vết về SRS §4.4 (p0).
  Ngoài phạm vi: thanh toán thật, OTP SMS, luồng hoàn tiền (chưa có AC).
```

Con số quan trọng hơn tính từ. "Hầu hết đều chạy tốt" không phải verdict.

Dùng bộ test này làm cổng CI thì cổng phải khớp định nghĩa trên: exit khác 0 khi có ca fail hoặc số ca nhận tụt dưới ngưỡng — xem `references/reporting-ci.md`.

## Sai lầm thường gặp

| Sai lầm | Hậu quả |
|---|---|
| Lấy hành vi hiện tại của app làm expected | Đóng băng bug thành "chuẩn"; sau này sửa bug thì test đỏ và bị đổ cho DEV |
| Viết plan sau khi đã viết code | Plan thành bản mô tả code, mất tác dụng rà soát |
| Bỏ phần "ngoài phạm vi" | Người đọc hiểu nhầm là đã kiểm hết |
| Scenario không có truy vết | Không trả lời được "yêu cầu X đã test chưa" |
| Toàn `p0` | Không cắt được khi hết thời gian |
| Đếm số spec thay vì số yêu cầu được phủ | 30 test cùng kiểm một màn hình vẫn là phủ mỏng |

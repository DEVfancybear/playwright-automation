# Chuyển file test case Excel thành script

> Đây là biến thể của bước **PLAN**: Excel thay agent làm phần lập kế hoạch, vì nó đã chứa sẵn scenario, tiền điều kiện, dữ liệu và kết quả mong đợi. Các bước còn lại của pipeline giữ nguyên.

> **Chỉ dùng cho test case/UAT có steps và expected rõ. Không dùng trực tiếp cho bug list/issue tracker** có các cột Actual/KQTT, Status, Evidence, Solution/Comment hoặc timeline. `scripts/excel_to_spec.py` hiện không bảo toàn đầy đủ các trường đó; chạy nó trên bug log sẽ làm mất ngữ cảnh tái hiện và triage. Với bug STG/UAT/production, đọc `bug-reproduction.md`, chuẩn hóa issue rồi mới sinh regression spec sau khi đã tái hiện và chốt oracle.

Tester thường đã có sẵn file test case (mẫu KỊCH BẢN NGHIỆM THU / UAT). Đó là tài sản quý: nó chứa nghiệp vụ, tiền điều kiện, dữ liệu và kết quả mong đợi — tức là gần như đủ mọi thứ để viết automation, trừ selector.

Skill này đi theo hướng **giữ Excel làm nguồn sự thật về nghiệp vụ**, sinh ra khung code tương ứng, rồi bổ sung selector lấy từ bước EXPLORE hoặc từ `scripts/explore.mjs`.

## Mẫu KBKTCN — Kịch bản kiểm thử chức năng

Đây là mẫu được dùng phổ biến nhất. Template trắng: **`assets/testcase-template/KBKTCN.xlsx`** — nhân bản nó khi cần tạo file test case mới cho một màn hình.

Cấu trúc một file KBKTCN:

| Vùng | Nội dung |
|---|---|
| Sheet `Tổng hợp` | Bảng tổng kết P/F/PE theo từng màn hình. **Không phải danh sách test case** — script tự bỏ qua sheet này |
| Sheet `KBKTCN_<màn hình>` | Danh sách test case thật |
| Dòng 1–11 | Metadata: tên màn hình (`D3`), **tiền tố mã** (`D4`, ví dụ `QLĐH`), bộ đếm Manual/Automation |
| Dòng 15–17 | **Dải tiêu đề ba dòng** gộp ô — dòng 15 tên cột, 16–17 tiêu đề con (`Android (…)`, `Lần 1`) |
| Dòng 18+ | Dòng nhóm (`SUITE GIAO DIỆN`), dòng suite (`Suite 1: …`), rồi test case |

Cột: `ID BUG` · `ID` · `Mục đích kiểm thử` · `Trường hợp kiểm thử` · `Data test` · `Các bước thực hiện` · `Kết quả mong muốn` · `Thứ tự ưu tiên` · `Mức độ nghiêm trọng` · ảnh IOS/Android/DB · kết quả Manual (Android/IOS × 3 lần) · `Kết quả test (M)` · kết quả Automation (Browsers/Script × 3 lần) · `Kết quả test (AT)` · `Mã lỗi` · `Ghi chú`.

Script ánh xạ thêm so với mẫu UAT phẳng: `Mục đích kiểm thử` → JSDoc, `Thứ tự ưu tiên` → tag Playwright (`HIGH/HIGHEST → @p0`, `MEDIUM → @p1`, còn lại `@p2`), `Mức độ nghiêm trọng` và `ID BUG` → JSDoc, dòng suite → `test.describe` lồng nhau.

```bash
npx playwright test --grep @p0     # chạy riêng nhóm ưu tiên cao
```

### Cạm bẫy: công thức sinh mã bị trôi tham chiếu

Cột `ID` không phải giá trị gõ tay mà là công thức ghép tiền tố với số thứ tự, trừ đi số dòng suite phía trên:

```
=IF(G20="","",$D$4&"_"&ROW()-17-COUNTBLANK($G$18:G20))
```

Điểm cuối của `COUNTBLANK` **phải bám đúng dòng hiện tại** (`G20` ở dòng 20). Chèn/xoá dòng có thể làm nó trôi thành `G23`, `G24`… Khi đó dãy mã vừa **trùng** vừa **thủng**: hai test case khác nhau mang cùng một mã, còn một số thì không tồn tại.

Hậu quả không chỉ là xấu số: bug log trỏ về một mã trùng thì không biết thuộc ca nào, và công cụ đọc file sẽ gộp nhầm hai ca thành một, nuốt mất một ca. `excel_to_spec.py` phát hiện và cảnh báo cả hai trường hợp:

```
⚠ Mã 'QLĐH_31' bị TRÙNG ở dòng Excel 50, 51
⚠ Dãy mã thủng ở số: 34
```

Gặp cảnh báo này thì sửa công thức trong Excel trước khi sinh spec — đừng sửa mã bằng tay, lần chèn dòng sau lại trôi tiếp.

## Chạy script

```bash
python scripts/excel_to_spec.py --help
python scripts/excel_to_spec.py --file "KỊCH BẢN NGHIỆM THU.xlsx" --out ./e2e/tests/generated
```

Xem trước cấu trúc file mà không sinh code (nên chạy trước tiên để kiểm tra script đọc đúng cột chưa):

```bash
python scripts/excel_to_spec.py --file testcase.xlsx --dry-run
```

Script tự dò cột theo tên tiếng Việt hoặc tiếng Anh (`Mã TC`, `ID`, `Mục tiêu`, `Tiền điều kiện`, `Các bước thực hiện`, `Dữ liệu`, `Kết quả mong đợi`, `Test Steps`, `Expected Result`...). Nếu dò sai, chỉ định tay:

```bash
python scripts/excel_to_spec.py --file testcase.xlsx \
  --sheet "Đăng nhập" --header-row 5 \
  --col-id "STT" --col-title "Mục tiêu" --col-steps "Các bước" --col-expected "Kết quả mong đợi"
```

Script cần `openpyxl`. Nếu chưa có: `pip install openpyxl`.

## Script sinh ra gì

Mỗi sheet thành một file `.spec.ts`; mỗi dòng test case thành một `test()` với các bước đã tách thành `test.step()`:

```typescript
/**
 * Sinh tự động từ: KỊCH BẢN NGHIỆM THU.xlsx — sheet "Đăng nhập"
 * ⚠️ Đây là KHUNG. Cần thay các TODO bằng locator thật (chạy scripts/explore.mjs để lấy).
 */
import { test, expect } from '@playwright/test';

test.describe('Đăng nhập', () => {
  /**
   * Tiền điều kiện: Đã có tài khoản hợp lệ trên hệ thống
   * Dữ liệu: user01@example.com / <mật khẩu lấy từ .env, không ghi vào file test case>
   */
  test('TC-DN-01: Đăng nhập thành công với tài khoản hợp lệ', async ({ page }) => {
    await test.step('1. Mở trang đăng nhập', async () => {
      // TODO: await page.goto('/login');
    });

    await test.step('2. Nhập email và mật khẩu hợp lệ', async () => {
      // TODO: điền dữ liệu
    });

    await test.step('3. Bấm nút "Đăng nhập"', async () => {
      // TODO: await page.getByRole('button', { name: 'Đăng nhập' }).click();
    });

    await test.step('Kết quả mong đợi: Vào được trang chủ, hiển thị tên người dùng', async () => {
      // TODO: assertion cho kết quả mong đợi ở trên
      expect(true, 'Chưa hiện thực assertion').toBe(false);
    });
  });
});
```

Assertion mặc định để **fail có chủ đích**. Một khung test luôn xanh là thứ nguy hiểm nhất trong suite: nó tạo cảm giác đã cover trong khi chưa kiểm tra gì. Dòng đó buộc phải xử lý trước khi merge.

Script còn xuất `test-map.json` để truy vết ngược từ mã test case về file code:

```json
[
  { "tc_id": "TC-DN-01", "sheet": "Đăng nhập", "excel_row": 6,
    "title": "Đăng nhập thành công với tài khoản hợp lệ",
    "spec_file": "dang-nhap.spec.ts", "status": "generated" }
]
```

Dùng bảng này khi khách hàng hỏi "test case nào đã tự động hóa" — trả lời được bằng dữ liệu thay vì cảm tính.

## Quy trình đầy đủ

```
1. Đọc Excel        → python scripts/excel_to_spec.py --dry-run   (kiểm tra dò cột đúng chưa)
2. Sinh khung       → python scripts/excel_to_spec.py --out ./tests/generated
3. Trinh sát app    → node scripts/explore.mjs --url <url>        (lấy locator thật)
4. Điền TODO        → thay locator + assertion, gom locator vào Page Object
5. Chạy & sửa       → npx playwright test tests/generated --headed
6. Chuyển chỗ ở     → chuyển spec đã hoàn thiện từ generated/ sang tests/ui/
7. Cập nhật map     → đánh dấu status: "automated"
```

Bước 6 quan trọng: thư mục `generated/` chỉ là vùng trung chuyển. Nếu để code hoàn thiện nằm đó, lần sinh sau sẽ ghi đè mất công sức. Script mặc định **không ghi đè** file đã tồn tại — dùng `--force` nếu thật sự muốn.

## Ánh xạ ngôn ngữ test case sang code

Bảng này giúp dịch câu tiếng Việt trong file test case thành Playwright:

| Câu trong test case | Code |
|---|---|
| "Mở trang X" | `await page.goto('/x')` |
| "Nhập ... vào ô ..." | `await page.getByLabel('...').fill('...')` |
| "Bấm/Click nút X" | `await page.getByRole('button', { name: 'X' }).click()` |
| "Chọn X từ danh sách" | `await page.getByLabel('...').selectOption('X')` |
| "Tích chọn X" | `await page.getByLabel('X').check()` |
| "Tải lên file X" | `await page.getByLabel('...').setInputFiles('...')` |
| "Hệ thống hiển thị thông báo X" | `await expect(page.getByText('X')).toBeVisible()` |
| "Chuyển sang trang X" | `await expect(page).toHaveURL(/\/x/)` |
| "Nút X bị mờ/vô hiệu" | `await expect(page.getByRole('button', { name: 'X' })).toBeDisabled()` |
| "Danh sách hiển thị N bản ghi" | `await expect(page.getByRole('row')).toHaveCount(N + 1)` |
| "Dữ liệu được lưu vào hệ thống" | kiểm chứng qua API — xem `references/api-testing.md` |
| "Không cho phép/Báo lỗi" | assert thông báo lỗi **và** assert không điều hướng đi |

Lưu ý ở dòng cuối: "báo lỗi" mà chỉ assert thấy chữ đỏ là chưa đủ. Bug hay gặp là app vừa hiện lỗi vừa cho đi tiếp — phải assert cả hai vế.

## Chiều ngược lại: từ code ra báo cáo nghiệm thu

Sau khi chạy, xuất kết quả về đúng định dạng khách hàng cần:

```bash
npx playwright test --reporter=json --output-file=results.json
```

Rồi ghép `results.json` với `test-map.json` theo mã TC để điền cột "Kết quả thực tế" / "Đạt/Không đạt" vào chính file Excel gốc. Skill này chỉ lo phần chạy test và xuất `results.json`; phần ghi ngược vào file Excel đúng mẫu nghiệm thu nằm ngoài phạm vi — dùng công cụ xử lý Excel sẵn có trong môi trường của bạn (nếu không có, ghi bằng `openpyxl` theo đúng header của file gốc).

## Khi nào KHÔNG nên sinh từ Excel

Không phải test case nào cũng đáng tự động hóa. Bỏ qua những ca:

- **Chỉ chạy một lần** (kiểm tra dữ liệu migration, nghiệm thu một lần rồi thôi).
- **Phụ thuộc đánh giá của con người** ("giao diện có đẹp không", "thông báo có dễ hiểu không").
- **Cần thiết bị/hành động ngoài trình duyệt** (quét mã trên máy POS, ký số bằng USB token, in hóa đơn).
- **Luồng còn đang thay đổi từng ngày** — tự động hóa lúc này là bảo trì liên tục mà chẳng bắt được bug nào.

Ưu tiên ngược lại: ca **chạy lại nhiều lần** (smoke, regression), ca **tốn công làm tay** (nhập 50 dòng dữ liệu), ca **dễ sai sót khi làm tay** (đối chiếu số tiền, kiểm tra phân quyền cho nhiều role). Nói rõ lựa chọn này với tester thay vì âm thầm sinh hết mọi dòng trong file.

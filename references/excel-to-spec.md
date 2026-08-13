# Chuyển file test case Excel thành script

Tester thường đã có sẵn file test case (mẫu KỊCH BẢN NGHIỆM THU / UAT). Đó là tài sản quý: nó chứa nghiệp vụ, tiền điều kiện, dữ liệu và kết quả mong đợi — tức là gần như đủ mọi thứ để viết automation, trừ selector.

Skill này đi theo hướng **giữ Excel làm nguồn sự thật về nghiệp vụ**, sinh ra khung code tương ứng, rồi bổ sung selector từ pha Recon.

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
   * Dữ liệu: user01@example.com / Abc@12345
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

Rồi ghép `results.json` với `test-map.json` theo mã TC để điền cột "Kết quả thực tế" / "Đạt/Không đạt" vào chính file Excel gốc. Khi tester cần việc này, dùng skill `testcase-template` để ghi file Excel đúng mẫu — skill này lo phần chạy test, skill kia lo phần trình bày tài liệu.

## Khi nào KHÔNG nên sinh từ Excel

Không phải test case nào cũng đáng tự động hóa. Bỏ qua những ca:

- **Chỉ chạy một lần** (kiểm tra dữ liệu migration, nghiệm thu một lần rồi thôi).
- **Phụ thuộc đánh giá của con người** ("giao diện có đẹp không", "thông báo có dễ hiểu không").
- **Cần thiết bị/hành động ngoài trình duyệt** (quét mã trên máy POS, ký số bằng USB token, in hóa đơn).
- **Luồng còn đang thay đổi từng ngày** — tự động hóa lúc này là bảo trì liên tục mà chẳng bắt được bug nào.

Ưu tiên ngược lại: ca **chạy lại nhiều lần** (smoke, regression), ca **tốn công làm tay** (nhập 50 dòng dữ liệu), ca **dễ sai sót khi làm tay** (đối chiếu số tiền, kiểm tra phân quyền cho nhiều role). Nói rõ lựa chọn này với tester thay vì âm thầm sinh hết mọi dòng trong file.

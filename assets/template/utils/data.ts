/**
 * Sinh dữ liệu test.
 *
 * Dữ liệu cố định kiểu 'test01@example.com' sẽ đụng nhau khi chạy song song
 * và bẩn dần qua từng lần chạy. Luôn sinh giá trị duy nhất cho dữ liệu mới tạo.
 */

/** Chuỗi duy nhất: thời điểm + phần ngẫu nhiên, an toàn khi nhiều worker chạy cùng lúc. */
export const unique = (prefix = 'test'): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const uniqueEmail = (domain = 'example.com'): string => `${unique('auto')}@${domain}`;

export const uniquePhone = (): string =>
  `09${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

export const uniqueTaxCode = (): string =>
  String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999));

/** Ngày dạng YYYY-MM-DD, lệch `offsetDays` so với hôm nay. */
export const dateOffset = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/** Định dạng tiền như hệ thống Việt Nam hiển thị: 1250000 → "1.250.000" */
export const formatVND = (amount: number): string =>
  amount.toLocaleString('vi-VN');

/**
 * Bộ giá trị biên nên thử cho mọi ô nhập liệu.
 *
 * `sqlLike` và `htmlLike` dùng để kiểm tra app có escape và validate đầu vào đúng
 * không — kỳ vọng là hệ thống lưu/hiển thị nguyên văn hoặc báo lỗi, tuyệt đối không
 * được thực thi. Đây là kiểm thử phòng thủ trên chính sản phẩm của mình.
 */
export const edgeCases = {
  empty: '',
  spacesOnly: '   ',
  singleChar: 'a',
  maxLength: 'A'.repeat(255),
  overMaxLength: 'A'.repeat(256),
  vietnamese: 'Nguyễn Thị Hồng Ánh',
  vietnameseUpper: 'NGUYỄN THỊ HỒNG ÁNH',
  emoji: '🎉 Khuyến mãi 🎁',
  leadingTrailingSpace: '  Nguyễn Văn A  ',
  numberAsText: '0123456789',
  negative: '-1',
  zero: '0',
  decimal: '1.5',
  comma: '1,5',
  sqlLike: "'; DROP TABLE users; --",
  htmlLike: '<script>alert(1)</script>',
  unicodeControl: 'a​b',
} as const;

/** Chọn ngẫu nhiên một phần tử — hữu ích khi test không quan tâm giá trị cụ thể. */
export const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

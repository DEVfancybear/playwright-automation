# Đo hiệu năng phía người dùng

Playwright đo được **hiệu năng cảm nhận của một người dùng** (trang tải nhanh không, API phản hồi bao lâu). Nó **không** phải công cụ test tải — muốn biết hệ thống chịu được bao nhiêu người cùng lúc thì cần k6/JMeter, xem mục cuối.

## Đo thời gian tải trang

```typescript
test('trang chủ tải dưới 3 giây', async ({ page }) => {
  const start = Date.now();
  await page.goto('/', { waitUntil: 'load' });
  const loadTime = Date.now() - start;

  console.log(`Thời gian tải: ${loadTime}ms`);
  expect(loadTime, 'Trang chủ tải quá chậm').toBeLessThan(3000);
});
```

Chi tiết hơn, đọc thẳng Navigation Timing của trình duyệt:

```typescript
const timing = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  return {
    ttfb: Math.round(nav.responseStart - nav.requestStart),        // thời gian byte đầu tiên
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
    load: Math.round(nav.loadEventEnd),
    transferSize: nav.transferSize,
  };
});

expect(timing.ttfb, 'Server phản hồi chậm').toBeLessThan(800);
```

## Core Web Vitals

Ba chỉ số Google dùng để đánh giá trải nghiệm, cũng ảnh hưởng tới SEO:

| Chỉ số | Ý nghĩa | Ngưỡng "tốt" |
|---|---|---|
| **LCP** (Largest Contentful Paint) | Khi nào nội dung chính hiện ra | < 2.5s |
| **CLS** (Cumulative Layout Shift) | Nội dung có nhảy lung tung không | < 0.1 |
| **INP** (Interaction to Next Paint) | Bấm vào thì bao lâu mới phản hồi | < 200ms |

```typescript
test('Core Web Vitals đạt ngưỡng', async ({ page }) => {
  await page.goto('/');

  const lcp = await page.evaluate(() => new Promise<number>(resolve => {
    new PerformanceObserver(list => {
      const entries = list.getEntries();
      resolve(entries[entries.length - 1].startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => resolve(-1), 10_000);
  }));

  const cls = await page.evaluate(() => new Promise<number>(resolve => {
    let total = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) total += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => resolve(total), 5000);
  }));

  expect.soft(lcp, 'LCP quá chậm').toBeLessThan(2500);
  expect.soft(cls, 'Giao diện bị nhảy khi tải').toBeLessThan(0.1);
});
```

Dùng `expect.soft` ở đây là có chủ ý: chỉ số hiệu năng dao động theo tải máy và mạng, nên nếu để hard assert thì suite chức năng sẽ đỏ vì lý do không liên quan. Với hiệu năng, **xu hướng theo thời gian quan trọng hơn một lần đo**.

## Đo thời gian phản hồi API trong luồng thật

```typescript
test('tìm kiếm phản hồi dưới 1 giây', async ({ page }) => {
  await page.goto('/products');

  const responsePromise = page.waitForResponse(r => r.url().includes('/api/search'));
  const start = Date.now();
  await page.getByPlaceholder('Tìm kiếm').fill('áo');
  await page.getByRole('button', { name: 'Tìm' }).click();
  await responsePromise;

  expect(Date.now() - start).toBeLessThan(1000);
});
```

## Kiểm tra dung lượng tài nguyên

Bug hiệu năng phổ biến nhất trong dự án Việt Nam: ảnh gốc vài MB được đưa thẳng lên production.

```typescript
test('không có tài nguyên nào nặng quá 1MB', async ({ page }) => {
  const heavy: string[] = [];

  page.on('response', async res => {
    const len = Number(res.headers()['content-length'] || 0);
    if (len > 1_000_000) heavy.push(`${(len / 1e6).toFixed(1)}MB — ${res.url()}`);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(heavy, `Tài nguyên nặng:\n${heavy.join('\n')}`).toEqual([]);
});
```

## Lighthouse

Khi cần báo cáo hiệu năng đầy đủ có điểm số:

```bash
npm i -D playwright-lighthouse lighthouse
```

```typescript
import { playAudit } from 'playwright-lighthouse';

test('điểm Lighthouse đạt yêu cầu', async () => {
  const browser = await chromium.launch({ args: ['--remote-debugging-port=9222'] });
  const page = await browser.newPage();
  await page.goto('https://staging.example.com');

  await playAudit({
    page,
    port: 9222,
    thresholds: { performance: 70, accessibility: 90, 'best-practices': 80, seo: 80 },
    reports: { formats: { html: true }, name: 'lighthouse-report', directory: 'test-results' },
  });

  await browser.close();
});
```

Lighthouse cần cổng debug riêng nên không dùng chung `page` fixture bình thường được. Điểm số dao động khá nhiều giữa các lần chạy — đặt ngưỡng rộng rãi và theo dõi xu hướng, đừng chốt cứng 90 rồi bực mình vì suite đỏ liên tục.

## Khi nào cần công cụ test tải

Playwright mở trình duyệt thật, mỗi phiên tốn hàng trăm MB RAM. Mô phỏng 1000 người dùng đồng thời bằng Playwright là không khả thi về chi phí.

| Câu hỏi cần trả lời | Công cụ |
|---|---|
| Trang có tải nhanh với một người dùng không? | Playwright, Lighthouse |
| Hệ thống chịu được bao nhiêu người cùng lúc? | k6, JMeter, Gatling |
| Có rò rỉ bộ nhớ khi chạy lâu không? | k6 (soak test) |
| API chịu được bao nhiêu request/giây? | k6, Artillery |

Ví dụ k6 tối thiểu, để tester hình dung được ranh giới:

```javascript
// load-test.js — chạy: k6 run load-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // tăng dần lên 50 người dùng ảo
    { duration: '3m', target: 50 },    // giữ 3 phút
    { duration: '1m', target: 0 },     // giảm về 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],  // 95% request dưới 800ms
    http_req_failed: ['rate<0.01'],    // dưới 1% lỗi
  },
};

export default function () {
  const res = http.get('https://staging.example.com/api/products');
  check(res, { 'status 200': r => r.status === 200 });
}
```

Trước khi chạy test tải, **xin phép chủ hệ thống và chỉ chạy trên môi trường được phép**. Bắn tải vào production hoặc vào hệ thống của bên khác mà không có thỏa thuận thì về bản chất là gây từ chối dịch vụ — hậu quả kỹ thuật và pháp lý đều thật.

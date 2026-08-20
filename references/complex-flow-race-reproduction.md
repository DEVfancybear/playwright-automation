# Tái hiện luồng dài, nhiều màn hình và bug phụ thuộc thao tác nhanh

Mục lục: [Khi nào dùng](#khi-nào-dùng) · [Biên dịch log](#1-biên-dịch-log-thành-scenario-map) · [Thiết kế replay](#2-thiết-kế-replay) · [Critical burst](#3-critical-burst-và-cadence) · [Nhiều page và actor](#4-nhiều-page-tab-popup-và-actor) · [Evidence](#5-evidence-và-observer-effect) · [Ma trận chạy](#6-ma-trận-chạy-và-kết-luận) · [Mẫu Playwright](#7-mẫu-playwright)

## Khi nào dùng

**Đi bộ một lượt bằng tay trước (bước EXPLORE).** Mở app, đi đúng luồng ở nhịp thường bằng công cụ browser để chốt route, label, oracle và xem bug có tái hiện luôn không. Tái hiện được ở nhịp thường → báo kết luận sơ bộ ngay, rồi vẫn chốt lại thành regression spec như mọi lượt khác. Không tái hiện được ở nhịp thường → bug phụ thuộc cadence, PLAN phải có ma trận nhịp và attempt budget theo file này.

Escalate khi cần một trong các thứ thao tác tay không làm nổi: gap giữa hai action dưới ~500 ms, chạy ≥10 lượt có reset state để lấy tỷ lệ `x/y`, hai actor/session chạy song song, hoặc chạy trên CI.

> **Chặn cứng — hai luật không được vi phạm:**
> 1. **Attempt chạy tay KHÔNG được tính vào attempt budget.** Thao tác qua công cụ browser là instrumentation chậm nhất có thể (mỗi lời gọi tốn hàng trăm ms), nên nó không đo được cadence và không đại diện cho một attempt hợp lệ.
> 2. **Chỉ chạy tay mà không thấy bug → verdict là `Inconclusive`, KHÔNG BAO GIỜ `Not reproduced`.** Muốn kết luận `Not reproduced` thì phải chạy đủ ma trận cadence bằng script.

Đọc file này cùng `bug-reproduction.md` khi issue có một trong các dấu hiệu:

- mô tả dài, precondition chen giữa steps, nhiều dấu `>>`, `=>`, `->`, branch hoặc bước lặp;
- đi qua nhiều màn hình/module, back/reopen/refresh/relogin, tab/popup/iframe;
- có nhiều actor/role/session hoặc cần giữ state qua nhiều chặng;
- dùng từ như “ngay”, “liền”, “liên tục”, “double-click”, “bấm nhanh”, “lần thứ hai”, “trước khi tải xong”;
- chỉ lỗi đôi lúc, phụ thuộc nhịp thao tác hoặc nghi race/hydration/debounce/double-submit.

Mục tiêu là giữ nguyên **causal chain** và **cadence** của người dùng. Không biến log dài thành một danh sách click mất state; cũng không thêm wait để test xanh rồi kết luận bug không tồn tại.

## 1. Biên dịch log thành scenario map

### 1.1 Giữ raw anchor theo từng clause

Trước khi mở app, đánh số từng mệnh đề có nghĩa trong log gốc (`C01`, `C02`...). Mỗi câu, bullet, numbering, đoạn trước/sau dấu mũi tên, caption evidence và timing word phải được map vào một trong ba loại:

- `executable`: precondition, action, transition, observation hoặc oracle;
- `metadata`: environment, actor, data, status, note;
- `unknown/contradiction`: chưa hiểu hoặc có nhiều cách diễn giải.

Không gộp hai action liên tiếp thành một câu tóm tắt nếu việc gộp làm mất thứ tự, lần lặp, màn hình hoặc timing.

### 1.2 Lập bảng scenario map

| Step | Raw anchor | Actor / context / page | From screen + state | Action | Timing relation | To screen + state | Observation / oracle | Unknown |
|---|---|---|---|---|---|---|---|---|
| S01 | C03: “Tạo nháp…” | user / ctx-user / main | form / clean | điền và lưu nháp | normal | detail / draft-id | ID xuất hiện | |
| S02 | C05: “quay lại…” | user / ctx-user / main | detail / draft | Back | ngay sau S01 | list / draft persisted | draft còn trong list | gap chính xác |

Ghi rõ:

- `actor/context/page`: ai thao tác, session nào, tab/popup/iframe nào;
- `from/to state`: không chỉ tên màn hình; thêm UI state, session state và persisted business state liên quan;
- `timing relation`: `after_ready`, `immediate`, `within_unknown_window`, `repeat_n`, `concurrent_external_event`, hoặc số đo lấy từ evidence;
- `observation`: checkpoint để biết đã tới đúng state; `oracle`: điều quyết định bug pass/fail;
- branch/loop: tách `S04A/S04B`, `S05 × 3`; không tự chọn một nhánh;
- exact label/input/message: giữ nguyên để recon và assertion.

### 1.3 Completeness gate

Chỉ chuyển sang replay khi:

- mọi raw clause đã map sang step/metadata/unknown; reproduction package bắt buộc có `raw_clause_coverage: mapped/total` và danh sách clause chưa map;
- mọi từ chỉ thứ tự và timing (`ngay`, `sau đó`, `lần hai`, `liên tục`, `không chờ`) còn trong map;
- actor, page/context, from/to state và observation point của mỗi transition đã rõ hoặc ghi `Unknown`;
- action lặp, back/reopen/refresh/relogin và side effect không bị bỏ;
- mâu thuẫn trở thành variant A/B hoặc câu hỏi chặn, không bị agent âm thầm “sửa câu”;
- flow có thể truy ngược từ step về raw anchor.

Nếu log quá dài, lưu scenario map thành artifact Markdown/YAML/JSON và attach vào report; không dựa vào trí nhớ trong context.

## 2. Thiết kế replay

Chia một attempt thành ba pha, nhưng giữ toàn bộ causal flow trong **một test**:

```text
SETUP           dựng role/session/data và đi tới checkpoint trước trigger
CRITICAL BURST  chạy đúng action nguồn theo đúng thứ tự/cadence, không chen quan sát nặng
ORACLE          kiểm symptom + KQMM + persistence/side effect sau burst
```

### Setup

- Dùng synchronization bình thường: web-first assertion, URL, response hoặc checkpoint nghiệp vụ cụ thể.
- Tạo seed mới hoặc reset state cho **mỗi attempt**. Ghi cold/warm cache/session nếu nó có thể ảnh hưởng.
- Có thể dùng API/fixture để dựng precondition chỉ khi bước bị bỏ **không thuộc trigger**. Nếu bug phụ thuộc lịch sử UI, replay lịch sử đó bằng UI.
- Chụp checkpoint ngay trước burst: route, visible state, record ID đã mask và timestamp monotonic.

### Critical burst

- Chỉ chứa action tester đã làm và delay được khai báo là biến đầu vào.
- Giữ action nối tiếp bằng `await` theo đúng thứ tự. Không dùng `Promise.all` để chạy song song các click/type vốn nối tiếp.
- Được dùng `Promise.all` để **thu các waiter đã arm trước**; không dùng nó để biến hai thao tác người dùng thành đồng thời.
- Không chen screenshot, assertion, `trial: true`, DOM dump, readiness wait hoặc logging nặng giữa burst nếu nguồn không có pause đó.
- Mặc định dùng locator action user-like, không `force`. `force`, `dispatchEvent`, coordinate/mouse low-level chỉ là nhánh chẩn đoán và phải gắn nhãn; kết quả nhánh đó không thay bằng chứng user-like.
- Không dùng `noWaitAfter` như cách làm action “nhanh hơn”.

### Oracle

- Bắt đầu sau action cuối của burst; kiểm cả symptom cũ và KQMM tích cực.
- Kiểm persisted/read-back state bằng refresh/reopen/API phù hợp nếu bug đi xuyên màn hình.
- Nếu flow bị lỗi sớm hơn observation point, báo `Blocked by <symptom khác>`; không gọi đó là reproduction của bug đích.

Không tách các chặng của một causal scenario thành nhiều test phụ thuộc nhau. Chia code bằng `test.step`, Page Object hoặc flow helper; mỗi test/attempt vẫn tự dựng state và chạy trọn flow.

## 3. Critical burst và cadence

### 3.1 Lấy cadence

Ưu tiên theo thứ tự:

1. timestamp/video/trace của tester;
2. số đo từ một lượt tester thao tác lại;
3. wording định tính trong log;
4. controlled exploration nếu không có số đo.

Nếu nguồn chỉ nói “bấm nhanh”, ghi timing gốc là `Unknown`. Không bịa ra “100 ms đúng như tester”. Có thể chạy speed ladder để tìm ngưỡng, nhưng gắn nhãn `exploration`, không thay thế replay gốc.

Ví dụ ladder ban đầu, điều chỉnh theo flow và môi trường:

| Profile | Gap yêu cầu giữa action | Mục đích |
|---|---:|---|
| immediate | 0 ms | Playwright/user rất nhanh |
| fast | 25–100 ms | thao tác nhanh có chủ đích |
| normal | 250–500 ms | đối chứng gần nhịp người dùng |
| ready-gated | theo tín hiệu UI | control; không phải replay nếu tester không chờ |

`waitForTimeout(cadenceMs)` chỉ được dùng ở đây như **biến đầu vào timing** giữa hai action. Đặt tên `cadenceMs`, lưu giá trị trong evidence và không gọi nó là readiness wait. Playwright không bảo đảm lịch thực thi chính xác từng mili-giây; đo elapsed thực tế thay vì chỉ báo requested gap.

Phân biệt đúng option:

- `click({ delay })` là thời gian giữa `mousedown` và `mouseup`, không phải gap giữa hai click;
- `pressSequentially(text, { delay })` phát chuỗi keyboard event và delay giữa ký tự; chỉ dùng khi bug phụ thuộc việc gõ/event, còn bình thường dùng `fill()`;
- `dblclick()`/`click({ clickCount: 2 })` dùng khi tester thật sự double-click;
- `keyboard.down/up`, `mouse.down/up/move` dùng khi gesture/held key là trigger; ghi rõ đây là low-level sequence.

### 3.2 Đo và lặp

Với mỗi attempt, lưu tối thiểu:

```json
{
  "attempt": 7,
  "profile": "fast",
  "requestedGapMs": 50,
  "actionStartedAtMs": [0.0, 63.4],
  "actualGapMs": 63.4,
  "coldOrWarm": "warm",
  "instrumentation": "low-overhead",
  "outcome": "reproduced"
}
```

Dùng monotonic clock trong test runner (`performance.now()`), không dùng timestamp của server để đo gap giữa action local. Đo thời điểm lời gọi action bắt đầu/kết thúc; không tuyên bố đây là thời điểm browser/OS xử lý event tuyệt đối.

Trong pha đo baseline:

- `retries=0` để không trộn retry vào denominator;
- `workers=1` để giảm nhiễu và tránh đụng data; chỉ thêm load/parallelism như một biến matrix riêng;
- chạy `--repeat-each=N` hoặc loop attempts có reset rõ ràng;
- báo `reproduced x/y`, không chỉ pass/fail cuối;
- không dùng một attempt pass để bác bỏ bug intermittent.

Không chạy vô hạn. Chọn attempt budget trước theo rủi ro/thời gian. Deterministic regression cần ít nhất hai lượt độc lập; còn baseline `intermittent`/timing-sensitive **không được mặc định chỉ chạy hai lượt**. Nếu chưa có chuẩn dự án, bắt đầu ít nhất 10 lượt (thường 10–20) cho mỗi profile chính rồi tăng có lý do theo tỷ lệ lịch sử và chi phí. Khi verify fix, giữ cùng profile/fingerprint và dùng đủ lượt để so tỷ lệ baseline/target; ghi remaining statistical risk, không hứa chứng minh tuyệt đối từ `0/N`.

## 4. Nhiều page, tab, popup và actor

- Một tab/popup là một `Page`; các page cùng session nằm trong một `BrowserContext`.
- Hai actor/role độc lập phải dùng hai context riêng. Không đăng xuất/đăng nhập lại trên một page nếu việc đó làm mất concurrency/session state của case.
- Popup thuộc context của page cha. Dùng `page.waitForEvent('popup')` cho popup do page cụ thể mở; dùng `context.waitForEvent('page')` cho tab mới nói chung.
- iframe vẫn thuộc page; dùng `frameLocator()`, không coi nó là tab.
- Không cần `bringToFront()` để Playwright thao tác page khác; chỉ dùng nếu chính app phụ thuộc visibility/focus và ghi nó vào fingerprint.

Luôn arm waiter/listener **trước** action gây event:

```typescript
const popupPromise = page.waitForEvent('popup');
const responsePromise = page.waitForResponse(r =>
  r.url().includes('/api/save') && r.request().method() === 'POST'
);

await page.getByRole('button', { name: 'Lưu và xem' }).click();
const [popup, response] = await Promise.all([popupPromise, responsePromise]);
```

Không `await page.waitForEvent(...)` trước trigger vì action sẽ không bao giờ được chạy. Không dùng `waitForNavigation()`; chờ URL hoặc assertion web cụ thể. Nếu cần bắt request đầu tiên của popup, gắn route/network listener ở **context** trước trigger.

Sau mỗi transition ngoài burst, đặt checkpoint nhẹ nhưng có nghĩa nghiệp vụ:

```text
page identity + route + record/state marker + actor/session alias
```

Checkpoint không phải oracle cuối và không được reset state cần cho chặng sau.

Với flow hai actor kiểu “checker đã chờ sẵn và thao tác ngay khi row realtime xuất hiện”, arm waiter ở context/page của checker **trước** action của maker. Sau trigger của maker, await đúng tín hiệu người checker có thể quan sát rồi click ngay; waiter này là quan hệ nhân quả của flow, không phải sleep để ổn định test:

```typescript
const rowAppeared = checkerPage
  .getByRole('row')
  .filter({ hasText: paymentId })
  .waitFor({ state: 'visible' });

await makerPage.getByRole('button', { name: 'Gửi duyệt' }).click();
await rowAppeared;
await checkerPage.getByRole('row')
  .filter({ hasText: paymentId })
  .getByRole('button', { name: 'Duyệt' })
  .click();
```

Không dùng `Promise.all([maker.click(), checker.click()])`: checker chỉ có thể click sau khi row thực sự xuất hiện. Ghi timestamp ở cả hai context và dùng cùng test-runner clock để so elapsed trong một process.

## 5. Evidence và observer effect

### Evidence xuyên flow

- Gắn listener ở context trước setup để không bỏ request/page mới: console, page error/web error, request, response và request failed.
- HTTP 4xx/5xx vẫn có response; không chờ `requestfailed` để phát hiện chúng.
- Với WebSocket, ghi open/frame sent/frame received/close nếu symptom phụ thuộc realtime.
- Attach `scenario-map`, `attempt-timeline.json`, fingerprint và before/after screenshot bằng `testInfo.attach()`.
- Trace từ Playwright Test chứa assertion và `test.step`; ưu tiên hơn `context.tracing` khi viết spec.
- Dialog listener phải accept/dismiss; listener chỉ log mà không xử lý sẽ làm action treo.

### Không để instrumentation che trigger

Trace/video/screenshot/listener có overhead. Playwright cũng cảnh báo trace mọi test tốn tài nguyên; việc overhead có làm đổi race cụ thể hay không phải đo, không được khẳng định trước.

Nếu tỷ lệ thay đổi đáng kể khi bật evidence, chạy và báo riêng:

| Instrumentation profile | Trace/video | Evidence tối thiểu | Reproduction |
|---|---|---|---:|
| low-overhead | off | action timeline + outcome | x/y |
| evidence-rich | retain/on theo mục tiêu | trace + video + network | x/y |

Không gộp denominator của hai profile. Cố lấy ít nhất một failure evidence-rich; nếu chỉ low-overhead tái hiện, báo `suspected observer effect` như một suy luận và giữ timeline/log nhẹ thay vì tuyên bố `Not reproduced`.

Với lỗi intermittent, `trace: 'on-first-retry'` có thể bỏ lỡ failure đầu tiên. Trong lượt điều tra có chủ đích, cân nhắc `retain-on-first-failure` hoặc `retain-on-failure`; sau khi codify regression mới quay về policy CI tiết kiệm hơn.

## 6. Ma trận chạy và kết luận

Tách từng biến; không đổi cadence, network, browser, role và data cùng lúc:

| Build | Platform | State | Cadence | Instrumentation | Attempts | Reproduced | Notes |
|---|---|---|---:|---|---:|---:|---|
| baseline | Chromium | warm draft | 50 ms | low | 10 | 7 | |
| baseline | Chromium | warm draft | 300 ms | low | 10 | 0 | controlled cadence variation |
| target | Chromium | warm draft | 50 ms | low | 20 | 0 | same trigger as baseline |

Kết luận:

- `Reproduced`: đúng symptom tại đúng observation point; kèm profile và `x/y`.
- `Intermittent`: cùng fingerprint/profile có cả fail/pass.
- `Not reproduced`: đã chạy đủ budget đã khai báo nhưng không thấy; không đồng nghĩa bug không tồn tại.
- `Inconclusive`: timing nguồn `Unknown`, instrumentation làm đổi đáng kể kết quả, hoặc oracle chưa đủ.
- `Verified fixed`: chỉ khi có baseline do agent tái hiện, target đúng build, cùng trigger/cadence, symptom cũ `0/N`, KQMM + persistence đạt và regression gần không lỗi. Luôn báo N và remaining risk.

Reproduction package cuối phải có ít nhất:

```yaml
raw_clause_coverage: "18/18"
unmapped_clauses: []
scenario_variants: ["original-new-tab", "dev-requested-same-tab"]
attempt_budget:
  baseline: "20/profile"
  target: "20/profile"
  reason: "historical intermittent 3/8"
```

## 7. Mẫu Playwright

Mẫu này minh họa cấu trúc; thay locator/checkpoint bằng DOM thật sau recon:

```typescript
import { test, expect, type Page } from '@playwright/test';

type Profile = { name: string; gapMs: number };
const profiles: Profile[] = [
  { name: 'immediate', gapMs: 0 },
  { name: 'fast-50', gapMs: 50 },
  { name: 'normal-300', gapMs: 300 },
];

async function criticalBurst(page: Page, profile: Profile) {
  const marks: Array<{ action: string; atMs: number }> = [];
  const started = performance.now();
  const mark = (action: string) => marks.push({ action, atMs: performance.now() - started });

  mark('click-save:start');
  await page.getByRole('button', { name: 'Lưu' }).click();
  mark('click-save:end');

  if (profile.gapMs > 0) {
    // Timing input của case; không phải wait cho readiness.
    await page.waitForTimeout(profile.gapMs);
  }

  mark('click-back:start');
  await page.getByRole('button', { name: 'Quay lại' }).click();
  mark('click-back:end');
  return marks;
}

for (const profile of profiles) {
  test(`BUG-123: save → back [${profile.name}]`, async ({ page }, testInfo) => {
    await test.step('SETUP — dựng draft sạch và tới trigger checkpoint', async () => {
      await page.goto('/draft/new');
      await page.getByLabel('Tên').fill(`race-${testInfo.repeatEachIndex}`);
      await expect(page.getByRole('button', { name: 'Lưu' })).toBeVisible();
    });

    const marks = await test.step('CRITICAL BURST — không chen assertion', () =>
      criticalBurst(page, profile)
    );

    await testInfo.attach('attempt-timeline', {
      body: JSON.stringify({ profile, marks }, null, 2),
      contentType: 'application/json',
    });

    await test.step('ORACLE — symptom và persisted state', async () => {
      await expect(page.getByText('Lỗi hệ thống')).not.toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: 'race-' })).toBeVisible();
    });
  });
}
```

Chạy pha đo riêng, không retry và một worker:

```bash
npx playwright test tests/ui/bug-123.spec.ts --repeat-each=20 --workers=1 --retries=0
```

Nguồn kỹ thuật chính: Playwright official docs về [actionability](https://playwright.dev/docs/actionability), [events](https://playwright.dev/docs/events), [pages](https://playwright.dev/docs/pages), [input](https://playwright.dev/docs/input), [network](https://playwright.dev/docs/network), [trace viewer](https://playwright.dev/docs/trace-viewer), [retries](https://playwright.dev/docs/test-retries), [parallelism](https://playwright.dev/docs/test-parallel) và [clock](https://playwright.dev/docs/clock). Các speed ladder, observer-effect protocol và cách phân loại user-like/diagnostic ở trên là hướng dẫn kỹ thuật QA dựa trên semantics chính thức; Playwright không bảo đảm cadence chính xác theo mili-giây.

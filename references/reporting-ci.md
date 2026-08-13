# Report và tích hợp CI/CD

Mục lục: [Reporter](#reporter) · [HTML report](#html-report) · [Allure](#allure) · [Xuất cho TestRail/Jira](#xuất-kết-quả-cho-testrail--jira-xray) · [GitHub Actions](#github-actions) · [Jenkins](#jenkins) · [GitLab CI](#gitlab-ci) · [Sharding](#chia-nhỏ-để-chạy-nhanh-sharding) · [Docker](#docker) · [Chạy theo lịch](#chạy-theo-lịch--gửi-thông-báo)

## Reporter

```typescript
// playwright.config.ts
reporter: [
  ['list'],                                              // log ra terminal khi chạy
  ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ['junit', { outputFile: 'test-results/junit.xml' }],    // cho Jenkins, TestRail, Xray
  ['json',  { outputFile: 'test-results/results.json' }], // để tự xử lý số liệu
  ...(process.env.CI ? [['github'] as const] : []),       // annotate lỗi ngay trên PR
],
```

| Reporter | Dùng để làm gì |
|---|---|
| `list` | Mặc định khi chạy local — thấy từng test đang chạy |
| `dot` | Mặc định trên CI — gọn, ít log |
| `html` | Report cho người đọc: có trace, ảnh, video |
| `junit` | Chuẩn XML mà mọi công cụ CI/quản lý test đều hiểu |
| `json` | Đầu vào để tự sinh báo cáo riêng |
| `blob` | Kết quả trung gian, dùng để gộp khi chạy sharding |
| `github` | Hiện lỗi ngay tại dòng code trong pull request |

## HTML report

```bash
npx playwright show-report
```

Đây là thứ nên gửi cho tester và PM. Trong mỗi test fail có: từng bước với ảnh trước/sau, network log, console log, video, và trace mở lại được. Không cần biết code vẫn xem được test hỏng ở bước nào.

Chia sẻ cho người khác: `playwright-report/` là thư mục tĩnh, zip gửi đi hoặc deploy lên GitHub Pages / S3 / nginx nội bộ đều được.

## Allure

Khi khách hàng hoặc PM quen Allure (biểu đồ xu hướng, phân loại theo severity, lịch sử qua nhiều lần chạy):

```bash
npm i -D allure-playwright
```

```typescript
reporter: [['html'], ['allure-playwright', { outputFolder: 'allure-results', detail: true }]],
```

```bash
npx allure generate allure-results --clean -o allure-report
npx allure open allure-report
```

Gắn metadata cho báo cáo dễ đọc:

```typescript
import { allure } from 'allure-playwright';

test('TC-PAY-01: thanh toán bằng thẻ nội địa', async ({ page }) => {
  await allure.epic('Thanh toán');
  await allure.feature('Thẻ ATM nội địa');
  await allure.severity('critical');
  await allure.link('https://jira.company.vn/browse/PAY-123', 'PAY-123');
  // ...
});
```

Allure cần Java để chạy `allure generate` — kiểm tra trước khi hứa với khách hàng. HTML report có sẵn của Playwright đủ tốt cho đa số dự án; chỉ thêm Allure khi có yêu cầu cụ thể.

## Xuất kết quả cho TestRail / Jira Xray

Cả hai đều nhận file JUnit XML:

```typescript
['junit', { outputFile: 'test-results/junit.xml', embedAnnotationsAsProperties: true }],
```

Để map đúng test case, đặt mã TC ngay trong tên test — công cụ import sẽ khớp theo mã:

```typescript
test('TC-1234: đăng nhập thành công', async ({ page }) => { ... });
```

Import: TestRail dùng plugin JUnit, Xray dùng REST API `POST /api/v2/import/execution/junit`. Kiểm tra định dạng mã TC mà hệ thống của khách yêu cầu trước khi viết cả suite — sửa tên hàng trăm test sau đó rất mất công.

## GitHub Actions

`.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 22 * * *'      # 5h sáng giờ VN (UTC+7)
  workflow_dispatch:

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npx playwright install --with-deps chromium

      - name: Chạy test
        run: npx playwright test
        env:
          BASE_URL: ${{ vars.BASE_URL }}
          API_URL: ${{ vars.API_URL }}
          TEST_USER: ${{ secrets.TEST_USER }}
          TEST_PASS: ${{ secrets.TEST_PASS }}

      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

`if: ${{ !cancelled() }}` để report vẫn được lưu **khi test fail** — đó chính là lúc cần nó nhất. Dùng `if: always()` cũng được nhưng sẽ upload cả khi job bị hủy thủ công.

Mật khẩu để trong `secrets`, URL để trong `vars`. Đừng viết thẳng vào file yml — nó nằm trong git và ai đọc repo cũng thấy.

## Jenkins

`Jenkinsfile`:

```groovy
pipeline {
  agent { docker { image 'mcr.microsoft.com/playwright:v1.62.1-noble'; args '--ipc=host' } }

  environment {
    BASE_URL = 'https://staging.example.com'
    CI = 'true'
  }

  stages {
    stage('Install') { steps { sh 'npm ci' } }

    stage('Test') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'e2e-test-account',
                                          usernameVariable: 'TEST_USER',
                                          passwordVariable: 'TEST_PASS')]) {
          sh 'npx playwright test'
        }
      }
    }
  }

  post {
    always {
      junit 'test-results/junit.xml'
      publishHTML(target: [reportDir: 'playwright-report', reportFiles: 'index.html',
                           reportName: 'Playwright Report', keepAll: true])
      archiveArtifacts artifacts: 'test-results/**', allowEmptyArchive: true
    }
  }
}
```

`--ipc=host` cần thiết vì Chromium dùng bộ nhớ chia sẻ; thiếu nó trình duyệt hay crash trong container với lỗi rất khó hiểu.

## GitLab CI

`.gitlab-ci.yml`:

```yaml
e2e:
  image: mcr.microsoft.com/playwright:v1.62.1-noble
  stage: test
  script:
    - npm ci
    - npx playwright test
  artifacts:
    when: always
    paths: [playwright-report/, test-results/]
    reports:
      junit: test-results/junit.xml
    expire_in: 2 weeks
```

## Chia nhỏ để chạy nhanh (sharding)

Suite lớn thì chia cho nhiều máy chạy song song rồi gộp report lại:

```yaml
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      # ...
      - run: npx playwright test --shard=${{ matrix.shard }}/4 --reporter=blob
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report/

  merge-report:
    needs: test
    if: ${{ !cancelled() }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { path: all-blob-reports, pattern: blob-report-*, merge-multiple: true }
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report/ }
```

Không có bước `merge-reports` thì bạn nhận về 4 report rời rạc và không ai biết tổng thể pass bao nhiêu — nên đừng bỏ job này.

## Docker

Image chính thức đã có sẵn trình duyệt và thư viện hệ thống. **Số phiên bản image phải khớp phiên bản `@playwright/test` trong `package.json`**, lệch là lỗi khó đoán:

```bash
docker run --rm --ipc=host -v "%cd%":/work -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  npx playwright test
```

Trên Git Bash/PowerShell Windows, thay `%cd%` bằng `${PWD}` nếu shell không hiểu.

Docker cũng là cách chuẩn để sinh ảnh baseline cho visual test — xem `references/visual-responsive.md`.

## Chạy theo lịch & gửi thông báo

Regression chạy hằng đêm chỉ có ích khi có người biết kết quả. Bắn thông báo về nơi team thật sự đọc:

```yaml
- name: Báo Slack khi fail
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"🔴 E2E fail trên ${{ github.ref_name }} — xem: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"}" \
      ${{ secrets.SLACK_WEBHOOK }}
```

Nguyên tắc quan trọng hơn cả cấu hình: **suite đỏ phải được sửa trong ngày**. Một suite đỏ triền miên sẽ bị cả team học cách phớt lờ, và khi đó nó thành vô dụng — tệ hơn cả không có, vì vẫn tốn thời gian bảo trì. Nếu một test hỏng và chưa sửa ngay được, hãy `test.fixme()` kèm mã ticket thay vì để nó đỏ mãi:

```typescript
test.fixme('TC-ORD-09: xuất Excel đơn hàng — chờ fix BUG-456', async ({ page }) => { ... });
```

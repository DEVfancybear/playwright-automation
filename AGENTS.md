# Repository testing contract

These instructions apply to the whole repository and are written for an Agent opened directly in a fresh GitHub clone.

## When the user says "test" or "kiểm thử"

- Treat this repository as the target when the user gives no other target. Run `npm run test:standalone` from the repository root and continue through the terminal conclusion.
- Do not ask the tester to import this skill into another project, install the skill into Codex/Claude, run `npm install`, or install a Playwright browser first.
- `npm run test:standalone` owns bootstrap: it runs locked `npm ci` when dependencies are absent and installs the required Chromium/browser when absent. Success ends with `STANDALONE_OK`.
- Run `npm test` only when the user asks for the full regression/maintainer suite. It uses the same automatic bootstrap and ends with `STANDALONE_FULL_OK`.
- If the user supplies a URL for technical smoke/recon, run `npm run test:url -- --url <url>` and preserve its evidence. For a business test request, follow `SKILL.md` through plan, generated tests, execution/healing, and verdict.
- Never put usernames, passwords, OTPs, tokens, or other secrets in command arguments or chat. Use the repository's `.env`/storage-state helpers.

Only involve the tester when automation reaches a real blocker: Node.js itself is unavailable or older than 20, npm/browser download is blocked, OS package installation lacks permission, a required secret/oracle is unavailable, or the requested target crosses a guarded production/side-effect boundary.

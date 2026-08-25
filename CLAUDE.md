# Claude Code repository instructions

Read and follow [`AGENTS.md`](AGENTS.md) for this entire repository.

In particular, when the tester opens this clone and only says "test" or "kiểm thử", run `npm run test:standalone` yourself. Use `npm test` only for an explicit full regression request. Do not ask them to import the skill into another project or manually install npm/Playwright dependencies; the repository runner bootstraps those automatically.

For authenticated live targets, use only the ignored root `.env` that bootstrap/helper creates; never treat a dotenv under template/example/fixture paths as real. On a confirmed non-production certificate interstitial, switch to the repository Playwright helper with `--ignore-https-errors --confirm-non-production` instead of asking the tester to bypass the warning manually.

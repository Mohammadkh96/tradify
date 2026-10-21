# Customer API shared-IP capacity

## Workload

The customer app restores the signed-in profile once with `GET /api/auth/me`; it does not poll the profile every second. Its recurring traffic includes live quotes every second, market snapshots every 15 seconds, and membership and notification reads every 30 seconds. Customer state is also read when its screens are opened and written when users change watchlists, alerts, trades, or notification status.

The repeatable benchmark runs two cohorts against a disposable development database:

- **All Pro:** all 20 synthetic accounts are Pro, preserving the original paid-market and feature-access scenario.
- **Mixed Free/Pro:** 10 Free and 10 Pro accounts, alternating membership so each 10-, 15-, and 20-user stage remains as evenly split as possible.

Each scenario runs 10, 15, and 20 concurrent sessions. Accounts are reseeded before every stage with one unread notification and one alert so all stages exercise the same starting state. The workload includes:

- One `GET /api/auth/me` session restore and one read each of `/api/watchlist`, `/api/user/alerts`, `/api/user/trades`, and `/api/markets/catalog`.
- Recurring `GET /api/market/quotes` at 1-second intervals and `GET /api/market/snapshot` every 15 seconds.
- Recurring `GET /api/membership/status` and `GET /api/user/notifications` every 30 seconds.
- One bounded action journey per customer per stage: add/remove a tier-accessible watchlist market and attempt a restricted market; create/delete an alert when allowed; create/close a trade on an accessible market; and mark the seeded notification read when allowed.

The mixed cohort checks that the market catalog marks `USOIL` accessible and Pro-only `EURUSD` restricted to Free accounts, while Pro accounts can access both. It also verifies filtered quote/snapshot and alert/notification reads. Expected Free-tier denials for alert creation and notification-read writes, plus expected restricted-market watchlist writes for both tiers, are counted separately from failures. A response that does not match the expected status and error remains a failure.

Market provider credentials and the development-upstream URL are removed from the test API process, so market snapshot and catalog calls use local state only.

## Measured results

The global API rate limit is **1,800 requests per minute per source IP**. Sign-in, registration, password-reset, and webhook limits remain separately constrained. The benchmark used one local API process and a disposable database on the verified development PostgreSQL server; all virtual users shared a single source IP.

### All-Pro cohort

| Concurrent users (Free/Pro) | Requests (per minute) | Unexpected failures | Expected tier 403s | HTTP 429 | Overall p50 / p95 / p99 (ms) | Snapshot p95 / p99 (ms) |
|---:|---:|---:|---:|---:|---:|---:|
| 10 (0/10) | 889 (796/min) | 0 | 10 | 0 | 8.0 / 724.3 / 1,137.4 | 1,360.6 / 1,372.6 |
| 15 (0/15) | 1,337 (1,196/min) | 0 | 15 | 0 | 7.5 / 643.5 / 1,188.5 | 1,581.8 / 1,708.4 |
| 20 (0/20) | 1,766 (1,581/min) | 0 | 20 | 0 | 7.0 / 654.7 / 1,237.4 | 1,807.6 / 1,945.0 |

### Mixed Free/Pro cohort

| Concurrent users (Free/Pro) | Requests (per minute) | Unexpected failures | Expected tier 403s | HTTP 429 | Overall p50 / p95 / p99 (ms) | Snapshot p95 / p99 (ms) |
|---:|---:|---:|---:|---:|---:|---:|
| 10 (5/5) | 894 (790/min) | 0 | 20 | 0 | 7.8 / 654.9 / 999.4 | 1,290.6 / 1,432.7 |
| 15 (8/7) | 1,322 (1,170/min) | 0 | 31 | 0 | 9.1 / 661.6 / 1,118.5 | 1,543.5 / 2,152.3 |
| 20 (10/10) | 1,782 (1,576/min) | 0 | 40 | 0 | 8.2 / 691.8 / 1,155.9 | 1,458.1 / 1,707.1 |

The 403 totals are successful restriction checks, not load failures: each Pro account attempts one VIP-only market write; each Free account also attempts a Pro-only market write, alert creation, and notification-read write. HTTP status counts retain these 403s, while failure totals include only unexpected responses and network errors.

### Database pressure by stage

“Active with wait event” counts active API queries reporting any PostgreSQL wait event; it does not identify a lock wait.

| Cohort / users (Free/Pro) | Peak DB connections: total / API / active / wait-event | Committed transactions | Rollbacks | Disk blocks read | Temp files / bytes | Deadlocks |
|---|---:|---:|---:|---:|---:|---:|
| All Pro / 10 (0/10) | 12 / 10 / 7 / 7 | 5,530 | 0 | 22 | 0 / 0 | 0 |
| All Pro / 15 (0/15) | 12 / 10 / 2 / 2 | 7,406 | 0 | 0 | 0 / 0 | 0 |
| All Pro / 20 (0/20) | 12 / 10 / 8 / 8 | 8,148 | 0 | 0 | 0 / 0 | 0 |
| Mixed / 10 (5/5) | 12 / 10 / 1 / 1 | 6,129 | 0 | 0 | 0 / 0 | 0 |
| Mixed / 15 (8/7) | 12 / 10 / 1 / 1 | 7,325 | 0 | 0 | 0 / 0 | 0 |
| Mixed / 20 (10/10) | 12 / 10 / 10 / 10 | 8,172 | 0 | 0 | 0 / 0 | 0 |

All six stages had zero unexpected HTTP/network failures, response-validation failures, and throttled responses. At 20 users the mixed cohort averaged about 1,576 requests per minute, below the configured 1,800-request shared-IP limit. This is the highest tested point, not a production capacity guarantee. The JSON results contain the complete per-endpoint latency, failure, throttle, status, and database measurements for each stage, with endpoint metrics split by membership tier.

## Snapshot profiling and historical comparison

The previous all-Pro 20-session run measured `GET /api/market/snapshot` at **2,676.0 ms p95 / 3,354.4 ms p99**. The latest all-Pro and mixed runs measured **1,807.6 / 1,945.0 ms** and **1,458.1 / 1,707.1 ms**, respectively. An instrumented run before the change measured **2,929.8 / 3,450.9 ms**; its largest route phases were signal evaluation (**2,380.7 ms p95 / 2,873.0 ms p99**) and quote gathering (**862.6 / 939.3 ms**). Membership lookup and response shaping were small by comparison.

The route now shares an active market-data calculation among overlapping snapshot requests in the same API process. It does not retain completed calculations: each request still gets fresh market data, looks up its own membership, and applies its own market-tier and customer-data filters.

Earlier 20-session all-Pro runs after the change completed with zero failures and zero HTTP 429 responses. Snapshot latency varied between runs:

| Run | Snapshot p95 / p99 (ms) | Database committed transactions |
|---|---:|---:|
| Recorded baseline | 2,676.0 / 3,354.4 | 17,680 |
| After change, run 1 | 1,370.3 / 1,501.2 | 8,601 |
| After change, run 2 | 3,757.6 / 3,857.7 | 7,897 |

Across those two historical post-change runs, the median of the measured p95 values was **2,564.0 ms**, and the median of the p99 values was **2,679.5 ms**. Historical run 2's transaction delta was 55% below the recorded baseline, although its latency tail was worse. This confirms reduced duplicate market work but also shows meaningful run-to-run tail variation; the current all-Pro and mixed results are single runs and are not a latency guarantee. The full current cohort profiles and endpoint measurements are in [customer-api-load-test-results.json](./customer-api-load-test-results.json).

Historical pre-change transaction deltas were 9,427 / 13,160 / 17,680 for 10 / 15 / 20 users; rollback and deadlock deltas were zero. The current stage-by-stage transaction deltas and disk/temp counters are listed above and in the JSON results.

## Reproduce

```sh
TRADIFY_LOAD_TEST_NON_PRODUCTION=heliumdb NODE_ENV=development pnpm --filter @workspace/db run test:customer-api-load
```

The script refuses production, verifies the non-replica `heliumdb` development database, creates and drops a uniquely named temporary database, and writes both cohorts' results to `docs/customer-api-load-test-results.json`. Do not change the database guard to allow production targets.

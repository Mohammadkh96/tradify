# MT5 M15 history-recovery candidate

This is a **development candidate**, not an instruction to replace the EA currently attached to a live terminal. The installed EA binary and its inputs have not been inspected; the checked-in source is not evidence that production runs the same version.

## Candidate behavior

- The bridge requests a rolling 10-day M15 range by explicit server-time start/end. It does not generate or interpolate candles.
- A bridge-authenticated API coverage request checks persisted M15 opens against the latest verified `SymbolInfoSessionTrade` schedule for the exact broker symbol. The range is limited to ten days so even a continuously traded market requires at most 960 M15 slots, within the bridge’s 1,000-candle retention.
- An unavailable, stale, mismatched, or invalid schedule fails closed. Expected open-session timestamps absent from storage are returned as coalesced half-open UTC intervals.
- The EA re-requests one missing interval at a time with `CopyRates(symbol, PERIOD_M15, start, stop, rates)`, uploads only broker-returned OHLC, then checks coverage again on a later pass. Range bootstrap and repair batches use `PARTIAL`; the API persists them but does not mark them fully synchronized. A `FULL` M15 batch includes the exact ten-day UTC range, and the API independently verifies stored session-open coverage before setting a full-sync key. Once complete, normal five-bar updates continue and the coverage endpoint is polled on later sweeps.
- EA diagnostics report requested range, returned count, first/last rate times, missing range, accepted count when returned by the API, and HTTP status. The bridge secret is not included in diagnostic messages.

The ten-day window is rolling. It is intended to repeatedly retry recent holes; it is not a one-time repair for history older than the rolling window. Holidays or exceptional closures not represented in the weekly broker session table can leave a range pending. That is intentionally safer than treating an unexplained open-session gap as complete.

## Candidate installation after separate approval

1. On the actual MT5 terminal, use **File → Open Data Folder**. Back up the installed EA source/binary and export its input settings before changing anything. Record the displayed EA name/version and exact broker symbol (including any suffix).
2. Do not infer the installed version from this repository. Compare the installed file and Inputs tab with the approved candidate. Never send `BridgeSecret`, terminal login, or account identifiers in logs or screenshots.
3. Copy the approved candidate source into that terminal’s `MQL5/Experts` folder and compile it in MetaEditor. Confirm there are no compile errors and that the generated binary shows version 1.27. Do not attach it to a live account at this stage.
4. Test only on a demo or otherwise explicitly approved non-production terminal with an API that includes `/api/mt5/bridge/history/coverage` and server-side ten-day FULL verification. Confirm schedule availability, range-copy counts, returned missing intervals, accepted counts, and repeated checks until complete. Any unavailable schedule, HTTP error, or unresolved expected slot means stop and investigate; do not relax the gates.
5. Review the resulting M15 timestamps and OHLC against broker history and the October 6–14 logs. Production installation, configuration changes, and any data repair require separate approval.

## Evidence still required

From **File → Open Data Folder**, provide the relevant date files from `MQL5/Logs` (Experts) and `Logs` (terminal Journal) for October 6–14, 2026. The current EA’s first/last/count lines cannot reveal an internal hole, so also provide a read-only timestamp export from broker `CopyRates` for the affected UTC windows, with the broker server offset noted. A screenshot of the EA name/version and non-secret inputs plus **Tools → Options → Charts** history/chart limits is useful. Redact account identifiers and secrets.

## October 2026 compatibility finding

- The development API registers `POST /api/mt5/bridge/history/coverage`: the router adds `/mt5/bridge/history/coverage`, and the app mounts that router under `/api`.
- A request without credentials returns **401** from the development API, confirming that the route is registered and bridge-authenticated. The isolated-database integration test seeded synthetic, fresh session schedules and candles for EURUSD, EURGBP, and GBPJPY, observed each incomplete interval, inserted each missing test candle, and then observed complete coverage. A stale AUDUSD schedule returned 409. This verifies the API protocol and persistence path, not a compiled EA.
- The current public deployment metadata reports a successful autoscale deployment but does not expose a source commit or API version string. An unauthenticated POST to the coverage route returned **404 `NOT_FOUND`** from both `signals.tradifyapp.com` and `tradify-signals.replit.app`. A registered route would reject this probe with 401 before checking its body. Therefore the deployed service does not expose the coverage route; its exact deployed commit/version cannot be determined from available metadata.
- The v1.26 source uses the expected root URL, `POST`, `/api/mt5/bridge/history/coverage`, `Content-Type: application/json`, `x-bridge-secret`, and JSON `{symbol,startUtc,endUtc}`. Quotes and heartbeat succeeding at that host further argue against a general URL or credential problem. Do not change the URL, secret, or method to work around this 404.
- The v1.27 development candidate is **not compatible for M15 synchronization with the current deployed API**. `SyncM15History` requests coverage before either its initial M15 date-range upload or its normal five-bar update. Any non-200 coverage response returns early; thus HTTP 404 prevents both M15 `FULL` and incremental candle POSTs. Heartbeat, quotes, and other timeframe uploads follow separate paths and may still succeed. The failure is fail-closed, but the terminal must not be treated as providing current M15 history.

## Read-only timestamp and production evidence (15 October 2026)

- The first October export had 805 M15 rows and one ordinary weekend gap. The new March export has 384 rows from `2026-03-05 00:00` through `2026-03-10 23:45`; every `source_time_epoch` exactly matches `source_time_server` interpreted as a UTC-shaped wall clock, and every in-file bar step is 900 seconds. Its only gap is the closed weekend: Friday `2026-03-06 23:45` to Monday `2026-03-09 00:00`, 173,700 seconds.
- Darwinex documents GMT+2 in U.S. winter and GMT+3 during U.S. summer time with New York-close trading hours: [Darwinex Trading Hours in MetaTrader terminals](https://help.darwinex.com/metatrader-time). Applying those date-specific offsets maps Friday's last bar to `2026-03-06 21:45 UTC` and Monday's first bar to `2026-03-08 21:00 UTC`. The raw server-wall gap is 48h15; the mapped UTC gap is 47h15, confirming the +1-hour offset change across the weekend.
- There are no bars on the closed DST Sunday, so this export does not show a candle at the transition instant. It does establish how MT5 encodes the sampled pre/post wall times and supports date-specific conversion; it cannot demonstrate how a broker would represent a bar inside a nonexistent or repeated wall-clock hour. The converter therefore rejects nonexistent or ambiguous local times instead of guessing.
- A read-only production check at 06:44 UTC found one persisted bridge row: `PRIMARY`, server `Darwinex-Demo`, with its last heartbeat and successful quote/candle posts at `2026-10-15 06:00:44 UTC`. No second bridge row or later matching request appeared in the fetched logs. This supports that the demo bridge has been inactive since then; the stale `connected=true` column is not proof that the terminal remains connected, and its offline process state cannot be observed from the API.
- Production evaluation history recorded **411 trusted MT5 signal-generation records** from Oct 6 06:05:59 through Oct 6 12:09:10 UTC. Stored evaluation authority evidence marks these as `PRIMARY`, `HEALTHY`, `APPROVED`, and `seriesReady=true`, across XAUUSD, FX pairs, XAGUSD, UK100, and US500. This confirms MT5-origin signals were generated under approved authority, but the records contain no bridge ID or server name. The Darwinex-Demo source cannot be conclusively tied to those 411 records; it remains a plausible production influence and cannot be ruled out. No MT5 evaluations were recorded after Oct 13 11:23 UTC in the queried window.
- Production candle storage has no bridge provenance. EURGBP and GBPJPY each had 1,000 stored M15 rows with updates around Oct 15 05:26 UTC, but those rows cannot be attributed to one bridge. No production rows or market-authority settings were changed during this investigation.

## Static review and blockers

No MetaEditor compiler is available in this workspace. The observations below are source review only, not a compile result:

- `CopyRates(symbol, PERIOD_M15, start, end - 1, rates)` uses the date-range overload and makes an exclusive end by subtracting one second. `ArraySetAsSeries(rates, true)` is paired with `rates[copied-1]` for the oldest bar and `rates[0]` for the newest; the upload loop walks oldest to newest. The coverage API now returns both UTC interval bounds and their date-aware broker wall-epoch equivalents; the EA uses those equivalents instead of adding the current offset to historical UTC times.
- `CandleTime` treats MT5's numeric timestamp as a naive broker-wall epoch, shifts that civil clock seven hours back to New York wall time, and uses the IANA `America/New_York` timezone rules to map it to UTC. The inverse conversion is used for coverage requests and `CopyRates` bounds. This produces +2 in winter and +3 in U.S. summer without assuming today's offset applies to old bars. Wall times that are nonexistent or ambiguous under New York DST rules fail closed and are not normalized.
- The session data is a weekly `SymbolInfoSessionTrade` schedule, not a dated holiday calendar. Expected UTC session opens are now evaluated with the date-specific server offset. An exceptional holiday represented as open can still leave missing intervals until the schedule changes or those timestamps age out of the rolling window. Under a stable, isolated gap the ten-day window eventually moves past it, but recovery/readiness can be delayed for up to that window; a recurring or schedule-induced gap can keep blocking it.
- Range uploads and repairs use `PARTIAL`, which cannot mark a symbol fully synchronized. `FULL` requires an exact ten-day range and the API verifies every expected session-open M15 slot against stored data before setting the key. An unrecoverable old slot can still delay a full batch, even if newer candles are valid; do not weaken this gate or the existing strategy-quality checks to bypass it.
- Date-range retries are retried on later M15 sweeps after copy/HTTP failures. There is no exponential backoff; an unsupported route can therefore generate repeated 404 diagnostics. The v1.27 candidate does not fall back to the legacy five-bar M15 path on coverage errors, intentionally avoiding a coverage bypass.
- Both candle serializers now format OHLC and quotes using each broker symbol's `SYMBOL_DIGITS`. Verify representative FX, metal, index, and crypto symbols in a compiled demo run.
- The source includes archived v1.23 snapshots behind `TRADIFY_REFERENCE_ARCHIVED_V1_23`. Compile the complete file as a standalone EA with no such custom preprocessor definition; otherwise the archived copies could become active.

## Compile the development candidate on Windows or an MT5 VPS

1. Use a **separate demo/non-production MT5 terminal**. In that terminal choose **File → Open Data Folder** and keep its path separate from the production terminal’s data folder.
2. Back up the currently installed `.ex5` and record its exact input values before any work. Do not use the archived v1.23 source as a substitute for an unknown prior installed binary.
3. Copy the current `TradifyBridge.mq5` development candidate into the demo terminal’s `MQL5/Experts/Tradify` folder. Open that exact file from the demo terminal’s MetaEditor (F4 from the terminal, then open the copied file).
4. Compile with **F7**. Require **0 errors**; inspect and resolve warnings rather than assuming they are harmless. Confirm the output `.ex5` appears next to the source in that demo data folder. Do not copy it to the production terminal.
5. In MetaEditor, record the source path, compile time, and source SHA-256. In PowerShell, record the binary hash with `Get-FileHash -Algorithm SHA256 "<full-path-to-compiled-ex5>"`. Preserve both files with the test record.
6. In MT5, attach only to a demo chart. The candidate reports version 1.27 and prints a build fingerprint at startup. Match that fingerprint, the active terminal data-folder path, and the recorded source/binary hashes; the fingerprint does not replace the hash.
7. `TradifyBackendUrl` is blank by default and the candidate rejects both known production API hosts. Set only an approved non-production API root, a unique demo `BridgeId`, and that environment's bridge secret. For a private Replit development URL, use the optional `ReplitExternalAccessToken` input; it is sent only as an `Authorization: Bearer` header and is never logged. Treat it as a secret, do not export/share EA settings containing it, and leave it blank for other staging hosts. Add only the staging host to **Tools → Options → Expert Advisors → Allow WebRequest for listed URL**. Do not use this candidate with production.

## Safe demo verification checklist

The API integration harness has passed against a disposable database using synthetic broker-shaped fixtures. It has not run a compiled EA or contacted Darwinex. Replit documents that a private development URL can be reached externally using an External Access Token in an `Authorization: Bearer` header; an approved development token and isolated database would be needed for a Windows terminal test. No token has been created or copied into the EA. No external hosting was provisioned. If a dedicated deployment becomes necessary, obtain approval first: Replit documents Autoscale as request/compute billed and Reserved VM as a fixed monthly cost, with the actual price depending on usage and configuration.

On that approved demo environment:

1. Confirm the terminal is signed into the intended demo server; record the exact broker symbols, including suffixes. Set the chart-history limit high enough for the 10-day M15 range (up to 960 bars for continuous markets).
2. Start the isolated API with an empty/test database. Confirm its health endpoint and confirm the unauthenticated coverage probe returns 401, not 404.
3. Attach the v1.27 development candidate with the non-production URL, unique demo `BridgeId`, and non-production secret. Verify `Specs POST 200`, including `MT5_SYMBOL_INFO_SESSION_TRADE`, fresh `serverTime`/`utcTime`, and a complete schedule. Confirm quote/heartbeat success independently.
4. Verify first M15 coverage is incomplete, then confirm the EA requests the ten-day broker range with `CopyRates`. Confirm timestamps and OHLC sent match values returned by that terminal; no interpolation or synthetic candles may appear in the EA payload.
5. In the disposable test database only, remove one expected open-session timestamp. Verify the API returns that exact missing interval, the EA requests it, the repair POST uses `PARTIAL`, and coverage becomes complete before any M15 `FULL` request. Confirm the API withholds readiness for an incomplete ten-day `FULL` claim, accepts a complete ten-day range, then verify a later five-bar update.
6. Make the test schedule stale, invalid, offset-mismatched, and incomplete in separate runs. Each must fail closed, keep `FULL`/M15 readiness unset, and never invent a candle. Test a weekend closure, an overnight session, a broker holiday, and a range spanning the broker’s DST transition.
7. Inject a temporary route failure/404 and an unavailable-history result in the isolated test environment. Confirm the EA retries on a later sweep, continues to log the error, and does not post M15 `FULL` or five-bar updates while coverage is unavailable. Confirm recovery after the test endpoint is restored.
8. Compare persisted UTC timestamps with the exported source timestamps across the March transition. Confirm nonexistent/ambiguous wall times fail closed. Keep strategy quality and authority checks unchanged; do not infer readiness merely from candle count.

## Read-only timestamp export

`ExportM15Timestamps.mq5` is a read-only Script. It copies M15 timestamps for the exact symbol entered in `BrokerSymbol` and writes the raw broker-source epoch, server-formatted time, and gap seconds to `MQL5/Files/Tradify_EURUSD_M15_20261006_14.csv`. The default server-time range includes a buffer around October 6–14 UTC; the timestamps are not converted to UTC by the script. Confirm the broker offset separately before comparing them with UTC gap windows.

1. In the demo terminal, open its data folder and copy the script to `MQL5/Scripts`.
2. Open it in MetaEditor and compile with F7; require 0 errors.
3. Set `BrokerSymbol` to the exact Market Watch name (for example `EURUSD.a` if that is Darwinex’s symbol), and adjust `StartServerTime`/`EndServerTime` to bracket the UTC dates using the broker’s documented/observed server calendar. For transition evidence, request **2026-03-07 00:00 through 2026-03-10 23:59 server time** (Darwinex's spring switch from GMT+2 to GMT+3), and confirm the export actually contains the changed offset and any repeated/ambiguous wall-clock representation before drawing conclusions.
4. Run the script from Navigator → Scripts on a demo chart. It makes no WebRequest and writes no candle data; its only output is the local CSV in that terminal’s `MQL5/Files` folder.
5. If it reports a history-load timeout or zero bars, first open the symbol’s M15 chart and request/download history, then rerun. Do not treat an empty export as proof of a market closure.

## Collecting logs safely

In the relevant MT5 terminal choose **File → Open Data Folder**:

- Copy the requested date files from `MQL5/Logs` (EA/Experts activity) and `Logs` (terminal Journal).
- Include the lines for `Specs POST`, coverage request/status, `RANGE COPY`, `RANGE RESULT`, `RANGE POST`, and the earlier quote/heartbeat results. Preserve timestamps and error/status codes.
- Redact account/login numbers, investor passwords, bridge-secret values, API keys, session tokens, and any unrelated customer identifiers. Do not redact the EA version, broker server name, symbol suffix, request path, HTTP status, timestamps, or the server UTC offset needed for diagnosis.
- Include the CSV from the diagnostic script and note the terminal’s broker UTC offset / DST behavior and **Tools → Options → Charts → Max bars in chart** value.

## Coordinated deployment and rollback

Do not deploy the current candidate. First compile it, complete the demo checklist, validate date-aware timezone behavior on the real terminal, and verify the partial-history/readiness contract. Then, after separate approval:

1. Publish the API release containing the coverage route and compatible schedule/range semantics first. Do not publish the customer PWA as part of the test.
2. Probe every production API host without credentials: the route should return 401 (route registered/auth required), not 404. Then perform authenticated end-to-end verification only on the approved non-production API/database.
3. Take a backup of the installed EA binary and inputs. Install the compiled, hashed EA only in the explicitly approved terminal and verify its version/fingerprint and API host before considering any production terminal.
4. Monitor coverage, range results, accepted counts, and continuity. Do not promote if any schedule/timezone uncertainty, 404, unresolved gap, or compile warning remains.
5. If rollback is needed, detach the candidate EA, restore the exact backed-up prior `.ex5` and input values, restart that terminal’s EA, and verify quote, heartbeat, and candle responses. Roll back the API to its previously published build through the deployment rollback controls if its release is implicated. Recheck coverage/quality gates; never compensate by loosening them or backfilling production.

No production EA, API deployment, database, DNS, or candle history was changed for this review.

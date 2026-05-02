# MT5 Bridge Wizard — Manual QA Checklist

This document describes how to manually verify the 6-step `/mt5-bridge`
wizard end-to-end against a real MetaTrader 5 terminal. It is the
companion to the automated sandbox-mode test in
`scripts/test-mt5-bridge.ts`, which exercises the same backend
contract without requiring a live MT5 install.

## When to run this

Before any release that touches one of:

- `client/src/pages/MT5Bridge.tsx`
- `client/src/lib/mt5ConnectorScript.ts`
- `server/routes.ts` — `/api/mt5/sync` or `/api/mt5/status/:userId`
- `server/traders-hub.ts` — `/api/traders-hub/generate-token`

Also run after upgrading the `MetaTrader5` Python package or when
changing the desktop connector UI.

## Prerequisites

- A Windows or macOS machine with MetaTrader 5 installed and logged
  into a demo or live trading account.
- Python 3.8+ on PATH. The `.pyw` connector self-installs the
  `MetaTrader5` and `requests` packages on first run; on macOS the
  `MetaTrader5` install will fail (Windows-only) — that's expected and
  the connector will surface a clear error.
- A Tradify test account that can log in and reach `/mt5-bridge`.
- The Tradify server running (production URL or local
  `npm run dev` exposed via tunnel/Replit URL — the connector hits the
  same origin you used to download it, so make sure it is reachable
  from the trading machine).

## Checklist

Tick each item as you go. If any step fails, capture the connector log
output (the activity log at the bottom of the connector window) and
the browser console for the wizard page.

### Step 1 — Get started
- [ ] Navigate to `/mt5-bridge` while logged in.
- [ ] Header reads "Connect MT5", status pill shows
      `NOT CONNECTED` (assuming no recent sync within 45s).
- [ ] Stepper shows step 1 of 6 highlighted.
- [ ] Click **Start setup** — wizard advances to step 2.

### Step 2 — Generate token
- [ ] If no token yet, click **Generate Token**. A 24-character token
      appears in a green box.
- [ ] **Copy** copies the token to the clipboard (toast confirms).
- [ ] **Regenerate** issues a new token and invalidates the previous
      one (verified in step 4 below).
- [ ] **Continue** is only enabled once a token exists.

### Step 3 — Download connector
- [ ] **Download connector** downloads `tradify_connector.pyw`
      (~22 KB, plain text).
- [ ] Open the downloaded file in a text editor and confirm:
      - `USER_ID = "<your user id>"`
      - `SYNC_TOKEN = "<the token from step 2>"`
      - `API_URL = "https://<this host>/api/mt5/sync"`
      None of the `__TRADIFY_*__` placeholders should remain.
- [ ] **Copy script** alternative path also writes the populated
      script to the clipboard.

### Step 4 — Run the connector
- [ ] On Windows: double-click `tradify_connector.pyw` — no console
      window appears, the Tradify connector GUI opens.
- [ ] First run installs `MetaTrader5` and `requests` quietly; if it
      cannot install, an actionable red log entry appears.
- [ ] With MT5 open and logged in, click **Start sync**:
      - Status flips to `CONNECTED` (green dot)
      - Account, broker, balance, equity populate within a few seconds
      - Activity log reports `Synced | Equity: …` once per 10 seconds
- [ ] If you regenerated the token in step 2, the connector should
      log `Auth error: Invalid or expired token` (HTTP 403). Paste the
      new token (re-download or re-copy) and verify it recovers.

### Step 5 — Verify connection (wizard)
- [ ] Within ~10 seconds of the connector reporting its first
      successful sync, the wizard auto-advances from step 5
      (Verify connection) to step 6 (You're live).
- [ ] Status pill at the top of the wizard shows `CONNECTED`.

### Step 6 — You're live
- [ ] Balance and equity tiles match what the connector window
      shows.
- [ ] The auto-redirect timer counts down to 0 and lands on the
      dashboard. **Go to dashboard** also works on demand.
- [ ] On the dashboard, the most recent closed trades from MT5
      history appear in the journal (closed deals only — open
      positions are tracked separately under MT5 metrics).

### Negative paths
- [ ] **Stale connector.** Stop the connector for >45 seconds — the
      wizard's status pill flips back to `NOT CONNECTED`.
- [ ] **No MT5 logged in.** Quit MT5 and click **Start sync** — the
      connector logs `MT5 init failed` and `Ensure MT5 is open and
      logged in.` and the toggle button is re-armed (no zombie state).
- [ ] **Wrong token.** Manually edit the `.pyw` to break the token,
      run it — first sync responds with HTTP 403 and the connector
      log directs the user back to the wizard.

## Reporting

Open a bug ticket with the failing checkbox(es), the connector
activity log, and the browser console output for the wizard. Attach
the populated `.pyw` (with the `SYNC_TOKEN` line redacted).

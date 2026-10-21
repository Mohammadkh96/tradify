# Tradify MetaTrader 5 (MT5) Development Market-Data Bridge Setup Guide

This guide covers the development-only MT5 market-data bridge. The active source is `artifacts/tradify-signals/reference/TradifyBridge.mq5` version 1.27. Older v1.23 snapshots remain in that file for reference, behind `TRADIFY_REFERENCE_ARCHIVED_V1_23`; do not define that macro for normal builds.

The bridge sends quotes, candle history, broker-symbol specifications, and broker server/company labels in its heartbeat. It does **not** send customer account login identifiers or credentials, positions, orders, deals, or trading history, and it does not place trades.

---

## 1. Overview Architecture

```
[ A Broker ]
       │ Ticks & Rates
       ▼
[ MT5 Terminal ]
       │
       │ TradifyBridge.mq5 (EA)
       ▼ HTTPS WebRequest (100ms default quote interval / 5s heartbeat / candle sync)
[ Approved non-production Tradify API ]
       │
       ▼ Shared primary MT5 market-data feed
[ Tradify Signals ]
       │
       └─ No account-specific feed isolation in this bridge
```

---

## 2. Step-by-Step Installation Instructions

### Step 1: Open MetaEditor
1. Launch MetaTrader 5 on your Windows machine and log into the broker account used for this authorized development feed.
2. Press `F4` or select **Tools -> MetaQuotes Language Editor** to open MetaEditor.

### Step 2: Create `TradifyBridge.mq5`
1. In MetaEditor, navigate to the **Navigator** panel on the left.
2. Expand `MQL5` -> Right-click `Experts` -> Select **New File**.
3. Choose **Expert Advisor (template)** -> Name it `TradifyBridge`.
4. Copy the entire content of `artifacts/tradify-signals/reference/TradifyBridge.mq5` into MetaEditor. The v1.27 candidate is the active source; leave `TRADIFY_REFERENCE_ARCHIVED_V1_23` undefined.

### Step 3: Compile the EA
1. Press `F7` or click the **Compile** button at the top toolbar.
2. Ensure the bottom **Errors** tab shows **0 errors, 0 warnings**. Confirm the Experts log prints the v1.27 build fingerprint.
3. This workspace does not include MetaEditor, so a successful source review here is not a substitute for compiling the EA in MetaEditor.

### Step 4: Configure MT5 WebRequest Permissions (CRITICAL)
Before MT5 can send HTTP/HTTPS requests to the Tradify backend:
1. In MetaTrader 5, go to **Tools -> Options** (or press `Ctrl+O`).
2. Click the **Expert Advisors** tab.
3. Check **Allow WebRequest for listed URL**.
4. Double-click **<add new URL...>** and enter only the approved non-production API root for this development test.
   Do not point this development candidate at a production URL. It explicitly blocks the known Tradify production hosts.
5. Click **OK** to save.

### Step 5: Attach the development EA to one chart
1. Return to MetaTrader 5 main window.
2. Open **ANY single chart** (e.g. `XAUUSD` or `EURUSD`).
3. In the **Navigator** panel (`Ctrl+N`), expand **Expert Advisors** and drag `TradifyBridge` onto the chart.
4. In the **Inputs** tab, verify or update the parameters:
    - `TradifyBackendUrl`: the active isolated development API root, `https://<REPLIT_DEV_DOMAIN>:3000` (do not add `/api`; the EA adds its API paths)
    - `BridgeSecret`: copy the exact `MT5_DEV_BRIDGE_SECRET` value from Replit Secrets for this isolated development API; never use the production `MT5_BRIDGE_SECRET` or `SESSION_SECRET`
    - `BridgeId`: a descriptive development label, such as `dev-laptop-primary`
     - `TargetSymbols`: `XAUUSD,USTEC,US30,US500,EURUSD,GBPUSD,BTCUSDT,ETHUSDT` *(All 8 target symbols collected simultaneously from ONE chart!)*
    - `PublishIntervalMs`: `100` (the v1.27 default; this sets the quote-publish interval in milliseconds)
     - `CandleSyncSec`: `15`
    - `ReplitExternalAccessToken`: leave blank unless Replit blocks the private development URL. If required, use only a Replit-generated Development-scoped External Access Token from Publishing -> Adjust settings -> Security -> External access tokens. It is sent as an `Authorization: Bearer` header; never use `SESSION_SECRET`, commit, log, or share it.
5. Click **OK**. The EA selects the configured symbols and uses `SymbolInfoTick()` for quotes and `CopyRates()` for candles. One EA instance publishes all configured symbols.
6. Ensure **Algo Trading** button on top toolbar is enabled (green icon).
7. Look at the chart top-right corner — you should see a hat icon indicating the EA is running.

---

## 3. Verify the development feed in Tradify Admin

1. Open the development Tradify app and click the **Admin** icon at the header.
2. Locate the **MetaTrader 5 Bridge Controller** panel.
3. Verify:
   - **Status Badge**: `● CONNECTED` (Green)
   - **Server Name**: Displays your broker's server name (e.g., `ICMarkets-Demo`).
   - **Last Heartbeat**: `1s ago` or `2s ago`.
   - **Discovered Symbols**: Displays count of broker market watch symbols.

---

## 4. Map Broker Symbols in Tradify Admin

Brokers name instruments differently (e.g., `XAUUSD`, `GOLD`, `XAUUSD.a`, `USTEC`, `NAS100`, `US30.a`).

1. In **Tradify Admin -> Broker Symbol Mapping Setup**:
   - For **XAUUSD**: Select your broker's exact Gold symbol from the dropdown.
   - For **US100**: Select your broker's Nasdaq symbol (e.g., `USTEC` or `NAS100`).
   - For **US30**: Select your broker's Dow symbol (e.g., `US30` or `DJI`).
   - For **US500**: Select your broker's S&P 500 symbol (e.g., `US500` or `SPX500`).
2. Click **Save Symbol Mappings**.

---

## 5. Development verification checklist

- [ ] Admin shows a fresh heartbeat for the expected development bridge.
- [ ] Quotes advance with fresh MT5 tick timestamps for mapped symbols.
- [ ] M15 and requested chart-timeframe candles arrive with valid timestamps and OHLC values.
- [ ] Strategy readiness is verified separately; chart or quote availability alone does not establish trusted strategy history.
- [ ] Disconnect handling is tested in the development environment before relying on it.

---

## 6. Isolation and production boundary

The current API stores one shared `PRIMARY` bridge state. `BridgeId` is a status label, not an account-isolation boundary, and the shared bridge secret does not identify an individual customer. Do not connect customer terminals or treat this feed as “My MT5 Signals.” Do not use this development candidate for production migration. Customer-specific signals require a separately designed, permission-scoped data path and per-account storage/evaluation.

Do not put bridge secrets or preview tokens in source files, logs, screenshots, or shared documentation. Configure them only in the local EA inputs and approved workspace secret flow.

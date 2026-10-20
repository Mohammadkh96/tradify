# Tradify Journal MT5 Market Data — Development Scope

**Status:** Journal-side development implementation only. This document is not an approved Journal↔Signals market-data contract.

## What is implemented

- The desktop MT5 connector discovers broker-specific instruments using the connected terminal's `symbols_get()` catalogue. It also discovers available MetaTrader timeframes from the installed connector library. Broker suffixes and prefixes are preserved; the connector does not assume that every broker calls an instrument `XAUUSD` or `EURUSD`.
- Market-data capture is off by default. A user must enable it in the connector and select instruments. Live quotes are read only for those selected instruments during the connector's existing 10-second sync cycle. The development endpoint accepts up to 1,000 selected symbols and quotes per batch.
- Historical candles are fetched only after an explicit connector action, for one selected broker symbol and timeframe, with a maximum of 500 bars per request. Repeated requests upsert the same account/symbol/timeframe/open-time key rather than duplicating cached bars.
- The initial synthetic validation instruments are `XAUUSD` and `EURUSD`; tests also use broker-specific examples such as `XAUUSD.a` and `EURUSD.pro`.
- Each record carries `tradify-mt5-market-data-v1`, the fixed source type `customer_mt5`, and the exact broker symbol. Symbol description, path, base/profit currencies, digits, point, and tick size are retained as mapping metadata. No canonical symbol is guessed.
- Quotes preserve the broker source timestamp and the server receive timestamp. The owner-scoped read API returns both ages and marks a quote fresh only when its source time is no more than 30 seconds old (allowing up to five minutes of broker clock skew). The selected-symbol heartbeat is considered live for 30 seconds. Strategy consumers must reject stale prices; this Journal implementation does not calculate signals.
- Records are isolated by Journal user and MT5 account. The connector authenticates with that user's existing MT5 sync token; it does not submit broker passwords. Deleting the MT5 account or Journal user also removes its market-data records.
- Existing `/api/mt5/sync` all-symbol trade-history and account synchronization is unchanged.

## Development gate

Both market-data routes require `DEV_MT5_MARKET_DATA_ENABLED=true`, `NODE_ENV=development` or `test`, and `APP_ENV` not equal to `production`. The gate is false by default and cannot be enabled in production. Market-data requests are separate from the existing trade-history sync.

Apply `migrations/0004_mt5_market_data_v1.sql` only to an approved isolated development/test database. It has not been applied to production or Neon.

## Local Journal endpoints

- `POST /api/mt5/market-data/sync`: accepts authenticated `live` quote batches or explicit `history` batches. The route validates the version, source account, selected-symbol membership, timeframe, OHLC consistency, batch sizes, and existing MT5 account ownership.
- `GET /api/mt5/market-data/:userId/:accountNumber`: requires a normal Journal session and owner match; returns only that owner's symbol metadata, quotes, and cached bars. `symbol`, `timeframe`, and `limit` are optional filters.

These endpoints are Journal-local. They do not authenticate Signals or expose a service-to-service data feed.

## Not implemented / requires separate agreement

1. **Tradify reference feed:** This repository has no separate service identity or approved credential for the reference MT5 bridge. The endpoint accepts only `customer_mt5`; it cannot impersonate a reference source.
2. **Signals integration:** Signals owns its strategy engine and subscriptions. No Signals code or endpoint was changed, and no Journal market data is sent there. A jointly accepted contract must define consent, service authentication, selected-feed authorization, subscription gating, revocation, retention, and failure behavior before any cross-service transfer.
3. **Shared account linking:** The approved account-linking contract excludes MT5 accounts, history, and market data. Account linking alone must not be treated as permission to access this feed.
4. **Canonical instrument mapping:** Raw broker names and metadata are retained, but canonical mappings are not inferred. A mapping registry and its owner must be agreed before strategy evaluation uses broker-specific symbols.
5. **Live-terminal validation:** Automated coverage uses synthetic data. A disposable MT5 demo terminal is still needed to validate symbol discovery, broker-specific naming, quote freshness, and historical bar retrieval. No real customer feed has been tested.
6. **Production use:** The development consent text and storage behavior are not approved for production. Production retention, customer consent wording, pricing/subscription eligibility, and operations require separate approval.

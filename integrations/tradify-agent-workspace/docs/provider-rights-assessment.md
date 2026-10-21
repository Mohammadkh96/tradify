# Market-data provider rights assessment

This is a rights-assessment record, not a legal opinion and not an approval
decision. A public or demo API is not treated as permission for commercial
redistribution, customer display, historical storage, or derived signals.

| Provider | Technical/API use | Internal testing | Customer-facing display | Redistribution | Derived signals | Historical storage | Commercial restrictions |
|---|---|---|---|---|---|---|---|
| Current MT5 broker feed | Technically available through the existing bridge; contract terms not reviewed here | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Broker agreement and downstream redistribution terms must be reviewed |
| Binance public market data | Public endpoints are technically usable for the BTCUSDT and ETHUSDT shadow adapter | Unconfirmed until Binance terms and applicable jurisdiction are reviewed | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Do not infer commercial permission from public accessibility |
| Coinbase Exchange public market data | Public Exchange endpoints are technically usable for BTC-USD and ETH-USD shadow comparison | Unconfirmed until Coinbase API and data terms are reviewed | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Review product-specific data rights, attribution, retention, and commercial-use terms |
| Capital.com Demo | Not implemented by policy; public API documentation exists but no account is connected | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | No implementation or production dependency until rights are explicitly confirmed |
| Future FX/metals/index provider | Provider-specific | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Require a written review before approval or customer exposure |

## Approval gate

No provider may move from `SHADOW` / `NOT_APPROVED` to an authoritative role
until the rights review explicitly answers every column for the intended
deployment jurisdiction and product surface. Technical quality is necessary
but does not establish commercial permission.
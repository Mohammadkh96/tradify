BEGIN;

CREATE TABLE IF NOT EXISTS mt5_market_symbols (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  mt5_account_id TEXT NOT NULL,
  broker_symbol TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  base_currency TEXT NOT NULL DEFAULT '',
  profit_currency TEXT NOT NULL DEFAULT '',
  digits INTEGER NOT NULL CHECK (digits BETWEEN 0 AND 16),
  point NUMERIC NOT NULL DEFAULT 0 CHECK (point >= 0),
  tick_size NUMERIC NOT NULL DEFAULT 0 CHECK (tick_size >= 0),
  source_type TEXT NOT NULL DEFAULT 'customer_mt5' CHECK (source_type = 'customer_mt5'),
  schema_version TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mt5_market_symbols_owner_symbol UNIQUE (user_id, mt5_account_id, broker_symbol)
);

CREATE TABLE IF NOT EXISTS mt5_market_quotes (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  mt5_account_id TEXT NOT NULL,
  broker_symbol TEXT NOT NULL,
  bid NUMERIC NOT NULL,
  ask NUMERIC NOT NULL,
  last NUMERIC,
  volume NUMERIC CHECK (volume IS NULL OR volume >= 0),
  source_time TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_type TEXT NOT NULL DEFAULT 'customer_mt5' CHECK (source_type = 'customer_mt5'),
  schema_version TEXT NOT NULL,
  CONSTRAINT mt5_market_quotes_owner_symbol UNIQUE (user_id, mt5_account_id, broker_symbol)
);

CREATE TABLE IF NOT EXISTS mt5_market_bars (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  mt5_account_id TEXT NOT NULL,
  broker_symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN (
    'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M10', 'M12', 'M15', 'M20', 'M30',
    'H1', 'H2', 'H3', 'H4', 'H6', 'H8', 'H12', 'D1', 'W1', 'MN1'
  )),
  open_time TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  tick_volume BIGINT NOT NULL CHECK (tick_volume >= 0),
  spread INTEGER NOT NULL CHECK (spread >= 0),
  real_volume BIGINT NOT NULL CHECK (real_volume >= 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_type TEXT NOT NULL DEFAULT 'customer_mt5' CHECK (source_type = 'customer_mt5'),
  schema_version TEXT NOT NULL,
  CONSTRAINT mt5_market_bars_valid_ohlc CHECK (
    high >= low AND high >= open AND high >= close AND low <= open AND low <= close
  ),
  CONSTRAINT mt5_market_bars_owner_symbol_tf_time
    UNIQUE (user_id, mt5_account_id, broker_symbol, timeframe, open_time)
);

COMMIT;

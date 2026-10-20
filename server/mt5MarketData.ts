import { z } from "zod";

export const MT5_MARKET_DATA_VERSION = "tradify-mt5-market-data-v1" as const;
export const MT5_MARKET_DATA_SOURCE = "customer_mt5" as const;
export const MT5_MARKET_DATA_MAX_SYMBOLS = 1_000;
export const MT5_MARKET_DATA_MAX_QUOTES = 1_000;
export const MT5_MARKET_DATA_MAX_BARS = 500;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60_000;

export const MT5_TIMEFRAMES = [
  "M1", "M2", "M3", "M4", "M5", "M6", "M10", "M12", "M15", "M20", "M30",
  "H1", "H2", "H3", "H4", "H6", "H8", "H12", "D1", "W1", "MN1",
] as const;

const finiteNumber = z.number().finite();
const boundedText = (max: number) =>
  z.string().trim().max(max).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Control characters are not allowed");
const brokerSymbol = z.string().trim().min(1).max(64)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Control characters are not allowed");

const marketSymbolSchema = z.object({
  symbol: brokerSymbol,
  description: boundedText(160).optional().default(""),
  path: boundedText(160).optional().default(""),
  baseCurrency: boundedText(16).optional().default(""),
  profitCurrency: boundedText(16).optional().default(""),
  digits: z.number().int().min(0).max(16),
  point: finiteNumber.min(0).optional().default(0),
  tickSize: finiteNumber.min(0).optional().default(0),
}).strict();

const marketQuoteObjectSchema = z.object({
  symbol: brokerSymbol,
  bid: finiteNumber,
  ask: finiteNumber,
  last: finiteNumber.nullable().optional().default(null),
  volume: finiteNumber.min(0).nullable().optional().default(null),
  timeMs: z.number().int().positive().refine(
    (value) => value <= Date.now() + MAX_FUTURE_CLOCK_SKEW_MS,
    "Quote time cannot be more than five minutes in the future",
  ),
}).strict();

const marketQuoteSchema = marketQuoteObjectSchema.superRefine((quote: z.infer<typeof marketQuoteObjectSchema>, ctx) => {
  if (quote.ask < quote.bid) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ask"], message: "ask must not be below bid" });
  }
});

const marketBarObjectSchema = z.object({
  symbol: brokerSymbol,
  timeframe: z.enum(MT5_TIMEFRAMES),
  time: z.number().int().positive().refine(
    (value) => value * 1000 <= Date.now() + MAX_FUTURE_CLOCK_SKEW_MS,
    "Bar time cannot be more than five minutes in the future",
  ),
  open: finiteNumber,
  high: finiteNumber,
  low: finiteNumber,
  close: finiteNumber,
  tickVolume: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  spread: z.number().int().min(0).max(2_147_483_647),
  realVolume: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict();

const marketBarSchema = marketBarObjectSchema.superRefine((bar: z.infer<typeof marketBarObjectSchema>, ctx) => {
  if (bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close) || bar.high < bar.low) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["high"], message: "OHLC values are inconsistent" });
  }
});

const mt5MarketDataPayloadObjectSchema = z.object({
  userId: z.string().trim().min(1).max(254),
  token: z.string().trim().min(1).max(512),
  accountNumber: z.string().trim().min(1).max(64),
  version: z.literal(MT5_MARKET_DATA_VERSION),
  captureEnabled: z.literal(true),
  captureMode: z.enum(["live", "history"]),
  symbols: z.array(marketSymbolSchema).max(MT5_MARKET_DATA_MAX_SYMBOLS),
  quotes: z.array(marketQuoteSchema).max(MT5_MARKET_DATA_MAX_QUOTES),
  bars: z.array(marketBarSchema).max(MT5_MARKET_DATA_MAX_BARS),
}).strict();

export const mt5MarketDataPayloadSchema = mt5MarketDataPayloadObjectSchema.superRefine((
  payload: z.infer<typeof mt5MarketDataPayloadObjectSchema>,
  ctx,
) => {
  const symbols = new Set<string>();
  payload.symbols.forEach((item, index) => {
    if (symbols.has(item.symbol)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["symbols", index, "symbol"], message: "Duplicate broker symbol" });
    }
    symbols.add(item.symbol);
  });

  for (const [key, values] of [["quotes", payload.quotes], ["bars", payload.bars]] as const) {
    values.forEach((item, index) => {
      if (!symbols.has(item.symbol)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key, index, "symbol"],
          message: "Market data must belong to a symbol in this enabled-symbol batch",
        });
      }
    });
  }

  if (payload.captureMode === "live" && payload.bars.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bars"], message: "Live batches cannot include historical bars" });
  }
  if (payload.captureMode === "history") {
    if (payload.symbols.length !== 1 || payload.quotes.length !== 0 || payload.bars.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["captureMode"],
        message: "History batches must contain one symbol, historical bars, and no live quotes",
      });
    }
    const timeframes = new Set(payload.bars.map((bar) => bar.timeframe));
    if (timeframes.size > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bars"], message: "Fetch one timeframe per history batch" });
    }
  }
});

export type Mt5MarketDataPayload = z.infer<typeof mt5MarketDataPayloadSchema>;

export function isDevMt5MarketDataEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const appEnv = env.APP_ENV?.toLowerCase();
  return (
    (env.NODE_ENV === "development" || env.NODE_ENV === "test") &&
    (!appEnv || appEnv === "development" || appEnv === "test") &&
    env.DEV_MT5_MARKET_DATA_ENABLED === "true"
  );
}

type QueryResult = { rowCount?: number | null; rows?: unknown[] };
export type MarketDataQueryClient = {
  query: (text: string, values?: unknown[]) => Promise<QueryResult>;
};

function valuesSql(rows: unknown[][]): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const placeholders = row.map((value) => {
      values.push(value);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  return { sql: tuples.join(", "), values };
}

export async function persistMt5MarketData(
  client: MarketDataQueryClient,
  userId: string,
  accountNumber: string,
  payload: Mt5MarketDataPayload,
): Promise<void> {
  if (payload.captureMode === "live") {
    await client.query(
      `UPDATE mt5_market_symbols
          SET is_enabled = FALSE, updated_at = now()
        WHERE user_id = $1 AND mt5_account_id = $2 AND is_enabled = TRUE`,
      [userId, accountNumber],
    );
  }

  if (payload.symbols.length > 0) {
    const rows = payload.symbols.map((symbol) => [
      userId,
      accountNumber,
      symbol.symbol,
      symbol.description,
      symbol.path,
      symbol.baseCurrency,
      symbol.profitCurrency,
      symbol.digits,
      String(symbol.point),
      String(symbol.tickSize),
      MT5_MARKET_DATA_SOURCE,
      MT5_MARKET_DATA_VERSION,
      payload.captureMode === "live",
    ]);
    const batch = valuesSql(rows);
    await client.query(
      `INSERT INTO mt5_market_symbols
        (user_id, mt5_account_id, broker_symbol, description, path, base_currency,
         profit_currency, digits, point, tick_size, source_type, schema_version, is_enabled)
       VALUES ${batch.sql}
       ON CONFLICT (user_id, mt5_account_id, broker_symbol) DO UPDATE SET
         description = EXCLUDED.description,
         path = EXCLUDED.path,
         base_currency = EXCLUDED.base_currency,
         profit_currency = EXCLUDED.profit_currency,
         digits = EXCLUDED.digits,
         point = EXCLUDED.point,
         tick_size = EXCLUDED.tick_size,
         source_type = EXCLUDED.source_type,
         schema_version = EXCLUDED.schema_version,
         is_enabled = CASE WHEN $${batch.values.length + 1}::boolean
                           THEN EXCLUDED.is_enabled
                           ELSE mt5_market_symbols.is_enabled END,
          last_seen_at = CASE WHEN $${batch.values.length + 1}::boolean
                              THEN now()
                              ELSE mt5_market_symbols.last_seen_at END,
         updated_at = now()`,
      [...batch.values, payload.captureMode === "live"],
    );
  }

  if (payload.quotes.length > 0) {
    const rows = payload.quotes.map((quote) => [
      userId,
      accountNumber,
      quote.symbol,
      String(quote.bid),
      String(quote.ask),
      quote.last === null ? null : String(quote.last),
      quote.volume === null ? null : String(quote.volume),
      new Date(quote.timeMs),
      MT5_MARKET_DATA_SOURCE,
      MT5_MARKET_DATA_VERSION,
    ]);
    const batch = valuesSql(rows);
    await client.query(
      `INSERT INTO mt5_market_quotes
        (user_id, mt5_account_id, broker_symbol, bid, ask, last, volume,
         source_time, source_type, schema_version)
       VALUES ${batch.sql}
       ON CONFLICT (user_id, mt5_account_id, broker_symbol) DO UPDATE SET
         bid = EXCLUDED.bid,
         ask = EXCLUDED.ask,
         last = EXCLUDED.last,
         volume = EXCLUDED.volume,
         source_time = EXCLUDED.source_time,
         source_type = EXCLUDED.source_type,
         schema_version = EXCLUDED.schema_version,
         received_at = now()`,
      batch.values,
    );
  }

  if (payload.bars.length > 0) {
    const rows = payload.bars.map((bar) => [
      userId,
      accountNumber,
      bar.symbol,
      bar.timeframe,
      new Date(bar.time * 1000),
      String(bar.open),
      String(bar.high),
      String(bar.low),
      String(bar.close),
      bar.tickVolume,
      bar.spread,
      bar.realVolume,
      MT5_MARKET_DATA_SOURCE,
      MT5_MARKET_DATA_VERSION,
    ]);
    const batch = valuesSql(rows);
    await client.query(
      `INSERT INTO mt5_market_bars
        (user_id, mt5_account_id, broker_symbol, timeframe, open_time, open, high, low,
         close, tick_volume, spread, real_volume, source_type, schema_version)
       VALUES ${batch.sql}
       ON CONFLICT (user_id, mt5_account_id, broker_symbol, timeframe, open_time) DO UPDATE SET
         open = EXCLUDED.open,
         high = EXCLUDED.high,
         low = EXCLUDED.low,
         close = EXCLUDED.close,
         tick_volume = EXCLUDED.tick_volume,
         spread = EXCLUDED.spread,
         real_volume = EXCLUDED.real_volume,
         source_type = EXCLUDED.source_type,
         schema_version = EXCLUDED.schema_version,
         received_at = now()`,
      batch.values,
    );
  }
}

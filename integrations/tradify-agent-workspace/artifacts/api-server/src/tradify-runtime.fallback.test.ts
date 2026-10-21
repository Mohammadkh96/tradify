import assert from "node:assert/strict";
import {
  aggregateCandles,
  bridgeStore,
  chartTimeframes,
  catalogItem,
  fallbackQuote,
  fallbackCandles,
  getCandles,
  normalizeProviderCandles,
  referenceQuote,
  type Candle,
} from "./tradify-runtime";

const originalFetch = globalThis.fetch;

function makeCandles(count: number, stepSeconds: number): Candle[] {
  const start = Math.floor(1_700_000_000 / (4 * 3600)) * (4 * 3600);
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.1;
    return {
      time: start + index * stepSeconds,
      open: close - 0.2,
      high: close + 0.4,
      low: close - 0.4,
      close,
      volume: 10 + index,
    };
  });
}

function yahooPayload(candles: Candle[]) {
  return {
    chart: {
      result: [
        {
          timestamp: candles.map((candle) => candle.time),
          indicators: {
            quote: [
              {
                open: candles.map((candle) => candle.open),
                high: candles.map((candle) => candle.high),
                low: candles.map((candle) => candle.low),
                close: candles.map((candle) => candle.close),
                volume: candles.map((candle) => candle.volume),
              },
            ],
          },
        },
      ],
    },
  };
}

function binancePayload(candles: Candle[]) {
  return candles.map((candle) => [
    candle.time * 1000,
    String(candle.open),
    String(candle.high),
    String(candle.low),
    String(candle.close),
    String(candle.volume),
  ]);
}

try {
  const source = makeCandles(240, 3600);
  const fetchUrls: string[] = [];
  let invalidBinanceResponse = false;
  let quoteMode = false;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    fetchUrls.push(url);
    if (quoteMode && url.includes("ticker/24hr")) {
      return {
        ok: true,
        json: async () => ({
          lastPrice: "50000",
          prevClosePrice: "49000",
          priceChangePercent: "2.04",
          closeTime: String(Date.now()),
        }),
      } as Response;
    }
    if (quoteMode && url.includes("chart")) {
      const stale = url.includes("%5EN225");
      const sourceTime = Math.floor(Date.now() / 1000) - (stale ? 60 * 60 : 30);
      return {
        ok: true,
        json: async () => ({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 100,
                  chartPreviousClose: 99,
                  regularMarketTime: sourceTime,
                  marketState: "REGULAR",
                },
              },
            ],
          },
        }),
      } as Response;
    }
    if (quoteMode && url.includes("GOLD_SILVER_SPOT")) {
      return {
        ok: true,
        json: async () => ({
          nominal: "1",
          timestamp: new Date().toISOString(),
          price: "4360.25",
        }),
      } as Response;
    }
    if (url.includes("binance")) {
      return {
        ok: true,
        json: async () => (invalidBinanceResponse ? [null, ["invalid"]] : binancePayload(source)),
      } as Response;
    }
    return {
      ok: true,
      json: async () => yahooPayload(source),
    } as Response;
  }) as typeof fetch;

  const normalized = normalizeProviderCandles(
    [source[2], { ...source[1], close: Number.NaN }, source[0], source[2]].map((candle) => ({
      ...candle,
      volume: candle.volume,
    })),
  );
  assert.deepEqual(
    normalized,
    [],
    "duplicate and out-of-order raw bars must be rejected before normalization",
  );

  const aggregated = aggregateCandles(source.slice(0, 8), 4 * 3600);
  assert.equal(aggregated.length, 2);
  assert.equal(aggregated[0].open, source[0].open);
  assert.equal(aggregated[0].close, source[3].close);
  assert.equal(aggregated[0].high, source[3].high);
  assert.equal(aggregated[0].low, source[0].low);
  assert.equal(
    aggregated[0].volume,
    source.slice(0, 4).reduce((sum, candle) => sum + candle.volume, 0),
  );

  const unavailableItem = catalogItem("XAUUSD");
  assert.ok(unavailableItem);
  assert.equal(
    await fallbackCandles(unavailableItem, "M15", 80),
    undefined,
    "spot gold must not use a futures fallback",
  );
  assert.equal(
    await fallbackQuote(unavailableItem),
    undefined,
    "spot gold must be unavailable without a same-class reference",
  );

  const item = catalogItem("US100");
  assert.ok(item);
  for (const timeframe of chartTimeframes) {
    const result = await fallbackCandles(item, timeframe, 80);
    assert.ok(result, `expected Yahoo fallback for ${timeframe}`);
    assert.equal(result.provider, "Yahoo");
    assert.equal(result.providerSymbol, "^NDX");
    assert.ok(result.candles.length >= 50, `expected a complete ${timeframe} fallback series`);
  }
  assert.equal(await fallbackCandles(item, "INVALID", 80), undefined);

  quoteMode = true;
  const freshIndex = await fallbackQuote(item);
  assert.ok(freshIndex);
  assert.equal(freshIndex.referenceState, "REFERENCE");
  assert.equal(freshIndex.referenceBasis, "PREVIOUS_CLOSE");
  assert.equal(freshIndex.changeBasis, "PREVIOUS_CLOSE");
  assert.ok((freshIndex.sourceAgeSeconds ?? Infinity) < 60);
  const staleIndex = await fallbackQuote(catalogItem("JP225")!);
  assert.ok(staleIndex);
  assert.equal(staleIndex.referenceState, "STALE");
  assert.equal(staleIndex.referenceCondition, "STALE_SOURCE");
  const cryptoQuote = await fallbackQuote(catalogItem("BTCUSD")!);
  assert.ok(cryptoQuote);
  assert.equal(cryptoQuote.referenceBasis, "USDT");
  assert.equal(cryptoQuote.changeBasis, "24H");
  const goldReference = await referenceQuote(unavailableItem);
  assert.ok(goldReference);
  assert.equal(goldReference.price, 4360.25);
  assert.equal(goldReference.dataState, "FALLBACK");
  assert.equal(goldReference.referenceState, "REFERENCE");
  quoteMode = false;

  const requestCountBeforeCache = fetchUrls.length;
  const cached = await fallbackCandles(item, "M15", 80);
  assert.ok(cached);
  assert.equal(
    fetchUrls.length,
    requestCountBeforeCache,
    "repeated timeframe loads should use the short-lived cache",
  );

  const cryptoItem = catalogItem("BTCUSD");
  assert.ok(cryptoItem);
  for (const timeframe of chartTimeframes) {
    const result = await fallbackCandles(cryptoItem, timeframe, 80);
    assert.ok(result, `expected Binance fallback for ${timeframe}`);
    assert.equal(result.provider, "Binance");
    assert.equal(result.providerSymbol, "BTCUSDT");
    assert.ok(
      result.candles.length >= 50,
      `expected a complete Binance ${timeframe} fallback series`,
    );
  }
  invalidBinanceResponse = true;
  assert.equal(
    await fallbackCandles(catalogItem("ETHUSD")!, "M15", 80),
    undefined,
    "invalid provider rows should produce an unavailable result",
  );

  bridgeStore.updateCandles({
    symbol: "US100",
    timeframe: "M15",
    candles: makeCandles(7, 900),
  });
  const display = await getCandles("US100", "M15", 80);
  assert.ok(display);
  assert.equal(display.provider, "Yahoo");
  assert.equal(display.providerSymbol, "^NDX");
  assert.equal(display.dataState, "FALLBACK");
  assert.equal(display.displayOnly, true);

  const recentStart = Math.floor((Date.now() / 1000 - 60 * 900) / 900) * 900 + 3 * 3600;
  bridgeStore.updateCandles({
    symbol: "XAUUSD",
    timeframe: "M15",
    candles: makeCandles(60, 900).map((candle, index) => {
      const { time: _time, ...values } = candle;
      return { ...values, timestamp: String(recentStart + index * 900) };
    }),
  });
  const authoritative = await getCandles("XAUUSD", "M15", 80);
  assert.ok(authoritative);
  assert.equal(authoritative.provider, "MT5");
  assert.equal(authoritative.dataState, "LIVE");
  assert.equal(authoritative.displayOnly, false);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Tradify fallback chart checks passed.");

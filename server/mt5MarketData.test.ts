import { describe, expect, it } from "vitest";
import {
  isDevMt5MarketDataEnabled,
  MT5_MARKET_DATA_VERSION,
  mt5MarketDataPayloadSchema,
} from "./mt5MarketData";

const base = {
  userId: "synthetic@example.invalid",
  token: "synthetic-token-only",
  accountNumber: "TEST-ACCOUNT-1",
  version: MT5_MARKET_DATA_VERSION,
  captureEnabled: true,
  captureMode: "live" as const,
  symbols: [{
    symbol: "XAUUSD.a",
    description: "Gold spot",
    path: "Metals",
    baseCurrency: "XAU",
    profitCurrency: "USD",
    digits: 2,
    point: 0.01,
    tickSize: 0.01,
  }],
  quotes: [{
    symbol: "XAUUSD.a",
    bid: 2341.25,
    ask: 2341.35,
    last: 2341.3,
    volume: 1,
    timeMs: Date.now(),
  }],
  bars: [],
};

describe("Journal MT5 market-data V1 validation", () => {
  it("accepts dynamically named broker symbols without normalizing away suffixes", () => {
    const parsed = mt5MarketDataPayloadSchema.parse({
      ...base,
      symbols: [{
        ...base.symbols[0],
        symbol: "EURUSD.pro",
        baseCurrency: "EUR",
      }],
      quotes: [{
        ...base.quotes[0],
        symbol: "EURUSD.pro",
      }],
    });
    expect(parsed.symbols[0].symbol).toBe("EURUSD.pro");
    expect(parsed.quotes[0].symbol).toBe("EURUSD.pro");
  });

  it("accepts standard broker timeframes including monthly bars", () => {
    const parsed = mt5MarketDataPayloadSchema.safeParse({
      ...base,
      captureMode: "history",
      symbols: [{ ...base.symbols[0], symbol: "XAUUSD" }],
      quotes: [],
      bars: [{
        symbol: "XAUUSD",
        timeframe: "MN1",
        time: Math.floor(Date.now() / 1000) - 31_536_000,
        open: 1900,
        high: 2100,
        low: 1800,
        close: 2000,
        tickVolume: 10,
        spread: 4,
        realVolume: 0,
      }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts valid negative-price quotes used by some commodity contracts", () => {
    expect(mt5MarketDataPayloadSchema.safeParse({
      ...base,
      symbols: [{ ...base.symbols[0], symbol: "WTI-front" }],
      quotes: [{
        ...base.quotes[0],
        symbol: "WTI-front",
        bid: -2.5,
        ask: -2.25,
        last: -2.4,
      }],
    }).success).toBe(true);
  });

  it("rejects crossed quotes and implausibly future timestamps", () => {
    expect(mt5MarketDataPayloadSchema.safeParse({
      ...base,
      quotes: [{ ...base.quotes[0], bid: 10, ask: 9 }],
    }).success).toBe(false);
    expect(mt5MarketDataPayloadSchema.safeParse({
      ...base,
      quotes: [{ ...base.quotes[0], timeMs: Date.now() + 10 * 60_000 }],
    }).success).toBe(false);
  });

  it("rejects market data for symbols not explicitly enabled in the batch", () => {
    const parsed = mt5MarketDataPayloadSchema.safeParse({
      ...base,
      quotes: [{ ...base.quotes[0], symbol: "EURUSD.pro" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects inconsistent OHLC values and multiple timeframes in one history request", () => {
    const invalidOhlc = mt5MarketDataPayloadSchema.safeParse({
      ...base,
      captureMode: "history",
      symbols: [base.symbols[0]],
      quotes: [],
      bars: [{
        symbol: "XAUUSD.a",
        timeframe: "M1",
        time: Math.floor(Date.now() / 1000) - 60,
        open: 10,
        high: 9,
        low: 8,
        close: 9,
        tickVolume: 1,
        spread: 1,
        realVolume: 0,
      }],
    });
    expect(invalidOhlc.success).toBe(false);

    const mixedTimeframes = mt5MarketDataPayloadSchema.safeParse({
      ...base,
      captureMode: "history",
      quotes: [],
      bars: ["M1", "M5"].map((timeframe) => ({
        symbol: "XAUUSD.a",
        timeframe,
        time: Math.floor(Date.now() / 1000) - 60,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        tickVolume: 1,
        spread: 1,
        realVolume: 0,
      })),
    });
    expect(mixedTimeframes.success).toBe(false);
  });

  it("is fail-closed outside development/test, even if the flag is set", () => {
    expect(isDevMt5MarketDataEnabled({
      NODE_ENV: "production",
      APP_ENV: "production",
      DEV_MT5_MARKET_DATA_ENABLED: "true",
    })).toBe(false);
    expect(isDevMt5MarketDataEnabled({
      NODE_ENV: "development",
      APP_ENV: "prod",
      DEV_MT5_MARKET_DATA_ENABLED: "true",
    })).toBe(false);
    expect(isDevMt5MarketDataEnabled({
      NODE_ENV: "development",
      DEV_MT5_MARKET_DATA_ENABLED: "false",
    })).toBe(false);
    expect(isDevMt5MarketDataEnabled({
      NODE_ENV: "test",
      APP_ENV: "test",
      DEV_MT5_MARKET_DATA_ENABLED: "true",
    })).toBe(true);
  });
});

// Synthetic MT5-format history, not a captured broker feed. The API regression
// passes this exact series through SeriesValidator at this explicit clock.
import fixture from "./trusted-mt5-m15.json";
export const fixtureNowSeconds = fixture.nowSeconds;
const currentBarOpen = Math.floor(fixtureNowSeconds / fixture.intervalSeconds) * fixture.intervalSeconds;

export const trustedM15Candles = Array.from({ length: fixture.closedCandleCount }, (_, index) => ({
  time: currentBarOpen - (fixture.closedCandleCount - index) * fixture.intervalSeconds,
  open: fixture.basePrice + index * fixture.priceStep,
  high: fixture.basePrice + 1 + index * fixture.priceStep,
  low: fixture.basePrice - 1 + index * fixture.priceStep,
  close: fixture.basePrice + 0.5 + index * fixture.priceStep,
  volume: 10 + index,
}));

export const trustedM15Response = {
  symbol: "XAUUSD",
  provider: "MT5",
  providerSymbol: "XAUUSD",
  timeframe: "M15",
  timezone: "UTC",
  candles: trustedM15Candles,
  dataState: "LIVE",
  displayOnly: false,
  validation: { valid: true },
};

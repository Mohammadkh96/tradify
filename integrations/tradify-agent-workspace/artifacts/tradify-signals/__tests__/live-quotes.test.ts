import {
  mergeLiveCandleUpdate,
  mergeMarketCandleSeries,
  mergeLiveQuotes,
  startLiveQuotePolling,
  type LiveQuoteResponse,
} from "../lib/live-quotes";

const liveResponse: LiveQuoteResponse = {
  bridge: { connected: true },
  quotes: {
    XAUUSD: {
      price: 4372.25,
      changePercent: 0.53,
      provider: "MT5",
      brokerSymbol: "XAUUSD.a",
      dataState: "LIVE",
      receivedAt: Date.now(),
    },
  },
};

describe("live quote updates", () => {
  it("updates visible prices without changing signal calculations", () => {
    const signal = {
      id: "signal-xau",
      symbol: "XAUUSD",
      name: "Gold",
      market: "METALS" as const,
      direction: "LONG" as const,
      strategy: "DGv8" as const,
      grade: "A+" as const,
      action: "WAIT",
      price: 4361.84,
      entry: 4363.72,
      stop: 4351.33,
      tp1: 4374.11,
      tp2: 4384.5,
      tp3: 4402.72,
      session: "LONDON",
      age: "06m",
      note: "Validated by M15 strategy data.",
      dataState: "ERROR" as const,
    };
    const watch = {
      symbol: "XAUUSD",
      name: "Gold",
      market: "METALS" as const,
      price: 4361.84,
      change: 0.42,
      open: true,
      alerts: true,
      provider: "MT5",
      dataState: "LIVE" as const,
    };

    const result = mergeLiveQuotes([watch], [signal], liveResponse);

    expect(result.watchlist[0]).toMatchObject({
      price: 4372.25,
      change: 0.53,
      brokerSymbol: "XAUUSD.a",
    });
    expect(result.signals[0]).toMatchObject({
      price: 4372.25,
      entry: 4363.72,
      stop: 4351.33,
      dataState: "ERROR",
    });
  });

  it("marks cached broker watch prices stale when the bridge disconnects", () => {
    const watch = {
      symbol: "XAUUSD",
      name: "Gold",
      market: "METALS" as const,
      price: 4361.84,
      change: 0.42,
      open: true,
      alerts: true,
      provider: "MT5",
      dataState: "LIVE" as const,
    };

    const result = mergeLiveQuotes([watch], [], { bridge: { connected: false }, quotes: {} });

    expect(result.connected).toBe(false);
    expect(result.watchlist[0]).toMatchObject({ price: 4361.84, dataState: "STALE" });
  });

  it("marks an old quote stale even when the API still labels it live", () => {
    const watch = {
      symbol: "XAUUSD",
      name: "Gold",
      market: "METALS" as const,
      price: 4361.84,
      change: 0.42,
      open: true,
      alerts: true,
      dataState: "LIVE" as const,
    };
    const response: LiveQuoteResponse = {
      bridge: { connected: true },
      quotes: {
        XAUUSD: {
          ...liveResponse.quotes.XAUUSD,
          receivedAt: Date.now() - 30_001,
        },
      },
    };

    const result = mergeLiveQuotes([watch], [], response);

    expect(result.connected).toBe(true);
    expect(result.watchlist[0]).toMatchObject({ price: 4361.84, dataState: "STALE" });
  });

  it("does not treat a quote without a receipt timestamp as live", () => {
    const watch = {
      symbol: "XAUUSD",
      name: "Gold",
      market: "METALS" as const,
      price: 4361.84,
      change: 0.42,
      open: true,
      alerts: true,
      dataState: "LIVE" as const,
    };

    const result = mergeLiveQuotes([watch], [], {
      bridge: { connected: true },
      quotes: {
        XAUUSD: {
          ...liveResponse.quotes.XAUUSD,
          receivedAt: undefined,
        },
      },
    });

    expect(result.watchlist[0]).toMatchObject({ price: 4361.84, dataState: "STALE" });
  });

  it("preserves a reference price when the broker stream is offline", () => {
    const watch = {
      symbol: "XAUUSD",
      name: "Gold",
      market: "METALS" as const,
      price: 4361.84,
      change: 0.42,
      open: true,
      alerts: true,
      provider: "Yahoo",
      dataState: "FALLBACK" as const,
    };

    const result = mergeLiveQuotes([watch], [], { bridge: { connected: false }, quotes: {} });

    expect(result.connected).toBe(false);
    expect(result.watchlist[0]).toMatchObject({
      price: 4361.84,
      dataState: "FALLBACK",
      provider: "Yahoo",
    });
  });

  it("does not accept a broker quote when subscriptions are empty", () => {
    const watch = {
      symbol: "XAUUSD",
      name: "Gold",
      market: "METALS" as const,
      price: 4361.84,
      change: 0.42,
      open: true,
      alerts: true,
      provider: "MT5",
      dataState: "LIVE" as const,
    };

    const result = mergeLiveQuotes([watch], [], {
      bridge: { connected: true, activeSymbols: [] },
      quotes: { XAUUSD: { ...liveResponse.quotes.XAUUSD } },
    });

    expect(result.connected).toBe(false);
    expect(result.watchlist[0]).toMatchObject({ dataState: "STALE", price: 4361.84 });
  });

  it("marks a missing symbol stale even when another symbol is live", () => {
    const watchlist = [
      {
        symbol: "XAUUSD",
        name: "Gold",
        market: "METALS" as const,
        price: 4361.84,
        change: 0.42,
        open: true,
        alerts: true,
        dataState: "LIVE" as const,
      },
      {
        symbol: "XAGUSD",
        name: "Silver",
        market: "METALS" as const,
        price: 31.244,
        change: -0.18,
        open: true,
        alerts: false,
        dataState: "LIVE" as const,
      },
    ];

    const result = mergeLiveQuotes(watchlist, [], {
      bridge: { connected: true, activeSymbols: ["XAUUSD", "XAGUSD"] },
      quotes: { XAUUSD: liveResponse.quotes.XAUUSD },
    });

    expect(result.connected).toBe(true);
    expect(result.watchlist).toEqual([
      expect.objectContaining({ symbol: "XAUUSD", dataState: "LIVE" }),
      expect.objectContaining({ symbol: "XAGUSD", dataState: "STALE", price: 31.244 }),
    ]);
  });

  it("recovers a missing symbol when its live quote returns", () => {
    const staleWatch = {
      symbol: "XAGUSD",
      name: "Silver",
      market: "METALS" as const,
      price: 31.244,
      change: -0.18,
      open: true,
      alerts: false,
      dataState: "STALE" as const,
    };

    const result = mergeLiveQuotes([staleWatch], [], {
      bridge: { connected: true },
      quotes: {
        XAGUSD: {
          price: 31.3,
          changePercent: 0.11,
          dataState: "LIVE",
          status: "LIVE",
          receivedAt: Date.now(),
        },
      },
    });

    expect(result.watchlist[0]).toMatchObject({ dataState: "LIVE", price: 31.3, change: 0.11 });
  });

  it("applies same-price quote state transitions instead of treating them as unchanged", () => {
    const watch = {
      symbol: "XAUUSD",
      name: "Gold",
      market: "METALS" as const,
      price: 4372.25,
      change: 0.53,
      open: true,
      alerts: true,
      dataState: "STALE" as const,
    };

    const previous = [watch];
    const result = mergeLiveQuotes(previous, [], {
      bridge: { connected: true },
      quotes: {
        XAUUSD: {
          ...liveResponse.quotes.XAUUSD,
          price: 4372.25,
        },
      },
    });

    expect(result.watchlist).not.toBe(previous);
    expect(result.watchlist[0]).toMatchObject({ price: 4372.25, dataState: "LIVE" });
  });
});

describe("live candle updates", () => {
  const baseSeries = {
    symbol: "XAUUSD",
    provider: "MT5",
    providerSymbol: "XAUUSD.a",
    timeframe: "M15",
    timezone: "UTC",
    dataState: "LIVE",
    displayOnly: false,
    validation: { valid: true },
    candles: [
      { time: 1_700_000_000, open: 100, high: 102, low: 99, close: 101, volume: 10 },
      { time: 1_700_000_900, open: 101, high: 103, low: 100, close: 102, volume: 11 },
    ],
  };

  it("upserts an active broker candle and appends the next completed candle", () => {
    const merged = mergeLiveCandleUpdate(baseSeries, {
      type: "CANDLE_UPDATE",
      symbol: "XAUUSD",
      timeframe: "M15",
      provider: "MT5",
      providerSymbol: "XAUUSD.a",
      dataState: "LIVE",
      candles: [
        { time: 1_700_000_900, open: 101, high: 104, low: 100, close: 103, volume: 17 },
        { time: 1_700_001_800, open: 103, high: 105, low: 102, close: 104, volume: 12 },
      ],
    });

    expect(merged.candles).toHaveLength(3);
    expect(merged.candles[1]).toMatchObject({ high: 104, close: 103, volume: 17 });
    expect(merged.candles[2].time).toBe(1_700_001_800);
  });

  it("does not mix fallback history or another timeframe into a broker series", () => {
    const fallback = {
      ...baseSeries,
      provider: "Yahoo",
      providerSymbol: "GC=F",
      dataState: "FALLBACK",
      displayOnly: true,
    };
    const update = {
      symbol: "XAUUSD",
      timeframe: "M15" as const,
      provider: "MT5",
      providerSymbol: "XAUUSD.a",
      dataState: "LIVE",
      candles: [{ time: 1_700_001_800, open: 103, high: 105, low: 102, close: 104, volume: 12 }],
    };

    expect(mergeLiveCandleUpdate(fallback, update)).toBe(fallback);
    expect(mergeLiveCandleUpdate(baseSeries, { ...update, timeframe: "H1" })).toBe(baseSeries);
  });

  it("replaces a changed provider series instead of appending incompatible candles", () => {
    const fallback = {
      ...baseSeries,
      provider: "Yahoo",
      providerSymbol: "GC=F",
      dataState: "FALLBACK",
      displayOnly: true,
    };
    const refreshed = {
      ...baseSeries,
      candles: [{ time: 1_700_010_000, open: 110, high: 112, low: 109, close: 111, volume: 20 }],
    };

    const merged = mergeMarketCandleSeries(fallback, refreshed);
    expect(merged.candles).toHaveLength(1);
    expect(merged.candles[0].time).toBe(1_700_010_000);
  });

  it("keeps the last broker frame when a refresh returns no candles", () => {
    const emptyRefresh = {
      ...baseSeries,
      candles: [],
      dataState: "ERROR",
      validation: { valid: false, reason: "temporary bridge response" },
    };

    const merged = mergeMarketCandleSeries(baseSeries, emptyRefresh);

    expect(merged.candles).toEqual(baseSeries.candles);
    expect(merged.provider).toBe("MT5");
    expect(merged.dataState).toBe("STALE");
    expect(merged.validation).toEqual(emptyRefresh.validation);
  });
});

describe("live quote polling lifecycle", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not overlap requests and stops after cleanup", async () => {
    jest.useFakeTimers();
    let resolveRequest: ((response: LiveQuoteResponse) => void) | undefined;
    const fetchQuotes = jest.fn(
      () =>
        new Promise<LiveQuoteResponse>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const onQuotes = jest.fn();
    const stop = startLiveQuotePolling(fetchQuotes, onQuotes, 1000);

    expect(fetchQuotes).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2000);
    expect(fetchQuotes).toHaveBeenCalledTimes(1);

    resolveRequest?.(liveResponse);
    await Promise.resolve();
    expect(onQuotes).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(fetchQuotes).toHaveBeenCalledTimes(2);
    stop();
    jest.advanceTimersByTime(5000);
    expect(fetchQuotes).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After and resumes polling with fresh quotes after the pause", async () => {
    jest.useFakeTimers();
    const fetchQuotes = jest
      .fn()
      .mockRejectedValueOnce({
        status: 429,
        headers: { get: (name: string) => (name.toLowerCase() === "retry-after" ? "3" : null) },
      })
      .mockResolvedValueOnce(liveResponse);
    const onQuotes = jest.fn();
    const onRateLimited = jest.fn();
    const stop = startLiveQuotePolling(fetchQuotes, onQuotes, 1000, onRateLimited);

    await jest.advanceTimersByTimeAsync(0);
    expect(fetchQuotes).toHaveBeenCalledTimes(1);
    expect(onRateLimited).toHaveBeenCalledWith(Date.now() + 3000);

    await jest.advanceTimersByTimeAsync(2999);
    expect(fetchQuotes).toHaveBeenCalledTimes(1);
    expect(onQuotes).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchQuotes).toHaveBeenCalledTimes(2);
    expect(onQuotes).toHaveBeenCalledWith(liveResponse);

    stop();
  });

  it("honors an HTTP-date Retry-After value", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
    const retryAt = Date.now() + 5000;
    const fetchQuotes = jest
      .fn()
      .mockRejectedValueOnce({
        status: 429,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "retry-after" ? new Date(retryAt).toUTCString() : null,
        },
      })
      .mockResolvedValueOnce(liveResponse);
    const stop = startLiveQuotePolling(fetchQuotes, jest.fn(), 1000);

    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(4999);
    expect(fetchQuotes).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchQuotes).toHaveBeenCalledTimes(2);

    stop();
  });

  it("uses an increasing fallback delay for repeated 429 responses without Retry-After", async () => {
    jest.useFakeTimers();
    const fetchQuotes = jest
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 });
    const onRateLimited = jest.fn();
    const stop = startLiveQuotePolling(fetchQuotes, jest.fn(), 1000, onRateLimited);

    await jest.advanceTimersByTimeAsync(0);
    expect(fetchQuotes).toHaveBeenCalledTimes(1);
    expect(onRateLimited).toHaveBeenLastCalledWith(Date.now() + 30_000);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(fetchQuotes).toHaveBeenCalledTimes(2);
    expect(onRateLimited).toHaveBeenLastCalledWith(Date.now() + 60_000);

    stop();
  });
});

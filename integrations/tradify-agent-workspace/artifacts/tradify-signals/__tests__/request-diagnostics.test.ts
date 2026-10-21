import {
  ApiError,
  ApiNetworkError,
  ApiTimeoutError,
  customFetch,
  serializeApiRequestError,
  setBaseUrl,
} from "@workspace/api-client-react";

describe("API request diagnostics", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setBaseUrl(null);
  });

  it("serializes the resolved URL, HTTP response, server code, and body", () => {
    const error = new ApiError(
      new Response(
        JSON.stringify({ error: "NO_CANDLE_DATA", message: "No complete candle series" }),
        {
          status: 404,
          statusText: "Not Found",
          headers: { "content-type": "application/json" },
        },
      ),
      { error: "NO_CANDLE_DATA", message: "No complete candle series" },
      {
        method: "GET",
        url: "https://backend.test/api/market/candles?symbol=XAUUSD",
        requestedAt: "2026-08-31T08:00:00.000Z",
      },
    );

    expect(serializeApiRequestError(error, { stage: "CANDLE FETCH" })).toEqual(
      expect.objectContaining({
        stage: "CANDLE FETCH",
        timestamp: "2026-08-31T08:00:00.000Z",
        failureType: "http",
        method: "GET",
        url: "https://backend.test/api/market/candles?symbol=XAUUSD",
        status: 404,
        errorCode: "NO_CANDLE_DATA",
        responseBody: { error: "NO_CANDLE_DATA", message: "No complete candle series" },
      }),
    );
  });

  it("keeps timeout and network failures distinguishable", () => {
    const request = {
      method: "GET",
      url: "https://backend.test/api/market/candles",
      requestedAt: "2026-08-31T08:00:00.000Z",
    };
    expect(
      serializeApiRequestError(new ApiTimeoutError(request, 15000), { stage: "CANDLE FETCH" }),
    ).toEqual(expect.objectContaining({ failureType: "timeout", stage: "CANDLE FETCH" }));
    expect(
      serializeApiRequestError(new ApiNetworkError(request, new TypeError("offline")), {
        stage: "SIGNAL EVALUATION",
      }),
    ).toEqual(
      expect.objectContaining({
        failureType: "network",
        stage: "SIGNAL EVALUATION",
        message: "Network request failed: offline",
      }),
    );
  });

  it("uses the base URL in a network diagnostic from the real fetch wrapper", async () => {
    setBaseUrl("https://backend.test");
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("connection refused"));

    await expect(
      customFetch("/api/market/candles?symbol=XAUUSD", { timeoutMs: 100 }),
    ).rejects.toBeInstanceOf(ApiNetworkError);
    try {
      await customFetch("/api/market/candles?symbol=XAUUSD", { timeoutMs: 100 });
    } catch (error) {
      expect(serializeApiRequestError(error, { stage: "CANDLE FETCH" })).toEqual(
        expect.objectContaining({
          failureType: "network",
          method: "GET",
          url: "https://backend.test/api/market/candles?symbol=XAUUSD",
        }),
      );
    }
  });
});

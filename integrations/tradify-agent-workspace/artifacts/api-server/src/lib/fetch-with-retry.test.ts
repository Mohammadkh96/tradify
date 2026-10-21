import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithRetry } from "./fetch-with-retry";

test("retries a transient upstream failure with a bounded attempt count", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response("temporary failure", { status: 503 })
      : new Response("ok", { status: 200 });
  };

  try {
    const response = await fetchWithRetry(
      "https://upstream.example.test",
      {},
      {
        maxAttempts: 2,
        baseDelayMs: 0,
      },
    );
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not retry rate-limit responses", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("rate limited", { status: 429 });
  };

  try {
    const response = await fetchWithRetry(
      "https://upstream.example.test",
      {},
      {
        maxAttempts: 3,
        baseDelayMs: 0,
      },
    );
    assert.equal(response.status, 429);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("times out each upstream attempt", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) =>
    await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });

  try {
    await assert.rejects(
      fetchWithRetry(
        "https://upstream.example.test",
        {},
        {
          timeoutMs: 10,
          maxAttempts: 1,
        },
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

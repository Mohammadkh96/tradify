const RETRYABLE_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  options: {
    timeoutMs?: number;
    maxAttempts?: number;
    baseDelayMs?: number;
    retryUnsafeMethods?: boolean;
  } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxAttempts = options.maxAttempts ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const method = (init.method ?? "GET").toUpperCase();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
      const response = await fetch(input, { ...init, signal });
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === maxAttempts) return response;
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (attempt === maxAttempts || (init.signal && init.signal.aborted)) throw error;
      const safeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
      if (!safeMethod && !options.retryUnsafeMethods) throw error;
    }

    await delay(baseDelayMs * 2 ** (attempt - 1));
  }

  throw new Error("External request retry loop exhausted.");
}

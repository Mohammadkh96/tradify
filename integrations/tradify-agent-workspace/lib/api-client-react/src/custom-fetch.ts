export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
  /** Abort the request after this many milliseconds and report it as a timeout. */
  timeoutMs?: number;
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";
const DEFAULT_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 *
 * NOTE: This function should never be used in web applications where session
 * token cookies are automatically associated with API calls by the browser.
 */
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Use loose check for URL — some runtimes (e.g. React Native) polyfill URL
// differently, so `instanceof URL` can fail.
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  // Only prepend to relative paths (starting with /)
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
    (mediaType.startsWith("text/") ||
      mediaType === "application/xml" ||
      mediaType === "text/xml" ||
      mediaType.endsWith("+xml") ||
      mediaType === "application/x-www-form-urlencoded"),
  );
}

// Use strict equality: in browsers, `response.body` is `null` when the
// response genuinely has no content.  In React Native, `response.body` is
// always `undefined` because the ReadableStream API is not implemented —
// even when the response carries a full payload readable via `.text()` or
// `.json()`.  Loose equality (`== null`) matches both `null` and `undefined`,
// which causes every React Native response to be treated as empty.
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly requestedAt: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string; requestedAt: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.requestedAt = requestInfo.requestedAt;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;
  readonly requestedAt: string;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string; requestedAt: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
    this.requestedAt = requestInfo.requestedAt;
  }
}

export class ApiTimeoutError extends Error {
  readonly name = "ApiTimeoutError";
  readonly method: string;
  readonly url: string;
  readonly timeoutMs: number;
  readonly requestedAt: string;
  readonly cause: unknown;

  constructor(
    requestInfo: { method: string; url: string; requestedAt: string },
    timeoutMs: number,
    cause?: unknown,
  ) {
    super(`Request timed out after ${timeoutMs}ms: ${requestInfo.method} ${requestInfo.url}`);
    Object.setPrototypeOf(this, new.target.prototype);
    this.method = requestInfo.method;
    this.url = requestInfo.url;
    this.timeoutMs = timeoutMs;
    this.requestedAt = requestInfo.requestedAt;
    this.cause = cause;
  }
}

export class ApiNetworkError extends Error {
  readonly name = "ApiNetworkError";
  readonly method: string;
  readonly url: string;
  readonly requestedAt: string;
  readonly cause: unknown;

  constructor(requestInfo: { method: string; url: string; requestedAt: string }, cause: unknown) {
    const detail = cause instanceof Error && cause.message ? `: ${cause.message}` : "";
    super(`Network request failed${detail}`);
    Object.setPrototypeOf(this, new.target.prototype);
    this.method = requestInfo.method;
    this.url = requestInfo.url;
    this.requestedAt = requestInfo.requestedAt;
    this.cause = cause;
  }
}

export type ApiRequestFailureType =
  "http" | "timeout" | "network" | "parse" | "aborted" | "unknown";

export interface ApiRequestDiagnostic {
  stage?: string;
  timestamp: string;
  failureType: ApiRequestFailureType;
  message: string;
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  errorCode?: string;
  responseBody?: unknown;
}

function errorField(data: unknown, keys: string[]): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Convert every client failure into a safe, UI-friendly diagnostic. The
 * response body is retained for operator troubleshooting, while credentials
 * are never included because request headers are not serialized.
 */
export function serializeApiRequestError(
  error: unknown,
  context: { stage?: string; timestamp?: string } = {},
): ApiRequestDiagnostic {
  const timestamp =
    (error &&
    typeof error === "object" &&
    "requestedAt" in error &&
    typeof error.requestedAt === "string"
      ? error.requestedAt
      : undefined) ??
    context.timestamp ??
    new Date().toISOString();

  if (error instanceof ApiError) {
    const data = error.data;
    const errorCode =
      errorField(data, ["code", "errorCode", "error"]) ??
      (typeof data === "string" ? undefined : undefined);
    return {
      stage: context.stage,
      timestamp,
      failureType: "http",
      message: error.message,
      method: error.method,
      url: error.url,
      status: error.status,
      statusText: error.statusText,
      errorCode,
      responseBody: data,
    };
  }

  if (error instanceof ResponseParseError) {
    return {
      stage: context.stage,
      timestamp,
      failureType: "parse",
      message: error.message,
      method: error.method,
      url: error.url,
      status: error.status,
      statusText: error.statusText,
      responseBody: error.rawBody,
    };
  }

  if (error instanceof ApiTimeoutError) {
    return {
      stage: context.stage,
      timestamp,
      failureType: "timeout",
      message: error.message,
      method: error.method,
      url: error.url,
    };
  }

  if (error instanceof ApiNetworkError) {
    return {
      stage: context.stage,
      timestamp,
      failureType: "network",
      message: error.message,
      method: error.method,
      url: error.url,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    stage: context.stage,
    timestamp,
    failureType: /abort/i.test(message) ? "aborted" : "unknown",
    message,
  };
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string; requestedAt: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  // Fall back to text when blob() is unavailable (e.g. some React Native builds).
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string; requestedAt: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType = responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            'Use responseType "json" or "text" instead.',
        );
      }
      return response.blob();
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  input = applyBaseUrl(input);
  const { responseType = "auto", timeoutMs, headers: headersInit, ...init } = options;

  const method = resolveMethod(input, init.method);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (typeof init.body === "string" && !headers.has("content-type") && looksLikeJson(init.body)) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  // Attach bearer token when an auth getter is configured and no
  // Authorization header has been explicitly provided.
  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const requestInfo = { method, url: resolveUrl(input), requestedAt: new Date().toISOString() };
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let requestInit: RequestInit = { ...init, method, headers };

  const effectiveTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (
    Number.isFinite(effectiveTimeoutMs) &&
    effectiveTimeoutMs > 0 &&
    typeof AbortController !== "undefined"
  ) {
    const controller = new AbortController();
    const callerSignal = init.signal;
    if (callerSignal?.aborted) {
      controller.abort();
    } else {
      callerSignal?.addEventListener("abort", () => controller.abort(), { once: true });
    }
    requestInit = { ...requestInit, signal: controller.signal };
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, effectiveTimeoutMs);
  }

  let response: Response;
  try {
    response = await fetch(input, requestInit);
  } catch (error) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (timedOut) throw new ApiTimeoutError(requestInfo, effectiveTimeoutMs, error);
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiNetworkError(requestInfo, error);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }

  return (await parseSuccessBody(response, responseType, requestInfo)) as T;
}

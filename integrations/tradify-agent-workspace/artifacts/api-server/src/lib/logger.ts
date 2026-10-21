import { env } from "@workspace/config";
import pino from "pino";

export function sanitizeRequestPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return path
    .split("?")[0]
    .split("/")
    .map((segment) =>
      segment.includes("@") || /^\d+$/.test(segment) || /^[a-z0-9_-]{8,}$/i.test(segment)
        ? ":id"
        : segment,
    )
    .join("/");
}

export const logger = pino({
  level: env.logLevel,
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "err",
    "error",
    "password",
    "token",
    "accessToken",
    "refreshToken",
    "apiKey",
    "secret",
    "stack",
    "email",
    "targetEmail",
    "actorEmail",
  ],
  ...(env.isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});

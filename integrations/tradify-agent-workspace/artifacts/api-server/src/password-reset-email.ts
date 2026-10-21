import { env } from "@workspace/config";
import { ReplitConnectors } from "@replit/connectors-sdk";

const DEFAULT_ADMIN_ORIGIN = "https://tradify-signals.replit.app";
const ADMIN_RESET_PATH = "/tradify-admin/reset-password";

export class PasswordResetEmailDeliveryError extends Error {
  constructor(
    readonly providerStatus?: number,
    readonly providerCode?: string,
  ) {
    super("PASSWORD_RESET_EMAIL_DELIVERY_FAILED");
    this.name = "PasswordResetEmailDeliveryError";
  }
}

async function getProviderErrorCode(response: Response): Promise<string | undefined> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return undefined;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const code = (payload as Record<string, unknown>).name;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,64}$/u.test(code) ? code : undefined;
}

function getEmailConfiguration(): { from: string; origin: URL } | undefined {
  const from = env.passwordResetFromEmail;
  if (!from || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(from)) return undefined;

  try {
    const origin = new URL(env.adminPublicOrigin || DEFAULT_ADMIN_ORIGIN);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      return undefined;
    }
    return { from, origin };
  } catch {
    return undefined;
  }
}

export function isPasswordResetDeliveryConfigured(): boolean {
  return Boolean(getEmailConfiguration());
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const configuration = getEmailConfiguration();
  if (!configuration) throw new Error("PASSWORD_RESET_DELIVERY_NOT_CONFIGURED");

  const resetUrl = new URL(ADMIN_RESET_PATH, configuration.origin);
  resetUrl.hash = new URLSearchParams({ token }).toString();
  const link = resetUrl.toString();
  const htmlLink = link.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const connectors = new ReplitConnectors();
  let response: Response;
  try {
    response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Tradify Signals <${configuration.from}>`,
        to: [to],
        subject: "Reset your Tradify password",
        html: [
          "<p>We received a request to reset the password for your Tradify Signals account.</p>",
          `<p><a href="${htmlLink}">Reset your password</a></p>`,
          "<p>This link expires in 20 minutes and can only be used once. If you did not request this, you can ignore this email.</p>",
        ].join(""),
        text: [
          "We received a request to reset the password for your Tradify Signals account.",
          `Reset your password: ${link}`,
          "This link expires in 20 minutes and can only be used once. If you did not request this, you can ignore this email.",
        ].join("\n\n"),
      }),
    });
  } catch {
    throw new PasswordResetEmailDeliveryError();
  }

  if (!response.ok) {
    throw new PasswordResetEmailDeliveryError(
      response.status,
      await getProviderErrorCode(response),
    );
  }
}

export const passwordResetEmailProvider = {
  isConfigured: isPasswordResetDeliveryConfigured,
  send: sendPasswordResetEmail,
};

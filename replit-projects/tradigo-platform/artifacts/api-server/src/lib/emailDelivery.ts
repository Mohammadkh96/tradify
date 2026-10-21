import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

export type AuthEmailKind = "verification" | "password-reset";

export type AuthEmail = {
  kind: AuthEmailKind;
  recipient: string;
  recipientName: string;
  actionUrl: string;
  expiresInHours: number;
};

export type EmailDeliveryResult = {
  sent: boolean;
  reason?: "not_configured" | "provider_error";
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailFrom(): string {
  // Resend's shared onboarding sender is intentionally useful only for
  // account-owner testing. Production must override this with a verified
  // sender domain through FROM_EMAIL.
  const value = process.env.FROM_EMAIL?.trim() || "Tradigo <onboarding@resend.dev>";
  const namedAddress = value.match(/^(.+?)\s*<([^<>@\s]+@[^<>@\s]+)>$/);
  if (namedAddress) return `${namedAddress[1].trim()} <${namedAddress[2]}>`;
  return value;
}

/**
 * Transactional auth mail uses the Replit-managed Resend connector. The app
 * can start without a provider, but it never claims a message was sent until
 * Resend accepts it.
 */
export async function deliverAuthEmail(email: AuthEmail): Promise<EmailDeliveryResult> {
  if (!authEmailDeliveryConfigured()) {
    return { sent: false, reason: "not_configured" };
  }
  const from = emailFrom();

  const isVerification = email.kind === "verification";
  const subject = isVerification
    ? "Verify your Tradigo email"
    : "Reset your Tradigo password";
  const actionLabel = isVerification ? "Verify email address" : "Choose a new password";
  const intro = isVerification
    ? "Confirm your email address to keep your Tradigo account secure."
    : "We received a request to reset the password for your Tradigo account.";
  const safeActionUrl = escapeHtml(email.actionUrl);

  try {
    const response = await new ReplitConnectors().proxy("resend", "/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        from,
        to: [email.recipient],
        subject,
        text: `${intro}\n\n${actionLabel}: ${email.actionUrl}\n\nThis link expires in ${email.expiresInHours} hours. If you did not request this, you can ignore this email.`,
        html: `<p>${intro}</p><p><a href="${safeActionUrl}">${actionLabel}</a></p><p>This link expires in ${email.expiresInHours} hours. If you did not request this, you can ignore this email.</p>`,
      },
    });
    if (!response.ok) {
      logger.warn({ status: response.status, kind: email.kind }, "Resend rejected auth email delivery");
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (error) {
    logger.warn({ err: error, kind: email.kind }, "Resend auth email request failed");
    return { sent: false, reason: "provider_error" };
  }
}

export function authEmailDeliveryConfigured(): boolean {
  return Boolean(
    process.env.REPLIT_CONNECTORS_HOSTNAME
      || process.env.REPL_IDENTITY
      || process.env.WEB_REPL_RENEWAL
      || process.env.REPLIT_CLI,
  );
}
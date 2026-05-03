import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { db } from "./db";
import * as schema from "@shared/schema";
import { and, count, eq, gte, lte, ne } from "drizzle-orm";
import { openai } from "./replit_integrations/audio/index";

// Use process.cwd() for path resolution (works in both ESM and CJS)
const EMAIL_TEMPLATES_DIR = path.join(process.cwd(), 'server', 'emails');

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD || '';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@tradifyapp.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tradifyapp.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@tradifyapp.com';
const APP_NAME = 'TradifyApp';
const APP_URL = process.env.APP_URL || 'https://tradifyapp.com';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_APP_PASSWORD,
  },
});

interface EmailLog {
  to: string;
  subject: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

const emailLogs: EmailLog[] = [];

function logEmail(log: EmailLog) {
  emailLogs.push(log);
  if (emailLogs.length > 1000) {
    emailLogs.shift();
  }
  console.log(`[EMAIL] ${log.success ? 'SENT' : 'FAILED'}: ${log.subject} → ${log.to}`);
  if (log.error) {
    console.error(`[EMAIL ERROR] ${log.error}`);
  }
}

function loadTemplate(templateName: string): string {
  const templatePath = path.join(EMAIL_TEMPLATES_DIR, `${templateName}.html`);
  try {
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    console.error(`Failed to load email template: ${templateName}`, error);
    return '';
  }
}

function replaceTemplatePlaceholders(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  result = result.replace(/{{app_name}}/g, APP_NAME);
  result = result.replace(/{{app_url}}/g, APP_URL);
  result = result.replace(/{{support_email}}/g, SUPPORT_EMAIL);
  result = result.replace(/{{current_year}}/g, new Date().getFullYear().toString());
  return result;
}

async function getUnsubscribeUrl(userId: string): Promise<string> {
  try {
    const [user] = await db.select({ unsubscribeToken: schema.userRole.unsubscribeToken })
      .from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
    if (user?.unsubscribeToken) {
      return `${APP_URL}/api/unsubscribe?token=${user.unsubscribeToken}`;
    }
  } catch {}
  return "";
}

async function isUserUnsubscribed(userId: string): Promise<boolean> {
  try {
    const [user] = await db.select({ emailUnsubscribed: schema.userRole.emailUnsubscribed })
      .from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
    return user?.emailUnsubscribed === true;
  } catch { return false; }
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  retryOnce = true,
  extraHeaders?: Record<string, string>
): Promise<boolean> {
  if (!SMTP_USER || !SMTP_APP_PASSWORD) {
    console.warn('[EMAIL] SMTP credentials not configured. Email not sent.');
    logEmail({ to, subject, success: false, error: 'SMTP not configured', timestamp: new Date() });
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      headers: extraHeaders,
    });
    logEmail({ to, subject, success: true, timestamp: new Date() });
    
    // Log to database
    try {
      await db.insert(schema.sentEmails).values({
        recipient: to,
        subject,
        templateName: 'transactional',
        success: true,
      });
    } catch (dbError) {
      console.error('[EMAIL] Failed to log email to database:', dbError);
    }
    
    return true;
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    
    if (retryOnce) {
      console.log(`[EMAIL] Retrying send to ${to}...`);
      return sendEmail(to, subject, html, false);
    }
    
    logEmail({ to, subject, success: false, error: errorMessage, timestamp: new Date() });
    return false;
  }
}

function getEmailHeader(): string {
  return `
          <tr>
            <td style="background-color: #131A2B; padding: 28px 40px 24px 40px; border-bottom: 3px solid #00D9A3;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: 2px; text-transform: uppercase; line-height: 1; font-family: Arial, sans-serif;">TRADIFYAPP</div>
                    <div style="font-size: 11px; color: #00D9A3; letter-spacing: 2.5px; text-transform: uppercase; font-weight: 600; margin-top: 6px; font-family: Arial, sans-serif;">YOUR RULES. ENFORCED.</div>
                  </td>
                  <td style="text-align: right; vertical-align: top;">
                    <div style="display: inline-block; background-color: #00D9A3; width: 8px; height: 8px; border-radius: 50%;"></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function getEmailFooter(unsubscribeUrl?: string): string {
  const unsubLine = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color: #4B5563; text-decoration: underline;">Unsubscribe</a> from marketing emails.`
    : `You received this because you have a TradifyApp account.`;
  return `
          <tr>
            <td style="background-color: #131A2B; padding: 28px 40px; border-top: 1px solid #1F2937;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">&copy; ${new Date().getFullYear()} TradifyApp. All rights reserved. | Trading Discipline Platform</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color: #00D9A3; text-decoration: none;">${SUPPORT_EMAIL}</a></p>
              <p style="margin: 0; font-size: 11px; color: #4B5563;">${unsubLine}</p>
            </td>
          </tr>`;
}

function wrapEmailBody(content: string, title: string, preheader: string, unsubscribeUrl?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${preheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="margin: 0 auto; background-color: #0A0F1E; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          ${getEmailHeader()}
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          ${getEmailFooter(unsubscribeUrl)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmailVerificationEmail(email: string, fullName: string, verificationToken: string): Promise<boolean> {
  const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${verificationToken}`;

  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Verify Your Email Address</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Thanks for signing up for TradifyApp! We're excited to have you on board.</p>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">To complete your registration and start tracking your trades, please verify your email address by clicking the button below:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #00D9A3; border-radius: 8px;"><a href="${verificationUrl}" style="display: inline-block; color: #0A0F1E; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Verify Email Address</a></td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
          <tr><td style="background-color: #131A2B; padding: 20px; border-radius: 8px; border-left: 4px solid #00D9A3;">
            <p style="color: #9CA3AF; font-size: 14px; margin: 0 0 8px 0;"><strong style="color: #ffffff;">&#9200; This link expires in 24 hours</strong></p>
            <p style="color: #9CA3AF; font-size: 14px; margin: 0;">If you didn't create an account with TradifyApp, you can safely ignore this email.</p>
          </td></tr>
        </table>
        <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin-top: 32px; margin-bottom: 0;">If the button doesn't work, copy and paste this link into your browser:<br /><a href="${verificationUrl}" style="color: #00D9A3; word-break: break-all;">${verificationUrl}</a></p>`;

  const html = wrapEmailBody(content, 'Verify Your Email Address', 'Verify your email address to get started with TradifyApp');
  return sendEmail(email, `Verify your email - ${APP_NAME}`, html);
}

async function sendWelcomeEmail(email: string, userName: string): Promise<boolean> {
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Welcome to TradifyApp! &#127881;</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Your account is now active and ready to use. You're about to discover a better way to track, analyze, and improve your trading.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td style="background-color: #131A2B; padding: 24px; border-radius: 8px;">
            <h2 style="color: #00D9A3; font-size: 18px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">&#128640; Get Started in 3 Easy Steps:</h2>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding-bottom: 16px;"><p style="color: #ffffff; font-size: 16px; font-weight: bold; margin: 0 0 8px 0;">1. Connect Your MT5 Account</p><p style="color: #9CA3AF; font-size: 14px; margin: 0;">Auto-sync your trades from MetaTrader 5</p></td></tr>
              <tr><td style="padding-bottom: 16px;"><p style="color: #ffffff; font-size: 16px; font-weight: bold; margin: 0 0 8px 0;">2. Set Up Your Trading Rules</p><p style="color: #9CA3AF; font-size: 14px; margin: 0;">Define your strategy and track rule compliance</p></td></tr>
              <tr><td><p style="color: #ffffff; font-size: 16px; font-weight: bold; margin: 0 0 8px 0;">3. Review Your Analytics</p><p style="color: #9CA3AF; font-size: 14px; margin: 0;">Track performance and identify patterns</p></td></tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #00D9A3; border-radius: 8px;"><a href="${APP_URL}/dashboard" style="display: inline-block; color: #0A0F1E; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Go to Dashboard</a></td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 32px;">
          <tr><td style="background-color: #1F2937; padding: 20px; border-radius: 8px;">
            <p style="color: #D1D5DB; font-size: 14px; margin: 0 0 12px 0;"><strong style="color: #ffffff;">&#128161; Pro Tip:</strong></p>
            <p style="color: #9CA3AF; font-size: 14px; margin: 0; line-height: 1.6;">The most successful traders review every single trade. Make it a habit from day one and watch your consistency improve.</p>
          </td></tr>
        </table>`;

  const html = wrapEmailBody(content, 'Welcome to TradifyApp', 'Welcome to TradifyApp - Your trading journey starts now');
  return sendEmail(email, `Welcome to ${APP_NAME}!`, html);
}

async function sendPasswordResetEmail(email: string, userName: string, resetUrl: string): Promise<boolean> {
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Reset Your Password</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">We received a request to reset the password for your TradifyApp account.</p>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">Click the button below to create a new password:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #00D9A3; border-radius: 8px;"><a href="${resetUrl}" style="display: inline-block; color: #0A0F1E; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Reset Password</a></td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
          <tr><td style="background-color: #131A2B; padding: 20px; border-radius: 8px; border-left: 4px solid #00D9A3;">
            <p style="color: #9CA3AF; font-size: 14px; margin: 0 0 8px 0;"><strong style="color: #ffffff;">&#9200; This link expires in 1 hour</strong></p>
            <p style="color: #9CA3AF; font-size: 14px; margin: 0;">For security reasons, password reset links are only valid for 60 minutes.</p>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
          <tr><td style="background-color: #1F2937; padding: 20px; border-radius: 8px; border-left: 4px solid #EF4444;">
            <p style="color: #ffffff; font-size: 14px; font-weight: bold; margin: 0 0 8px 0;">&#128274; Didn't Request This?</p>
            <p style="color: #D1D5DB; font-size: 14px; margin: 0; line-height: 1.6;">If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </td></tr>
        </table>`;

  const html = wrapEmailBody(content, 'Reset Your Password', 'Reset your TradifyApp password');
  return sendEmail(email, `Reset Your ${APP_NAME} Password`, html);
}

async function sendAdminCreatedUserEmail(email: string, userName: string, tempPassword: string): Promise<boolean> {
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Your Account Has Been Created</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">An administrator has created a TradifyApp account for you. Here are your login credentials:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td style="background-color: #131A2B; padding: 24px; border-radius: 8px; border: 1px solid #1F2937;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding-bottom: 16px;">
                <p style="color: #9CA3AF; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Email Address</p>
                <p style="color: #ffffff; font-size: 16px; font-weight: bold; margin: 0; font-family: monospace;">${email}</p>
              </td></tr>
              <tr><td>
                <p style="color: #9CA3AF; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Temporary Password</p>
                <p style="color: #00D9A3; font-size: 18px; font-weight: bold; margin: 0; font-family: monospace;">${tempPassword}</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
          <tr><td style="background-color: #1F2937; padding: 20px; border-radius: 8px; border-left: 4px solid #F59E0B;">
            <p style="color: #ffffff; font-size: 14px; font-weight: bold; margin: 0 0 8px 0;">&#9888;&#65039; Important Security Notice</p>
            <p style="color: #D1D5DB; font-size: 14px; margin: 0; line-height: 1.6;">This is a temporary password. For your security, you'll be required to change it when you first log in.</p>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #00D9A3; border-radius: 8px;"><a href="${APP_URL}/login" style="display: inline-block; color: #0A0F1E; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Log In Now</a></td></tr>
        </table>`;

  const html = wrapEmailBody(content, 'Your TradifyApp Account Has Been Created', 'Your TradifyApp account has been created');
  return sendEmail(email, `Your ${APP_NAME} Account Has Been Created`, html);
}

async function sendSubscriptionActivatedEmail(email: string, userName: string, planName: string): Promise<boolean> {
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Welcome to ${planName}! &#128640;</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Your subscription has been activated successfully. You now have access to all ${planName} features.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td style="background-color: #131A2B; padding: 24px; border-radius: 8px; border: 2px solid #00D9A3;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="text-align: center; padding-bottom: 20px;">
                <div style="background-color: #00D9A3; color: #0A0F1E; display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: bold;">${planName.toUpperCase()} PLAN</div>
              </td></tr>
              <tr><td>
                <h2 style="color: #00D9A3; font-size: 18px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">&#10024; Your New Features:</h2>
                <ul style="color: #D1D5DB; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
                  <li>MT5 auto-sync integration</li>
                  <li>Advanced analytics &amp; reports</li>
                  <li>Custom trading rules (unlimited)</li>
                  <li>Performance insights dashboard</li>
                  <li>AI-powered monthly self-review</li>
                  <li>Priority support</li>
                </ul>
              </td></tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #00D9A3; border-radius: 8px;"><a href="${APP_URL}/dashboard" style="display: inline-block; color: #0A0F1E; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Explore ${planName} Features</a></td></tr>
        </table>`;

  const html = wrapEmailBody(content, `Welcome to TradifyApp ${planName}`, `Your ${planName} subscription is now active`);
  return sendEmail(email, `Welcome to ${APP_NAME} ${planName}!`, html);
}

async function sendSubscriptionCanceledEmail(email: string, userName: string, planName: string): Promise<boolean> {
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Subscription Canceled</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">We're sorry to see you go. Your subscription has been canceled as requested.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td style="background-color: #131A2B; padding: 24px; border-radius: 8px;">
            <h3 style="color: #ffffff; font-size: 16px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">&#128197; What Happens Next?</h3>
            <p style="color: #D1D5DB; font-size: 14px; margin: 0 0 12px 0;"><strong style="color: #00D9A3;">&#10003; You still have access</strong></p>
            <p style="color: #9CA3AF; font-size: 14px; margin: 0 0 20px 0;">Your ${planName} features remain active until the end of your current billing period.</p>
            <p style="color: #9CA3AF; font-size: 14px; margin: 0;">After that date, your account will switch to the Free plan. All your data will be preserved.</p>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #00D9A3; border-radius: 8px;"><a href="${APP_URL}/pricing" style="display: inline-block; color: #0A0F1E; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Reactivate Subscription</a></td></tr>
        </table>`;

  const html = wrapEmailBody(content, 'Subscription Canceled', 'Your subscription has been canceled');
  return sendEmail(email, `Your ${APP_NAME} ${planName} Subscription Has Been Canceled`, html);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendContactFormNotification(fromEmail: string, fromName: string, subject: string, message: string): Promise<boolean> {
  const safeFrom = escapeHtml(fromName);
  const safeEmail = escapeHtml(fromEmail);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const content = `
    <h1 style="margin: 0 0 20px 0; font-size: 22px; font-weight: bold; color: #ffffff; font-family: Arial, sans-serif;">&#128235; New Contact Form Submission</h1>
    <div style="background-color: #131A2B; border: 1px solid #1F2937; border-radius: 8px; padding: 24px; margin-bottom: 16px;">
      <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #1F2937;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px; font-family: Arial, sans-serif;">FROM</p>
        <p style="margin: 0; font-size: 16px; color: #ffffff; font-family: Arial, sans-serif;">${safeFrom} &lt;${safeEmail}&gt;</p>
      </div>
      <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #1F2937;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px; font-family: Arial, sans-serif;">SUBJECT</p>
        <p style="margin: 0; font-size: 16px; color: #ffffff; font-family: Arial, sans-serif;">${safeSubject}</p>
      </div>
      <div>
        <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px; font-family: Arial, sans-serif;">MESSAGE</p>
        <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #D1D5DB; white-space: pre-wrap; font-family: Arial, sans-serif;">${safeMessage}</p>
      </div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0 0 0;">
      <tr>
        <td style="background-color: #00D9A3; border-radius: 6px;">
          <a href="mailto:${safeEmail}" style="display: inline-block; padding: 12px 24px; font-size: 15px; font-weight: bold; color: #000000; text-decoration: none; font-family: Arial, sans-serif;">Reply to ${safeFrom} &#8594;</a>
        </td>
      </tr>
    </table>`;
  const html = wrapEmailBody(content, 'Contact Form Submission', 'Contact Form Submission');
  return sendEmail(SUPPORT_EMAIL, `[Contact Form] ${safeSubject}`, html);
}

async function sendContactFormAutoReply(email: string, name: string): Promise<boolean> {
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Thanks for Reaching Out! &#128236;</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">We've received your message and our team will get back to you as soon as possible.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td style="background-color: #1F2937; padding: 20px; border-radius: 8px;">
            <h3 style="color: #ffffff; font-size: 16px; font-weight: bold; margin-top: 0; margin-bottom: 12px;">&#9201;&#65039; What to Expect:</h3>
            <ul style="color: #D1D5DB; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li><strong style="color: #ffffff;">Response time:</strong> Usually within 24 hours</li>
              <li><strong style="color: #ffffff;">Business hours:</strong> Monday-Friday, 9am-6pm EST</li>
              <li><strong style="color: #ffffff;">Email from:</strong> ${SUPPORT_EMAIL}</li>
            </ul>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
          <tr><td style="background-color: #131A2B; padding: 20px; border-radius: 8px; border-left: 4px solid #00D9A3;">
            <p style="color: #ffffff; font-size: 14px; font-weight: bold; margin: 0 0 12px 0;">&#128161; While You Wait:</p>
            <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; margin: 0;">Check out our <a href="${APP_URL}/blog" style="color: #00D9A3; text-decoration: none; font-weight: bold;">Blog</a> for trading tips and platform updates.</p>
          </td></tr>
        </table>`;

  const html = wrapEmailBody(content, "We've Received Your Message", "We've received your message");
  return sendEmail(email, `We received your message - ${APP_NAME}`, html);
}

// Legacy function for backward compatibility with existing code
async function sendTransactionalEmail(userId: string, type: "signup" | "payment_success" | "password_reset" | "email_verification", data: any): Promise<boolean> {
  const userName = data.fullName || userId.split('@')[0]; // Extract name from email
  
  switch (type) {
    case "signup":
      return sendWelcomeEmail(userId, userName);
    case "payment_success":
      return sendSubscriptionActivatedEmail(userId, userName, data.planName || 'Pro');
    case "password_reset":
      return sendPasswordResetEmail(userId, userName, data.resetUrl || '');
    case "email_verification":
      return sendEmailVerificationEmail(userId, userName, data.verificationToken || '');
    default:
      console.warn(`[EMAIL] Unknown transactional email type: ${type}`);
      return false;
  }
}

async function sendAdminSignupNotification(
  userEmail: string,
  fullName: string,
  country: string,
  isFoundingMember: boolean
): Promise<boolean> {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const foundingBadge = isFoundingMember
    ? ' <span style="background-color: #F59E0B; color: #000; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; font-family: Arial, sans-serif;">FOUNDING MEMBER</span>'
    : '';

  const content = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: bold; color: #ffffff; font-family: Arial, sans-serif;">&#128100; New User Signup${foundingBadge}</h1>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #9CA3AF; font-family: Arial, sans-serif;">A new user has registered on ${APP_NAME}.</p>
    <div style="background-color: #131A2B; border: 1px solid #1F2937; border-radius: 8px; padding: 24px;">
      <div style="padding-bottom: 14px; border-bottom: 1px solid #1F2937; margin-bottom: 14px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px; font-family: Arial, sans-serif;">FULL NAME</p>
        <p style="margin: 0; font-size: 16px; color: #ffffff; font-family: Arial, sans-serif;">${fullName}</p>
      </div>
      <div style="padding-bottom: 14px; border-bottom: 1px solid #1F2937; margin-bottom: 14px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px; font-family: Arial, sans-serif;">EMAIL</p>
        <p style="margin: 0; font-size: 16px; color: #00D9A3; font-family: Arial, sans-serif;">${userEmail}</p>
      </div>
      <div style="padding-bottom: 14px; border-bottom: 1px solid #1F2937; margin-bottom: 14px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px; font-family: Arial, sans-serif;">COUNTRY</p>
        <p style="margin: 0; font-size: 16px; color: #ffffff; font-family: Arial, sans-serif;">${country}</p>
      </div>
      <div style="padding-bottom: 14px; border-bottom: 1px solid #1F2937; margin-bottom: 14px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px; font-family: Arial, sans-serif;">SIGNUP TIME</p>
        <p style="margin: 0; font-size: 15px; color: #D1D5DB; font-family: Arial, sans-serif;">${formattedDate}</p>
      </div>
      <div>
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px; font-family: Arial, sans-serif;">STATUS</p>
        <p style="margin: 0; font-size: 16px; color: ${isFoundingMember ? '#F59E0B' : '#D1D5DB'}; font-weight: ${isFoundingMember ? 'bold' : 'normal'}; font-family: Arial, sans-serif;">${isFoundingMember ? 'Founding Member (Early Access)' : 'Standard Registration'}</p>
      </div>
    </div>`;

  const subject = isFoundingMember
    ? `[Founding Member] New Signup: ${fullName}`
    : `New User Signup: ${fullName}`;

  const html = wrapEmailBody(content, subject, `New signup: ${fullName}`);
  return sendEmail(ADMIN_EMAIL, subject, html);
}

async function sendBackupFailureAlertEmail(params: {
  errorMessage: string;
  attemptedAt: Date;
  trigger: string;
  consecutiveFailures: number;
  storageKey?: string;
}): Promise<boolean> {
  const { errorMessage, attemptedAt, trigger, consecutiveFailures, storageKey } = params;
  const safeError = escapeHtml(errorMessage.slice(0, 4000));
  const escalated = consecutiveFailures >= 2;
  const subject = escalated
    ? `[ESCALATION] ${consecutiveFailures} consecutive Tradify backup failures`
    : `[ALERT] Tradify database backup failed`;

  const escalationBlock = escalated
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 16px 0;">
         <tr><td style="background-color: #1F2937; padding: 16px; border-radius: 8px; border-left: 4px solid #EF4444;">
           <p style="color: #ffffff; font-size: 14px; font-weight: bold; margin: 0 0 4px 0;">&#9888;&#65039; ${consecutiveFailures} consecutive failures</p>
           <p style="color: #D1D5DB; font-size: 13px; margin: 0; line-height: 1.6;">No successful backup has been recorded in the last ${consecutiveFailures} attempts. The production Neon database is currently unprotected — investigate immediately.</p>
         </td></tr>
       </table>`
    : "";

  const content = `
    <h1 style="color: #ffffff; font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">&#128737;&#65039; Database Backup Failed</h1>
    <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">A scheduled backup of the Tradify production database did not complete successfully. Recovery is at risk until this is resolved.</p>
    ${escalationBlock}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #131A2B; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
      <tr><td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Attempted</p>
        <p style="margin: 0; font-size: 14px; color: #ffffff; font-family: monospace;">${attemptedAt.toISOString()}</p>
      </td></tr>
      <tr><td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Trigger</p>
        <p style="margin: 0; font-size: 14px; color: #ffffff; font-family: monospace;">${escapeHtml(trigger)}</p>
      </td></tr>
      <tr><td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Intended storage key</p>
        <p style="margin: 0; font-size: 13px; color: #ffffff; font-family: monospace; word-break: break-all;">${escapeHtml(storageKey || "(not assigned)")}</p>
      </td></tr>
      <tr><td>
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Error</p>
        <pre style="margin: 0; font-size: 12px; color: #FCA5A5; background-color: #0A0F1E; padding: 12px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; font-family: monospace; line-height: 1.5;">${safeError}</pre>
      </td></tr>
    </table>
    <p style="color: #9CA3AF; font-size: 13px; line-height: 1.6; margin: 16px 0 0 0;">Run <code style="background-color: #1F2937; padding: 2px 6px; border-radius: 4px; color: #00D9A3;">npx tsx scripts/backup-db.ts</code> on the server to retry manually, or visit the admin Database Backups panel.</p>`;

  const html = wrapEmailBody(content, subject, "Tradify backup failure alert");
  return sendEmail(ADMIN_EMAIL, subject, html);
}

/**
 * Sent when the weekly restore-verification job determines that the
 * most recent successful backup is structurally broken (download
 * failure, gunzip CRC error, missing CREATE TABLE markers, truncated
 * trailer, etc). The backup itself completed — what's at risk is its
 * usability, so the copy here is intentionally distinct from the
 * "backup failed" alert.
 */
async function sendBackupVerificationFailureAlertEmail(params: {
  errorMessage: string;
  attemptedAt: Date;
  backupRunAt: Date;
  storageKey: string;
}): Promise<boolean> {
  const { errorMessage, attemptedAt, backupRunAt, storageKey } = params;
  const safeError = escapeHtml(errorMessage.slice(0, 4000));
  const subject = `[ALERT] Tradify backup verification FAILED — restore at risk`;

  const content = `
    <h1 style="color: #ffffff; font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">&#128737;&#65039; Backup Verification Failed</h1>
    <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">The latest successful backup completed, but the weekly verification job could not validate it as restorable. Treat this as a backup outage — recovery is at risk.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #131A2B; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
      <tr><td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Verified at</p>
        <p style="margin: 0; font-size: 14px; color: #ffffff; font-family: monospace;">${attemptedAt.toISOString()}</p>
      </td></tr>
      <tr><td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Backup taken at</p>
        <p style="margin: 0; font-size: 14px; color: #ffffff; font-family: monospace;">${backupRunAt.toISOString()}</p>
      </td></tr>
      <tr><td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Storage key</p>
        <p style="margin: 0; font-size: 13px; color: #ffffff; font-family: monospace; word-break: break-all;">${escapeHtml(storageKey)}</p>
      </td></tr>
      <tr><td>
        <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Reason</p>
        <pre style="margin: 0; font-size: 12px; color: #FCA5A5; background-color: #0A0F1E; padding: 12px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; font-family: monospace; line-height: 1.5;">${safeError}</pre>
      </td></tr>
    </table>
    <p style="color: #9CA3AF; font-size: 13px; line-height: 1.6; margin: 16px 0 0 0;">Open the admin Database Backups panel and click "Verify Now" on a known-good backup, or run <code style="background-color: #1F2937; padding: 2px 6px; border-radius: 4px; color: #00D9A3;">npx tsx scripts/backup-db.ts</code> to capture a fresh snapshot.</p>`;

  const html = wrapEmailBody(content, subject, "Tradify backup verification failure alert");
  return sendEmail(ADMIN_EMAIL, subject, html);
}

function getEmailLogs(): EmailLog[] {
  return [...emailLogs];
}

function isEmailConfigured(): boolean {
  return !!(SMTP_USER && SMTP_APP_PASSWORD);
}

// ==================== EMAIL DRIP SEQUENCES ====================

function dripCta(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0;">
    <tr>
      <td style="background-color: #00D9A3; border-radius: 6px;">
        <a href="${url}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: bold; color: #000000; text-decoration: none; letter-spacing: 0.5px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function dripFooterNote(isLead: boolean, unsubscribeUrl?: string): string {
  const reason = isLead
    ? 'You received this because you downloaded a TradifyApp resource.'
    : 'You received this because you signed up for a free TradifyApp account.';
  const unsubLink = unsubscribeUrl
    ? ` <a href="${unsubscribeUrl}" style="color: #6B7280; text-decoration: underline;">Unsubscribe</a>`
    : '';
  return `<p style="margin: 24px 0 0 0; font-size: 12px; color: #6B7280; border-top: 1px solid #1F2937; padding-top: 16px;">${reason}${unsubLink}</p>`;
}

// ==================== AI EMAIL GENERATION ====================

const PRODUCT_REFERENCE = `
TradifyApp — Trading Discipline Platform. Tagline: "Your Rules. Enforced."
NOT a journal. NOT a trade log. An enforcement layer.

FREE plan: MT5 auto-sync via connector EA (read-only, installs in 3 min), trade history (30-day), basic analytics, psychology tracking, CSV import, risk calculators, 3 education lessons, basic rule validation.

PRO plan ($29/month): Everything in Free + unlimited trade history, advanced analytics (win rate by session/day/instrument/setup), unlimited rule engine, multi-account MT5 tracking, full 19-lesson education hub, monthly AI self-review report, Prop Firm Challenge Tracker (FTMO / The5ers / FundedNext / Funding Pips / Alpha Capital / Topstep / E8 / Lux / custom), AI instrument analysis, priority support.

ELITE plan ($59/month): Everything in Pro + behavioral risk flags, session analytics deep-dive, AI challenge risk warnings, strategy deviation analysis, monthly AI review reports with coaching recommendations.

MT5 connector: A .pyw file the user runs locally. Completely read-only — never touches broker credentials or places trades. Syncs every 60 seconds.
`;

interface AIEmailUserData {
  name: string;
  tier: string;
  hasMt5: boolean;
  ruleCount: number;
  daysSinceSignup: number;
  email: string;
}

async function generateAIEmail(
  type: string,
  userData: AIEmailUserData,
  context?: { topic?: string; newsHeadlines?: string[]; step?: number; isElite?: boolean }
): Promise<{ subject: string; body: string } | null> {
  try {
    const { name, tier, hasMt5, ruleCount, daysSinceSignup } = userData;
    const topic = context?.topic || type;
    const headlines = context?.newsHeadlines?.slice(0, 5) || [];
    const isElite = context?.isElite || tier.toUpperCase() === 'ELITE';

    const headlinesSection = headlines.length > 0
      ? `\nRecent market headlines for context:\n${headlines.map(h => `- ${h}`).join('\n')}\n`
      : '';

    const eliteInsightInstruction = isElite
      ? `\nSince this user is on Elite, include an exclusive "Elite Insight" section after the main content — a short, data-driven tip that only applies to elite-level analysis or behavioral risk. Use the HTML callout box style shown below:\n<div style="background-color: #1a0a2e; border: 1px solid #7c3aed; border-radius: 8px; padding: 20px; margin: 24px 0;"><p style="margin: 0 0 8px 0; font-size: 11px; color: #7c3aed; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">&#9889; Elite Insight</p><p style="margin: 0; font-size: 15px; color: #D1D5DB; line-height: 1.7;">[elite insight content]</p></div>`
      : '';

    const systemPrompt = `You are the voice of TradifyApp — a trading discipline platform for serious traders. Your brand voice is: direct, no-fluff, disciplined. You write short, impactful emails that respect the reader's intelligence.

${PRODUCT_REFERENCE}

Rules:
- Write in plain English. No corporate buzzwords.
- Use emojis in headings and list items (📊 📈 ⚡ 🎯 🧠 ✅ etc)
- ALL feature mentions must be accurate per the product reference above
- Do NOT use phrases like "built by a trader, for traders" or call it a "journal"
- Return only the HTML email body content — no outer wrapper, no DOCTYPE, no <html>/<body> tags
- Use inline styles. Dark theme: bg #0A0F1E, text #D1D5DB, headings #ffffff, accent #00D9A3
- Include one emerald CTA button using this exact HTML pattern (replace URL and label):
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;"><tr><td style="background-color: #00D9A3; border-radius: 6px;"><a href="${APP_URL}/dashboard" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: bold; color: #000000; text-decoration: none; letter-spacing: 0.3px;">[CTA LABEL] →</a></td></tr></table>
- Section callout boxes use: <div style="background-color: #131A2B; border-left: 3px solid #00D9A3; padding: 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">content</div>
- First line of subject: return as "SUBJECT: [subject here]" on its own line at the very top, then the HTML body below`;

    const userContext = `User: ${name} | Tier: ${tier} | MT5 connected: ${hasMt5} | Rules created: ${ruleCount} | Days since signup: ${daysSinceSignup}`;

    const userPrompt = `Write a ${type} email.
Topic: ${topic}
${userContext}
${headlinesSection}${eliteInsightInstruction}

Write the subject line first as "SUBJECT: [subject]", then the HTML body.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.7,
    });

    const raw = response.choices[0]?.message?.content || '';
    const lines = raw.split('\n');
    const subjectLine = lines.find(l => l.startsWith('SUBJECT:'));
    const subject = subjectLine ? subjectLine.replace('SUBJECT:', '').trim() : `Your TradifyApp update — ${topic}`;
    const bodyStart = lines.findIndex(l => l.startsWith('SUBJECT:'));
    const body = lines.slice(bodyStart + 1).join('\n').trim();

    if (!body) return null;
    return { subject, body };
  } catch (err) {
    console.error('[AI EMAIL] generateAIEmail error:', err);
    return null;
  }
}

interface BraveNewsResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveNewsResponse {
  results?: BraveNewsResult[];
}

async function fetchMarketNews(): Promise<string[]> {
  const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
  if (!BRAVE_API_KEY) {
    console.log('[DRIP] No BRAVE_API_KEY configured, skipping news fetch');
    return [];
  }

  try {
    const queries = [
      'prop firm trading news 2025',
      'forex discipline trading psychology',
      'algorithmic trading risk management prop firm',
    ];
    const headlines: string[] = [];

    for (const q of queries) {
      const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(q)}&count=5&freshness=pw`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY },
      });
      if (!resp.ok) continue;
      const data: BraveNewsResponse = await resp.json();
      const results = data?.results ?? [];
      for (const r of results.slice(0, 3)) {
        if (r?.title) headlines.push(r.title);
      }
    }

    return headlines.slice(0, 6);
  } catch (err) {
    console.error('[DRIP] fetchMarketNews error:', err);
    return [];
  }
}

async function getUserRuleCount(userId: string): Promise<number> {
  try {
    const [result] = await db.select({ total: count() })
      .from(schema.strategyRules)
      .innerJoin(schema.strategies, eq(schema.strategyRules.strategyId, schema.strategies.id))
      .where(eq(schema.strategies.userId, userId));
    return result?.total ?? 0;
  } catch {
    return 0;
  }
}

function buildLeadEmail(step: number, email: string, unsubscribeUrl?: string): { subject: string; html: string } | null {
  const appUrl = APP_URL;
  const checklistUrl = `${appUrl}/checklist`;
  const signupUrl = `${appUrl}/signup`;

  const emails: Array<{ subject: string; body: string }> = [
    {
      subject: 'Your Trading Discipline Checklist is here',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Your checklist is ready.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Day 1 — Getting started</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">The Trading Discipline Checklist covers the 10 pre-session checks that separate consistent traders from those who blow accounts. Click below to access it.</p>
        ${dripCta('View Your Checklist →', checklistUrl)}
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Over the next 6 days I'll send you short, direct emails on the psychology and mechanics of trading discipline — the stuff most trading courses skip entirely.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Tomorrow: why trying harder is the worst thing you can do as a trader.</p>
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">TradifyApp automates everything in this email. Start free — no card required → <a href="${signupUrl}" style="color: #00D9A3;">${appUrl}</a></p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: "You don't have a discipline problem",
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">You don't have a discipline problem.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Day 2 — Why willpower fails traders</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Every trader who's ever said "I need more discipline" is solving the wrong problem.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Willpower is a finite resource. By the time you're 2 hours into a session, your cognitive load is high, your PnL is influencing your emotions, and your prefrontal cortex — the part responsible for impulse control — is fatigued.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;"><strong style="color: #ffffff;">Trying harder doesn't work. Systems do.</strong></p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">The traders who stay funded don't rely on willpower in the moment. They pre-commit their rules before the session starts — max loss, max trades, allowed setups — and then they let the system enforce those rules automatically.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">This is the core principle behind TradifyApp. Not a trade log. An enforcement layer.</p>
        ${dripCta('See How It Works →', signupUrl)}
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Tomorrow: the drawdown math that most prop traders get wrong — and how one bad day erases a month of work.</p>
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">TradifyApp automates everything in this email. Start free — no card required → <a href="${signupUrl}" style="color: #00D9A3;">${appUrl}</a></p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'The prop firm math most traders get wrong',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">The prop firm math most traders get wrong.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Day 3 — Drawdown & consistency</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Let's say you're on a $100k prop account with a 10% max drawdown ($10,000). You've made $8,000 over 3 weeks. Great month.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Then you have one emotional Friday. You revenge trade after a bad morning. You lose $4,000 in a single session.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;"><strong style="color: #ffffff;">You're now 40% of the way to a breach — from one day.</strong></p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Most traders mentally account for their cumulative drawdown wrong. They think of it as "how much have I lost from peak?" when prop firms calculate it from the initial balance or equity high-water mark.</p>
        <div style="background-color: #0d1117; border-left: 3px solid #00D9A3; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; font-size: 15px; color: #D1D5DB; line-height: 1.7;">The fix: <strong style="color: #ffffff;">real-time drawdown tracking with automatic alerts before you breach, not after.</strong></p>
        </div>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">TradifyApp syncs your MT5 account in real time and shows your prop firm's exact breach thresholds against your live balance.</p>
        ${dripCta('Track Your Drawdown Free →', signupUrl)}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">TradifyApp automates everything in this email. Start free — no card required → <a href="${signupUrl}" style="color: #00D9A3;">${appUrl}</a></p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'The revenge trade spiral (step by step)',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">The revenge trade spiral — step by step.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Day 4 — How it compounds</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">The revenge trade never starts as a revenge trade. Here's the actual sequence:</p>
        <ol style="margin: 0 0 20px 0; padding: 0 0 0 20px; color: #D1D5DB;">
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">You take a loss on a high-conviction setup. Frustration spikes.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">You open another position immediately — "to get it back."</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">Position sizing increases. You need a bigger win to feel recovered.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">Second loss. Now you're in problem-solving mode, not trading mode.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">You override your rules. "Just this once."</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">Daily drawdown limit hit. Account suspended or challenged failed.</li>
        </ol>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;"><strong style="color: #ffffff;">Detection signs:</strong> consecutive losses within 30 minutes, position size creep, and trading outside your defined session hours.</p>
        <div style="background-color: #0d1117; border-left: 3px solid #f59e0b; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; font-size: 15px; color: #D1D5DB; line-height: 1.7;">TradifyApp's rule engine flags all three. It locks your account when your daily loss limit is hit — before the spiral completes.</p>
        </div>
        ${dripCta('Set Your Rules. Let TradifyApp Enforce Them →', signupUrl)}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">TradifyApp automates everything in this email. Start free — no card required → <a href="${signupUrl}" style="color: #00D9A3;">${appUrl}</a></p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: "The 2% rule isn't enough under pressure",
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">The 2% rule isn't enough under pressure.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Day 5 — Risk under pressure</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Every trader knows the 2% rule. Risk no more than 2% per trade. It's solid advice — in a spreadsheet.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">In practice, after a loss, most traders unconsciously increase position size. Not enough to notice. Just a little more "to make it meaningful." That's how 2% becomes 4%. Then 8%. Then the breach.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;"><strong style="color: #ffffff;">The solution is pre-commitment, not willpower.</strong></p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Decide your position size <em>before</em> you place the order — ideally before the session starts — and then lock it. Most traders don't do this because their platform doesn't help them do it.</p>
        <div style="background-color: #0d1117; border-left: 3px solid #00D9A3; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; font-size: 15px; color: #D1D5DB; line-height: 1.7;">TradifyApp lets you set a max lot size per trade as a session rule. If you exceed it, it's logged as a rule breach — visible in your analytics and in your prop tracker.</p>
        </div>
        ${dripCta('Lock in Your Position Rules →', signupUrl)}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">TradifyApp automates everything in this email. Start free — no card required → <a href="${signupUrl}" style="color: #00D9A3;">${appUrl}</a></p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'What elite traders do differently',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">What elite traders do differently.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Day 6 — The accountability edge</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">The biggest differentiator between traders who stay funded long-term and those who don't isn't strategy. It's accountability.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Specifically: reviewing your trades the same day, while the decision-making context is still fresh. Not at the end of the week when you've mentally reframed everything.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;"><strong style="color: #ffffff;">The most valuable thing you can record after a losing trade:</strong></p>
        <ol style="margin: 0 0 20px 0; padding: 0 0 0 20px; color: #D1D5DB;">
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">What was my emotional state when I entered?</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">Did this match my defined setup criteria?</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">Would I take this trade again tomorrow, exactly as executed?</li>
        </ol>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">TradifyApp auto-syncs every trade from your MT5 account. Each trade in your history already has P&L, time, instrument, and direction populated. You just add the context.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Takes 2 minutes. Compounds over months.</p>
        ${dripCta('Start Your Accountability Practice →', signupUrl)}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">TradifyApp automates everything in this email. Start free — no card required → <a href="${signupUrl}" style="color: #00D9A3;">${appUrl}</a></p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'Everything in these emails, automated in one place',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Everything in these emails — automated in one place.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Day 7 — The full picture</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Over the last week you've read about willpower vs systems, drawdown math, revenge trading, position sizing, and accountability. Here's how TradifyApp handles each one:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #1F2937;">
            <td style="padding: 12px 8px; font-size: 14px; color: #9CA3AF; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Email topic</td>
            <td style="padding: 12px 8px; font-size: 14px; color: #9CA3AF; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">TradifyApp feature</td>
          </tr>
          <tr style="border-bottom: 1px solid #1F2937;">
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">Willpower vs systems</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #00D9A3;">Pre-session rule enforcement</td>
          </tr>
          <tr style="border-bottom: 1px solid #1F2937;">
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">Drawdown math</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #00D9A3;">Real-time prop firm tracker</td>
          </tr>
          <tr style="border-bottom: 1px solid #1F2937;">
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">Revenge trading</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #00D9A3;">Daily loss limit alerts</td>
          </tr>
          <tr style="border-bottom: 1px solid #1F2937;">
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">Position sizing</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #00D9A3;">Max lot size rules</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">Accountability tracking</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #00D9A3;">Auto-populated MT5 trade history</td>
          </tr>
        </table>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">It's free to start. No card required. Connect your MT5 account in under 3 minutes.</p>
        ${dripCta('Start Free — Your Rules. Enforced. →', signupUrl)}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">TradifyApp automates everything in this email. Start free — no card required → <a href="${signupUrl}" style="color: #00D9A3;">${appUrl}</a></p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
  ];

  const entry = emails[step];
  if (!entry) return null;

  return {
    subject: entry.subject,
    html: wrapEmailBody(entry.body, entry.subject, entry.subject),
  };
}

async function buildFreeUserEmail(
  step: number,
  userId: string,
  userName: string,
  unsubscribeUrl?: string
): Promise<{ subject: string; html: string } | null> {
  const appUrl = APP_URL;
  const upgradeUrl = `${appUrl}/pricing`;
  const dashboardUrl = `${appUrl}/dashboard`;
  const mt5GuideUrl = `${appUrl}/mt5-bridge`;

  const hasMt5 = await db.select({ id: schema.mt5Accounts.id })
    .from(schema.mt5Accounts)
    .where(eq(schema.mt5Accounts.userId, userId))
    .limit(1)
    .then(rows => rows.length > 0);

  const emails: Array<{ subject: string; body: string } | null> = [
    hasMt5
      ? {
          subject: 'Your trades are syncing — what to check next',
          body: `
            <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Your trades are syncing. Here's what to check next.</h1>
            <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">MT5 Connected — Next steps</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Hey ${userName} — your MT5 trades are coming through. Good start.</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Here's the fastest way to get value today:</p>
            <ol style="margin: 0 0 20px 0; padding: 0 0 0 20px; color: #D1D5DB;">
              <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Prop Tracker</strong> — add your firm, set your drawdown limits. TradifyApp will show your live breach distance.</li>
              <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Rule Engine</strong> — create your first rule. Max trades per day is the easiest one to start with.</li>
              <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Analytics</strong> — check your win rate by session (morning vs afternoon). Most traders are surprised by what they find.</li>
            </ol>
            ${dripCta('Open Your Dashboard →', dashboardUrl)}
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Tomorrow I'll show you what you can't see on the free plan — and whether it's worth upgrading.</p>
            ${dripFooterNote(false, unsubscribeUrl)}`,
        }
      : {
          subject: "You're missing the best part of TradifyApp",
          body: `
            <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">You're missing the best part.</h1>
            <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">MT5 not connected yet</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Hey ${userName} — you've signed up but haven't connected your MT5 account yet. That's where the real value is.</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Without MT5 sync, TradifyApp is just a manual trade log. With it, every trade is automatically imported — instrument, size, entry, exit, P&L — and your prop firm tracker updates in real time.</p>
            <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #ffffff;">3-minute setup:</p>
            <ol style="margin: 0 0 20px 0; padding: 0 0 0 20px; color: #D1D5DB;">
              <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">Open the <strong style="color: #ffffff;">MT5 Bridge</strong> page in your TradifyApp dashboard and download the connector file.</li>
              <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">Double-click <code style="background: #0d1117; padding: 2px 6px; border-radius: 3px; color: #00D9A3;">tradify_connector.pyw</code> to run it. The app opens automatically.</li>
              <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">Keep your MT5 terminal running in the background. Your trades start syncing immediately.</li>
            </ol>
            ${dripCta('Connect MT5 Now →', mt5GuideUrl)}
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">If you hit any issues, reply to this email and I'll help you get set up.</p>
            ${dripFooterNote(false, unsubscribeUrl)}`,
        },
    {
      subject: "What you can't see on the free plan",
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">What you can't see on the free plan.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Free vs Pro</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Hey ${userName} — here's exactly what Pro unlocks that you can't access on free:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #1F2937;">
            <td style="padding: 12px 8px; font-size: 15px; font-weight: bold; color: #ffffff;">Multi-account tracking</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">Manage 2+ MT5 accounts side by side.</td>
          </tr>
          <tr style="border-bottom: 1px solid #1F2937;">
            <td style="padding: 12px 8px; font-size: 15px; font-weight: bold; color: #ffffff;">Advanced analytics</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">Win rate by session, day of week, instrument, and setup.</td>
          </tr>
          <tr style="border-bottom: 1px solid #1F2937;">
            <td style="padding: 12px 8px; font-size: 15px; font-weight: bold; color: #ffffff;">Unlimited rule engine</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">As many rules as your trading plan requires.</td>
          </tr>
          <tr style="border-bottom: 1px solid #1F2937;">
            <td style="padding: 12px 8px; font-size: 15px; font-weight: bold; color: #ffffff;">Monthly self-review</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">AI-generated performance reports with actionable coaching.</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; font-size: 15px; font-weight: bold; color: #ffffff;">Priority support</td>
            <td style="padding: 12px 8px; font-size: 15px; color: #D1D5DB;">Direct access — no ticket queues.</td>
          </tr>
        </table>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Pro is $29/month. Most traders say the multi-account tracking alone is worth it.</p>
        ${dripCta('Upgrade to Pro →', upgradeUrl)}
        ${dripFooterNote(false, unsubscribeUrl)}`,
    },
    {
      subject: 'Founding Member offer — 30% off Pro, forever',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">30% off Pro — locked in forever.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #f59e0b; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Founding Member Offer</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Hey ${userName} — we're still in early access, and to thank the traders who joined early, we're offering a lifetime 30% discount on Pro.</p>
        <div style="background-color: #0d1117; border: 1px solid #f59e0b; border-radius: 8px; padding: 24px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Founding Member Price</p>
          <p style="margin: 0 0 4px 0; font-size: 36px; font-weight: bold; color: #ffffff;">$20<span style="font-size: 18px; color: #9CA3AF;">/month</span></p>
          <p style="margin: 0; font-size: 13px; color: #6B7280;">was $29/month — locked in for life</p>
        </div>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">This offer is limited to early adopters and closes when we move out of early access. Once it's gone, Pro returns to $29/month — and there's no retroactive discount.</p>
        ${dripCta('Claim Founding Member Rate →', upgradeUrl)}
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">If you have questions before upgrading, reply to this email — I'll answer directly.</p>
        ${dripFooterNote(false, unsubscribeUrl)}`,
    },
    {
      subject: 'Last chance on the founding offer',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Last chance — founding offer closing.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #ef4444; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Final notice</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Hey ${userName} — this is the last reminder about the Founding Member rate.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">$20/month, locked in for life. When we move out of early access, this offer closes permanently and Pro returns to $29/month.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">If you've been thinking about it — now is the time. Spots are limited and some are already taken.</p>
        ${dripCta('Upgrade Now — $20/mo Forever →', upgradeUrl)}
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">After this email I won't mention the offer again. Whatever you decide, the free plan stays free.</p>
        ${dripFooterNote(false, unsubscribeUrl)}`,
    },
    {
      subject: "Still here? Here's a quick win for today",
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Still here? Here's something useful.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Quick win — 5 minutes</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Hey ${userName} — it's been a couple of weeks. Here's something you can do in 5 minutes today that most traders never bother with:</p>
        <div style="background-color: #0d1117; border-left: 3px solid #00D9A3; padding: 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0 0 8px 0; font-size: 17px; font-weight: bold; color: #ffffff;">Check your win rate by time of day.</p>
          <p style="margin: 0; font-size: 15px; color: #D1D5DB; line-height: 1.7;">In your TradifyApp dashboard → Analytics → filter trades by morning session (08:00–12:00) vs afternoon (12:00–17:00). Most traders discover they're dramatically better at one vs the other — and trading the wrong session anyway.</p>
        </div>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">If you find the session where you consistently lose — stop trading it. That single decision often improves monthly P&L by more than any strategy change.</p>
        ${dripCta('Check Your Session Analytics →', dashboardUrl)}
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">As always, the platform is here whenever you're ready to go deeper.</p>
        ${dripFooterNote(false, unsubscribeUrl)}`,
    },
  ];

  const entry = emails[step];
  if (!entry) return null;

  return {
    subject: entry.subject,
    html: wrapEmailBody(entry.body, entry.subject, entry.subject),
  };
}

async function queueLeadSequence(email: string): Promise<void> {
  try {
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(
        and(
          eq(schema.emailSequences.email, email),
          eq(schema.emailSequences.track, 'lead_7day')
        )
      )
      .limit(1);

    if (existing) return;

    await db.insert(schema.emailSequences).values({
      email,
      track: 'lead_7day',
      currentStep: 0,
      nextSendAt: new Date(),
      completed: false,
    });

    console.log(`[DRIP] Queued lead_7day sequence for ${email}`);
  } catch (err) {
    console.error('[DRIP] Failed to queue lead sequence:', err);
  }
}

async function queueFreeUserSequence(userId: string): Promise<void> {
  try {
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(
        and(
          eq(schema.emailSequences.userId, userId),
          eq(schema.emailSequences.track, 'free_user')
        )
      )
      .limit(1);

    if (existing) return;

    const sendAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(schema.emailSequences).values({
      userId,
      track: 'free_user',
      currentStep: 0,
      nextSendAt: sendAt,
      completed: false,
    });

    console.log(`[DRIP] Queued free_user sequence for ${userId}`);
  } catch (err) {
    console.error('[DRIP] Failed to queue free user sequence:', err);
  }
}

const FREE_USER_INTERVALS_HOURS = [24, 48, 5 * 24, 8 * 24, 14 * 24];
const FREE_USER_TOTAL_STEPS = 5;
const LEAD_TOTAL_STEPS = 7;
const FREE_ONGOING_TOTAL_STEPS = 12;
const FREE_ONGOING_INTERVAL_DAYS = 30;
const PRO_TO_ELITE_INTERVALS_DAYS = [1, 2, 4, 5, 6, 6, 4, 2];
const PRO_TO_ELITE_TOTAL_STEPS = 8;
const ELITE_RETENTION_INTERVALS_DAYS = [1, 1, 3, 2, 3, 4];
const ELITE_RETENTION_TOTAL_STEPS = 6;
const INSIGHTS_INTERVAL_DAYS = 14;
const INSIGHTS_TOTAL_STEPS = 12;

async function cancelActiveTrack(userId: string, track: string): Promise<void> {
  try {
    await db.update(schema.emailSequences)
      .set({ completed: true })
      .where(and(
        eq(schema.emailSequences.userId, userId),
        eq(schema.emailSequences.track, track),
        eq(schema.emailSequences.completed, false),
      ));
  } catch (err) {
    console.error(`[DRIP] cancelActiveTrack(${userId}, ${track}) error:`, err);
  }
}

async function queueFreeOngoingSequence(userId: string): Promise<void> {
  try {
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(and(
        eq(schema.emailSequences.userId, userId),
        eq(schema.emailSequences.track, 'free_ongoing'),
        eq(schema.emailSequences.completed, false),
      ))
      .limit(1);
    if (existing) return;
    const sendAt = new Date(Date.now() + FREE_ONGOING_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(schema.emailSequences).values({ userId, track: 'free_ongoing', currentStep: 0, nextSendAt: sendAt, completed: false });
    console.log(`[DRIP] Queued free_ongoing for ${userId}`);
  } catch (err) {
    console.error('[DRIP] queueFreeOngoingSequence error:', err);
  }
}

async function queueProToEliteSequence(userId: string): Promise<void> {
  try {
    await cancelActiveTrack(userId, 'pro_to_elite');
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(and(
        eq(schema.emailSequences.userId, userId),
        eq(schema.emailSequences.track, 'pro_to_elite'),
        eq(schema.emailSequences.completed, false),
      ))
      .limit(1);
    if (existing) return;
    const sendAt = new Date(Date.now() + PRO_TO_ELITE_INTERVALS_DAYS[0] * 24 * 60 * 60 * 1000);
    await db.insert(schema.emailSequences).values({ userId, track: 'pro_to_elite', currentStep: 0, nextSendAt: sendAt, completed: false });
    console.log(`[DRIP] Queued pro_to_elite for ${userId}`);
  } catch (err) {
    console.error('[DRIP] queueProToEliteSequence error:', err);
  }
}

async function queueEliteRetentionSequence(userId: string): Promise<void> {
  try {
    await cancelActiveTrack(userId, 'elite_retention');
    await cancelActiveTrack(userId, 'pro_to_elite');
    await cancelActiveTrack(userId, 'insights_newsletter');
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(and(
        eq(schema.emailSequences.userId, userId),
        eq(schema.emailSequences.track, 'elite_retention'),
        eq(schema.emailSequences.completed, false),
      ))
      .limit(1);
    if (existing) return;
    const sendAt = new Date(Date.now() + ELITE_RETENTION_INTERVALS_DAYS[0] * 24 * 60 * 60 * 1000);
    await db.insert(schema.emailSequences).values({ userId, track: 'elite_retention', currentStep: 0, nextSendAt: sendAt, completed: false });
    console.log(`[DRIP] Queued elite_retention for ${userId}`);
  } catch (err) {
    console.error('[DRIP] queueEliteRetentionSequence error:', err);
  }
}

async function queueInsightsNewsletterSequence(userId: string): Promise<void> {
  try {
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(and(
        eq(schema.emailSequences.userId, userId),
        eq(schema.emailSequences.track, 'insights_newsletter'),
        eq(schema.emailSequences.completed, false),
      ))
      .limit(1);
    if (existing) return;
    const sendAt = new Date(Date.now() + INSIGHTS_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(schema.emailSequences).values({ userId, track: 'insights_newsletter', currentStep: 0, nextSendAt: sendAt, completed: false });
    console.log(`[DRIP] Queued insights_newsletter for ${userId}`);
  } catch (err) {
    console.error('[DRIP] queueInsightsNewsletterSequence error:', err);
  }
}

// ==================== LIFECYCLE TRACKS (#12) ====================
// first_trade — fired ~1h after a user logs their first journal entry.
// Goal: convert "I tried it once" into a journaling habit.
const FIRST_TRADE_INTERVALS_HOURS = [1, 48, 5 * 24];
const FIRST_TRADE_TOTAL_STEPS = 3;

// first_payout — fired when a user's prop firm challenge transitions to payout.
const FIRST_PAYOUT_INTERVALS_HOURS = [0, 7 * 24];
const FIRST_PAYOUT_TOTAL_STEPS = 2;

// at_risk — fired by the inactivity detector (no trades / no journal in 14d).
const AT_RISK_INTERVALS_DAYS = [0, 4, 10];
const AT_RISK_TOTAL_STEPS = 3;
const AT_RISK_INACTIVITY_DAYS = 14;

// win_back — fired when subscription is cancelled (user keeps access until period end).
const WIN_BACK_INTERVALS_DAYS = [7, 21, 60];
const WIN_BACK_TOTAL_STEPS = 3;

function buildFirstTradeEmail(step: number, userName: string, unsubscribeUrl?: string): { subject: string; html: string } | null {
  const dashUrl = `${APP_URL}/dashboard`;
  const journalUrl = `${APP_URL}/trades`;
  const analyticsUrl = `${APP_URL}/analytics`;
  const emails: Array<{ subject: string; body: string }> = [
    {
      subject: 'First trade logged — here\'s what happens next',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Hey ${userName}, your first trade is in.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Step 1 — The journaling habit</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">One trade isn't a sample size. But it's the start of one.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">The traders who get the most from TradifyApp do one thing: they log every trade the same day, with two fields filled — <strong style="color: #ffffff;">emotional state at entry</strong> and <strong style="color: #ffffff;">whether the trade matched their setup</strong>.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">That's it. Two checkboxes. The data compounds.</p>
        ${dripCta('Open Your Journal →', journalUrl)}
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">In two days I'll send you what to look for once you have ten trades logged. Patterns start appearing earlier than most traders think.</p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'Patterns appear at 10 trades (not 100)',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Patterns show up faster than you'd think.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Step 2 — Reading your own data</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">A common myth: you need 100+ trades before journaling tells you anything useful. Not true.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">By trade 10, three signals usually emerge:</p>
        <ol style="margin: 0 0 20px 0; padding: 0 0 0 20px; color: #D1D5DB;">
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Time-of-day edge</strong> — your win rate is rarely flat across sessions.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Setup quality drift</strong> — the % of trades that didn't match your defined setup.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Emotional state correlation</strong> — your best and worst trades cluster around specific feelings.</li>
        </ol>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">TradifyApp's Analytics view shows all three the moment you cross 10 logged trades.</p>
        ${dripCta('See What Your Data Says →', analyticsUrl)}
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'The one journal field 90% of traders skip',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">The field most traders skip — and shouldn't.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Step 3 — The compounding question</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">After every trade, ask one question and write the honest answer:</p>
        <div style="background-color: #0d1117; border-left: 3px solid #00D9A3; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; font-size: 17px; color: #ffffff; line-height: 1.7; font-weight: 700;">"Would I take this trade again tomorrow, exactly as I executed it?"</p>
        </div>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">If yes — even on a loser — your process is intact. If no — even on a winner — you got lucky and you know it.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">This single question separates traders who improve from traders who plateau. It works because it strips out P&L bias and forces you to evaluate the decision.</p>
        ${dripCta('Add It To Your Next Trade →', journalUrl)}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">— The Tradify team. Hit reply anytime if a feature would help you.</p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
  ];
  const entry = emails[step];
  if (!entry) return null;
  return { subject: entry.subject, html: wrapEmailBody(entry.body, entry.subject, entry.subject, unsubscribeUrl) };
}

function buildFirstPayoutEmail(step: number, userName: string, unsubscribeUrl?: string): { subject: string; html: string } | null {
  const dashUrl = `${APP_URL}/dashboard`;
  const propUrl = `${APP_URL}/prop-firms`;
  const emails: Array<{ subject: string; body: string }> = [
    {
      subject: '🎉 First payout cleared — protect what you just built',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">${userName}, you got the first payout.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Milestone — and inflection point</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Genuinely well done. The first payout is the moment a prop firm account stops feeling like a video game and starts feeling like a business.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">It's also the moment most traders quietly start over-trading. The "house money" instinct kicks in. Position sizes creep up. Rules get bent "just this once."</p>
        <div style="background-color: #0d1117; border-left: 3px solid #f59e0b; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; font-size: 15px; color: #D1D5DB; line-height: 1.7;"><strong style="color: #ffffff;">The data is brutal:</strong> a meaningful share of payout-eligible accounts are breached within 4 weeks of the first payout. Not because the strategy stopped working — because the trader did.</p>
        </div>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">My suggestion: this week, change <strong style="color: #ffffff;">nothing</strong>. Same setups, same size, same session length. Use TradifyApp's session-rule lock to make it impossible to drift.</p>
        ${dripCta('Lock In Your Current Rules →', dashUrl)}
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">In a week I'll send you the framework for whether to compound on the same account or scale out across accounts. It's a real decision and it has wrong answers.</p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'Compound on one account or scale across many?',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Compound or scale — the framework.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Post-payout decision</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">After the first payout, every funded trader hits the same fork:</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;"><strong style="color: #ffffff;">Path A — Compound the same account.</strong> Larger size on a familiar firm, familiar rules, familiar drawdown math. Higher mental load per trade. One bad day hurts more.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;"><strong style="color: #ffffff;">Path B — Scale across accounts.</strong> Multiple smaller accounts, possibly different firms. Diversification of rules and reset cycles. Higher operational complexity. Lower per-trade pressure.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">A simple rule of thumb: if your largest single-day loss in the last 30 days exceeded 30% of your daily limit, choose Path B. Your tolerance for size hasn't caught up to your strategy yet.</p>
        ${dripCta('Compare Firms Side-by-Side →', propUrl)}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">TradifyApp's prop firm tracker handles multi-account view in the Pro tier — every account on one screen with per-firm rule monitoring.</p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
  ];
  const entry = emails[step];
  if (!entry) return null;
  return { subject: entry.subject, html: wrapEmailBody(entry.body, entry.subject, entry.subject, unsubscribeUrl) };
}

function buildAtRiskEmail(step: number, userName: string, unsubscribeUrl?: string): { subject: string; html: string } | null {
  const dashUrl = `${APP_URL}/dashboard`;
  const checklistUrl = `${APP_URL}/checklist`;
  const emails: Array<{ subject: string; body: string }> = [
    {
      subject: 'Haven\'t seen you trade in 2 weeks',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">${userName} — quick check-in.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">No pressure — genuinely curious</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Your TradifyApp account hasn't seen activity in about two weeks. Three things this could mean — none of them are wrong:</p>
        <ol style="margin: 0 0 20px 0; padding: 0 0 0 20px; color: #D1D5DB;">
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">You're <strong style="color: #ffffff;">deliberately stepping back</strong> after a rough patch — smartest thing many traders ever do.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">You're <strong style="color: #ffffff;">trading on a different platform</strong> and forgot to keep journaling here.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;">You <strong style="color: #ffffff;">tried it and the workflow didn't click</strong>. That's useful feedback.</li>
        </ol>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Whichever it is, no email from a tool is going to make you trade. But if it's #2 or #3, I'd love to know — hit reply.</p>
        ${dripCta('Open Dashboard →', dashUrl)}
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'The discipline reset — one focused week',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">If you want back in — one focused week.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">A simple restart protocol</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Coming back to trading after a break is harder than starting cold. The temptation is to "make up for lost time." Don't.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">A protocol that works for most traders we talk to:</p>
        <ol style="margin: 0 0 20px 0; padding: 0 0 0 20px; color: #D1D5DB;">
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Day 1–3:</strong> watch your charts, take zero trades. Re-anchor your setups.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Day 4–5:</strong> trade <em>half</em> your normal size, full rules, journal everything.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Day 6–7:</strong> review what your data says, only then return to normal sizing.</li>
        </ol>
        ${dripCta('Reload Your Pre-Session Checklist →', checklistUrl)}
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'One last note from us',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Last note — and then we'll be quiet.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">No more re-engagement emails after this</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">If trading isn't where you are right now — totally fair. Markets will be there.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">If you do come back, your account, your rules, and your journal history are exactly where you left them. Free, no time limit.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">After this email I'll stop the inactivity check-ins. You'll still get product updates and risk alerts if you've enabled them.</p>
        ${dripCta('Take One Look →', dashUrl)}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">— Tradify team</p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
  ];
  const entry = emails[step];
  if (!entry) return null;
  return { subject: entry.subject, html: wrapEmailBody(entry.body, entry.subject, entry.subject, unsubscribeUrl) };
}

function buildWinBackEmail(step: number, userName: string, unsubscribeUrl?: string): { subject: string; html: string } | null {
  const pricingUrl = `${APP_URL}/pricing`;
  const changelogUrl = `${APP_URL}/changelog`;
  const replyTo = 'reply';
  const emails: Array<{ subject: string; body: string }> = [
    {
      subject: 'You cancelled — what could have been better?',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">${userName} — one quick question.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Sorry to see you go</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">No pitch in this email. Just one question: what was missing?</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">If you hit reply with even a one-line answer — pricing, missing feature, didn't fit your workflow, switched platforms, took a break from trading — it goes directly to the team. Every cancellation reason gets read and triaged.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">The honest, slightly-uncomfortable answers are the ones that change the product fastest.</p>
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">— The Tradify team. Just hit reply.</p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'What we shipped since you left',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">Three weeks. Here's what's new.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">No pressure — just a heads-up</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">A few things landed since you cancelled — sharing in case any of them was your blocker:</p>
        <ul style="margin: 0 0 20px 0; padding: 0 0 0 20px; color: #D1D5DB;">
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Live push alerts</strong> — drawdown and revenge-trade warnings now arrive in real time, not on a delay.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Per-firm trackers</strong> — every major prop firm with live rule monitoring against your equity curve.</li>
          <li style="margin-bottom: 10px; font-size: 16px; line-height: 1.7;"><strong style="color: #ffffff;">Behavioral risk engine</strong> — pattern detection across overtrading, position size creep, and session-time drift.</li>
        </ul>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">Your account is still there. If you want to take another look:</p>
        ${dripCta('See What\'s New →', changelogUrl)}
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
    {
      subject: 'Last note — 50% off if you want back in',
      body: `
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #ffffff;">A standing offer — and then we're done.</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #00D9A3; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">Final win-back email</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">If TradifyApp didn't fit before but you've been thinking about coming back: <strong style="color: #ffffff;">use code RETURN50 for 50% off the first 3 months</strong> on any plan.</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #D1D5DB; line-height: 1.7;">No expiration on this email — the code is valid whenever you're ready. After this message we won't email you about subscription stuff again.</p>
        ${dripCta('Restart at 50% Off →', pricingUrl)}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #9CA3AF; line-height: 1.6; border-top: 1px solid #1F2937; padding-top: 16px; font-style: italic;">Either way — wishing you good trading. — Tradify team</p>
        ${dripFooterNote(true, unsubscribeUrl)}`,
    },
  ];
  const entry = emails[step];
  if (!entry) return null;
  return { subject: entry.subject, html: wrapEmailBody(entry.body, entry.subject, entry.subject, unsubscribeUrl) };
}

async function queueFirstTradeSequence(userId: string): Promise<void> {
  try {
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(and(eq(schema.emailSequences.userId, userId), eq(schema.emailSequences.track, 'first_trade')))
      .limit(1);
    if (existing) return;
    const sendAt = new Date(Date.now() + FIRST_TRADE_INTERVALS_HOURS[0] * 60 * 60 * 1000);
    await db.insert(schema.emailSequences).values({ userId, track: 'first_trade', currentStep: 0, nextSendAt: sendAt, completed: false });
    console.log(`[DRIP] Queued first_trade for ${userId}`);
  } catch (err) {
    console.error('[DRIP] queueFirstTradeSequence error:', err);
  }
}

async function queueFirstPayoutSequence(userId: string): Promise<void> {
  try {
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(and(eq(schema.emailSequences.userId, userId), eq(schema.emailSequences.track, 'first_payout')))
      .limit(1);
    if (existing) return;
    const sendAt = new Date(Date.now() + FIRST_PAYOUT_INTERVALS_HOURS[0] * 60 * 60 * 1000);
    await db.insert(schema.emailSequences).values({ userId, track: 'first_payout', currentStep: 0, nextSendAt: sendAt, completed: false });
    console.log(`[DRIP] Queued first_payout for ${userId}`);
  } catch (err) {
    console.error('[DRIP] queueFirstPayoutSequence error:', err);
  }
}

async function queueAtRiskSequence(userId: string): Promise<void> {
  try {
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(and(eq(schema.emailSequences.userId, userId), eq(schema.emailSequences.track, 'at_risk'), eq(schema.emailSequences.completed, false)))
      .limit(1);
    if (existing) return;
    const sendAt = new Date(Date.now() + AT_RISK_INTERVALS_DAYS[0] * 24 * 60 * 60 * 1000);
    await db.insert(schema.emailSequences).values({ userId, track: 'at_risk', currentStep: 0, nextSendAt: sendAt, completed: false });
    console.log(`[DRIP] Queued at_risk for ${userId}`);
  } catch (err) {
    console.error('[DRIP] queueAtRiskSequence error:', err);
  }
}

async function queueWinBackSequence(userId: string): Promise<void> {
  try {
    await cancelActiveTrack(userId, 'win_back');
    // Re-check after cancellation — guards against rapid concurrent cancels
    // creating duplicate active rows. cancelActiveTrack only sets completed=true
    // on rows that were active, so an active row created between the cancel
    // and the insert would be missed without this guard.
    const [existing] = await db.select({ id: schema.emailSequences.id })
      .from(schema.emailSequences)
      .where(and(
        eq(schema.emailSequences.userId, userId),
        eq(schema.emailSequences.track, 'win_back'),
        eq(schema.emailSequences.completed, false),
      ))
      .limit(1);
    if (existing) return;
    const sendAt = new Date(Date.now() + WIN_BACK_INTERVALS_DAYS[0] * 24 * 60 * 60 * 1000);
    await db.insert(schema.emailSequences).values({ userId, track: 'win_back', currentStep: 0, nextSendAt: sendAt, completed: false });
    console.log(`[DRIP] Queued win_back for ${userId}`);
  } catch (err) {
    console.error('[DRIP] queueWinBackSequence error:', err);
  }
}

// At-risk detector — scans FREE/PRO users with no journal activity for
// AT_RISK_INACTIVITY_DAYS days and queues the at_risk track. Runs on the
// same schedule as processDripSequences. ELITE users skip this — they
// already get touchpoints via elite_retention.
async function scanForAtRiskUsers(): Promise<void> {
  try {
    const { sql } = await import("drizzle-orm");
    const cutoff = new Date(Date.now() - AT_RISK_INACTIVITY_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await db.select({
      userId: schema.userRole.userId,
      tier: schema.userRole.subscriptionTier,
      createdAt: schema.userRole.createdAt,
    })
      .from(schema.userRole)
      .where(and(
        ne(schema.userRole.role, 'OWNER'),
        ne(schema.userRole.role, 'ADMIN'),
        lte(schema.userRole.createdAt, cutoff),
      ));

    let queued = 0;
    for (const u of candidates) {
      const tier = (u.tier || 'FREE').toUpperCase();
      if (tier === 'ELITE') continue;
      const [latestTrade] = await db.select({ createdAt: schema.tradeJournal.createdAt })
        .from(schema.tradeJournal)
        .where(eq(schema.tradeJournal.userId, u.userId))
        .orderBy(sql`${schema.tradeJournal.createdAt} DESC`)
        .limit(1);
      const lastActivity = latestTrade?.createdAt ? new Date(latestTrade.createdAt) : (u.createdAt ? new Date(u.createdAt) : null);
      if (!lastActivity) continue;
      if (lastActivity > cutoff) continue;
      const [existing] = await db.select({ id: schema.emailSequences.id })
        .from(schema.emailSequences)
        .where(and(eq(schema.emailSequences.userId, u.userId), eq(schema.emailSequences.track, 'at_risk'), eq(schema.emailSequences.completed, false)))
        .limit(1);
      if (existing) continue;
      const [recentAtRisk] = await db.select({ id: schema.emailSequences.id, nextSendAt: schema.emailSequences.nextSendAt })
        .from(schema.emailSequences)
        .where(and(eq(schema.emailSequences.userId, u.userId), eq(schema.emailSequences.track, 'at_risk')))
        .orderBy(sql`${schema.emailSequences.nextSendAt} DESC`)
        .limit(1);
      if (recentAtRisk?.nextSendAt) {
        const daysSince = (Date.now() - new Date(recentAtRisk.nextSendAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 90) continue;
      }
      await queueAtRiskSequence(u.userId);
      queued++;
    }
    if (queued > 0) console.log(`[DRIP] Queued at_risk for ${queued} inactive users`);
  } catch (err) {
    console.error('[DRIP] scanForAtRiskUsers error:', err);
  }
}

async function backfillUnsubscribeTokens(): Promise<void> {
  try {
    const { isNull } = await import("drizzle-orm");
    const usersWithoutToken = await db.select({ userId: schema.userRole.userId })
      .from(schema.userRole)
      .where(isNull(schema.userRole.unsubscribeToken));
    if (usersWithoutToken.length > 0) {
      const crypto = await import("crypto");
      for (const user of usersWithoutToken) {
        await db.update(schema.userRole)
          .set({ unsubscribeToken: crypto.randomUUID() })
          .where(eq(schema.userRole.userId, user.userId));
      }
      console.log(`[UNSUB] Backfilled unsubscribe tokens for ${usersWithoutToken.length} users`);
    }
  } catch (err) {
    console.error('[UNSUB] backfillUnsubscribeTokens error:', err);
  }
}

async function backfillEmailSequences(): Promise<void> {
  try {
    await backfillUnsubscribeTokens();
    const allUsers = await db.select({
      userId: schema.userRole.userId,
      subscriptionTier: schema.userRole.subscriptionTier,
      subscriptionStatus: schema.userRole.subscriptionStatus,
      createdAt: schema.userRole.createdAt,
    }).from(schema.userRole).where(
      and(
        ne(schema.userRole.role, 'OWNER'),
        ne(schema.userRole.role, 'ADMIN')
      )
    );

    for (const user of allUsers) {
      const tier = user.subscriptionTier?.toUpperCase() || 'FREE';
      const isActive = !user.subscriptionStatus || user.subscriptionStatus === 'ACTIVE' || user.subscriptionStatus === 'active' || user.subscriptionStatus === 'cancelled';

      if (tier === 'ELITE' && isActive) {
        const [hasEliteRetention] = await db.select({ id: schema.emailSequences.id })
          .from(schema.emailSequences)
          .where(and(eq(schema.emailSequences.userId, user.userId), eq(schema.emailSequences.track, 'elite_retention'), eq(schema.emailSequences.completed, false)))
          .limit(1);
        if (!hasEliteRetention) {
          await queueEliteRetentionSequence(user.userId);
        }
      }

      if (tier === 'PRO' && isActive) {
        const [hasProToElite] = await db.select({ id: schema.emailSequences.id })
          .from(schema.emailSequences)
          .where(and(eq(schema.emailSequences.userId, user.userId), eq(schema.emailSequences.track, 'pro_to_elite'), eq(schema.emailSequences.completed, false)))
          .limit(1);
        if (!hasProToElite) {
          await queueProToEliteSequence(user.userId);
        }
      }

      if ((tier === 'PRO' || tier === 'ELITE') && isActive) {
        await queueInsightsNewsletterSequence(user.userId);
      }

      if (tier === 'FREE') {
        const [hasFreeOngoing] = await db.select({ id: schema.emailSequences.id })
          .from(schema.emailSequences)
          .where(and(eq(schema.emailSequences.userId, user.userId), eq(schema.emailSequences.track, 'free_ongoing')))
          .limit(1);
        const [completedFreeUser] = await db.select({ id: schema.emailSequences.id })
          .from(schema.emailSequences)
          .where(and(eq(schema.emailSequences.userId, user.userId), eq(schema.emailSequences.track, 'free_user'), eq(schema.emailSequences.completed, true)))
          .limit(1);
        if (completedFreeUser && !hasFreeOngoing) {
          await queueFreeOngoingSequence(user.userId);
        }
      }
    }

    console.log('[DRIP] Backfill complete');
  } catch (err) {
    console.error('[DRIP] backfillEmailSequences error:', err);
  }
}

async function processDripSequences(): Promise<void> {
  try {
    const now = new Date();

    const dueSequences = await db.select()
      .from(schema.emailSequences)
      .where(
        and(
          eq(schema.emailSequences.completed, false),
          lte(schema.emailSequences.nextSendAt, now)
        )
      );

    for (const seq of dueSequences) {
      try {
        if (seq.userId && await isUserUnsubscribed(seq.userId)) {
          await db.update(schema.emailSequences)
            .set({ completed: true })
            .where(eq(schema.emailSequences.id, seq.id));
          console.log(`[DRIP] Skipping sequence ${seq.id} for unsubscribed user ${seq.userId}`);
          continue;
        }

        if (seq.track === 'lead_7day') {
          if (!seq.email) {
            await db.update(schema.emailSequences)
              .set({ completed: true })
              .where(eq(schema.emailSequences.id, seq.id));
            continue;
          }

          const leadUnsubUrl = seq.userId ? await getUnsubscribeUrl(seq.userId) : "";
          const emailData = buildLeadEmail(seq.currentStep, seq.email, leadUnsubUrl);
          if (!emailData) {
            await db.update(schema.emailSequences)
              .set({ completed: true })
              .where(eq(schema.emailSequences.id, seq.id));
            continue;
          }

          const leadHeaders: Record<string, string> = {};
          if (leadUnsubUrl) leadHeaders['List-Unsubscribe'] = `<${leadUnsubUrl}>`;
          const sent = await sendEmail(seq.email, emailData.subject, emailData.html, true, Object.keys(leadHeaders).length ? leadHeaders : undefined);
          console.log(`[DRIP] Lead step ${seq.currentStep} → ${seq.email}: ${sent ? 'sent' : 'failed'}`);

          const nextStep = seq.currentStep + 1;
          const isLastStep = nextStep >= LEAD_TOTAL_STEPS;

          await db.update(schema.emailSequences)
            .set({
              currentStep: nextStep,
              nextSendAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              completed: isLastStep,
            })
            .where(eq(schema.emailSequences.id, seq.id));

        } else if (seq.track === 'free_user') {
          if (!seq.userId) {
            await db.update(schema.emailSequences)
              .set({ completed: true })
              .where(eq(schema.emailSequences.id, seq.id));
            continue;
          }

          const [user] = await db.select({
            userId: schema.userRole.userId,
            subscriptionTier: schema.userRole.subscriptionTier,
            fullName: schema.userRole.fullName,
          })
            .from(schema.userRole)
            .where(eq(schema.userRole.userId, seq.userId))
            .limit(1);

          if (!user) {
            await db.update(schema.emailSequences)
              .set({ completed: true })
              .where(eq(schema.emailSequences.id, seq.id));
            continue;
          }

          const tier = user.subscriptionTier?.toUpperCase();
          if (tier === 'PRO' || tier === 'ELITE') {
            await db.update(schema.emailSequences)
              .set({ completed: true })
              .where(eq(schema.emailSequences.id, seq.id));
            console.log(`[DRIP] Skipping free_user sequence for upgraded user ${seq.userId}`);
            continue;
          }

          const userName = user.fullName || seq.userId.split('@')[0];
          const unsubUrl = await getUnsubscribeUrl(seq.userId);
          const emailData = await buildFreeUserEmail(seq.currentStep, seq.userId, userName, unsubUrl);

          if (!emailData) {
            await db.update(schema.emailSequences)
              .set({ completed: true })
              .where(eq(schema.emailSequences.id, seq.id));
            continue;
          }

          const headers: Record<string, string> = {};
          if (unsubUrl) headers['List-Unsubscribe'] = `<${unsubUrl}>`;
          const sent = await sendEmail(seq.userId, emailData.subject, emailData.html, true, Object.keys(headers).length ? headers : undefined);
          console.log(`[DRIP] Free user step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);

          const nextStep = seq.currentStep + 1;
          const isLastStep = nextStep >= FREE_USER_TOTAL_STEPS;

          const nextIntervalHours = FREE_USER_INTERVALS_HOURS[nextStep] ?? 24;
          const nextSendAt = new Date(Date.now() + nextIntervalHours * 60 * 60 * 1000);

          await db.update(schema.emailSequences)
            .set({ currentStep: nextStep, nextSendAt, completed: isLastStep })
            .where(eq(schema.emailSequences.id, seq.id));

          if (isLastStep && seq.userId) {
            queueFreeOngoingSequence(seq.userId).catch(e => console.error('[DRIP] queueFreeOngoing after free_user:', e));
          }

        } else if (seq.track === 'free_ongoing') {
          if (!seq.userId) {
            await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id));
            continue;
          }
          const [user] = await db.select({ userId: schema.userRole.userId, subscriptionTier: schema.userRole.subscriptionTier, fullName: schema.userRole.fullName, createdAt: schema.userRole.createdAt })
            .from(schema.userRole).where(eq(schema.userRole.userId, seq.userId)).limit(1);
          if (!user) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const tier = user.subscriptionTier?.toUpperCase() || 'FREE';
          if (tier === 'PRO' || tier === 'ELITE') {
            await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id));
            continue;
          }
          const topics = [
            'Trading psychology and the discipline loop',
            'MT5 setup guide and getting your connector running',
            'Rule engine: how to create rules that actually enforce your plan',
            'Analytics deep-dive: win rate by session and day of week',
            'Prop firm challenge tracker and staying inside drawdown',
            'Education hub: 3 lessons every disciplined trader should know',
            'Session analysis: trading the right time of day',
            'Revenge trading: how to identify and stop it',
            'Risk management: position sizing and the 1% rule',
            'Common trading mistakes and how TradifyApp catches them',
            'Consistency metrics: what the data says about your best days',
            'Why upgrading to Pro changes how you see your trading data',
          ];
          const userName = user.fullName || seq.userId.split('@')[0];
          const daysSinceSignup = user.createdAt ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          const topic = topics[seq.currentStep % topics.length];
          const mt5Check = await db.select({ id: schema.mt5Data.id }).from(schema.mt5Data).where(eq(schema.mt5Data.userId, seq.userId)).limit(1);
          const hasMt5 = mt5Check.length > 0;
          const ruleCount = await getUserRuleCount(seq.userId);
          const userData: AIEmailUserData = { name: userName, tier, hasMt5, ruleCount, daysSinceSignup, email: seq.userId };
          const aiResult = await generateAIEmail('free_ongoing', userData, { topic, step: seq.currentStep });
          if (aiResult) {
            const unsubUrl = await getUnsubscribeUrl(seq.userId);
            const html = wrapEmailBody(aiResult.body, aiResult.subject, aiResult.subject, unsubUrl);
            const headers: Record<string, string> = {};
            if (unsubUrl) headers['List-Unsubscribe'] = `<${unsubUrl}>`;
            const sent = await sendEmail(seq.userId, aiResult.subject, html, true, Object.keys(headers).length ? headers : undefined);
            console.log(`[DRIP] free_ongoing step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);
          }
          const nextStep = seq.currentStep + 1;
          const willCycle = nextStep >= FREE_ONGOING_TOTAL_STEPS;
          const nextSendAt = new Date(Date.now() + FREE_ONGOING_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
          await db.update(schema.emailSequences)
            .set({ currentStep: willCycle ? 0 : nextStep, nextSendAt, completed: false })
            .where(eq(schema.emailSequences.id, seq.id));

        } else if (seq.track === 'pro_to_elite') {
          if (!seq.userId) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const [user] = await db.select({ userId: schema.userRole.userId, subscriptionTier: schema.userRole.subscriptionTier, fullName: schema.userRole.fullName, createdAt: schema.userRole.createdAt })
            .from(schema.userRole).where(eq(schema.userRole.userId, seq.userId)).limit(1);
          if (!user) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const tier = user.subscriptionTier?.toUpperCase() || 'FREE';
          if (tier !== 'PRO') { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const topics = [
            'Welcome to Pro — what to use first',
            'Advanced analytics: your win rate by session, day, and setup',
            'Unlimited rule engine — building a complete trading plan',
            'Multi-account MT5 tracking — managing multiple challenges',
            'Prop Firm Challenge Tracker with FTMO, The5ers, FundedNext, Funding Pips, Alpha Capital, Topstep, E8, Lux + custom presets',
            'AI instrument analysis and what it tells you',
            'Full 19-lesson education hub — structured trading knowledge',
            'Why Elite is the next step: behavioral risk and AI coaching',
          ];
          const userName = user.fullName || seq.userId.split('@')[0];
          const daysSinceSignup = user.createdAt ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          const mt5Check = await db.select({ id: schema.mt5Data.id }).from(schema.mt5Data).where(eq(schema.mt5Data.userId, seq.userId)).limit(1);
          const hasMt5 = mt5Check.length > 0;
          const ruleCount = await getUserRuleCount(seq.userId);
          const topic = topics[seq.currentStep] || topics[topics.length - 1];
          const userData: AIEmailUserData = { name: userName, tier, hasMt5, ruleCount, daysSinceSignup, email: seq.userId };
          const aiResult = await generateAIEmail('pro_to_elite', userData, { topic, step: seq.currentStep });
          if (aiResult) {
            const unsubUrl = await getUnsubscribeUrl(seq.userId);
            const html = wrapEmailBody(aiResult.body, aiResult.subject, aiResult.subject, unsubUrl);
            const headers: Record<string, string> = {};
            if (unsubUrl) headers['List-Unsubscribe'] = `<${unsubUrl}>`;
            const sent = await sendEmail(seq.userId, aiResult.subject, html, true, Object.keys(headers).length ? headers : undefined);
            console.log(`[DRIP] pro_to_elite step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);
          }
          const nextStep = seq.currentStep + 1;
          const isLastStep = nextStep >= PRO_TO_ELITE_TOTAL_STEPS;
          const intervalDays = PRO_TO_ELITE_INTERVALS_DAYS[nextStep] ?? 3;
          const nextSendAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
          await db.update(schema.emailSequences)
            .set({ currentStep: nextStep, nextSendAt, completed: isLastStep })
            .where(eq(schema.emailSequences.id, seq.id));
          if (isLastStep) {
            queueInsightsNewsletterSequence(seq.userId).catch(e => console.error('[DRIP] queueInsights after pro_to_elite:', e));
          }

        } else if (seq.track === 'elite_retention') {
          if (!seq.userId) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const [user] = await db.select({ userId: schema.userRole.userId, subscriptionTier: schema.userRole.subscriptionTier, fullName: schema.userRole.fullName, createdAt: schema.userRole.createdAt })
            .from(schema.userRole).where(eq(schema.userRole.userId, seq.userId)).limit(1);
          if (!user) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const eliteTier = user.subscriptionTier?.toUpperCase() || 'FREE';
          if (eliteTier !== 'ELITE') { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const topics = [
            'Welcome to Elite — your full platform overview',
            'Behavioral risk flags: what TradifyApp watches for',
            'Session analytics deep-dive: your edge by time and session',
            'AI challenge risk warnings: staying inside prop firm limits',
            'Strategy deviation analysis: when you drift from your plan',
            'Monthly AI review reports with personalized coaching',
          ];
          const userName = user.fullName || seq.userId.split('@')[0];
          const daysSinceSignup = user.createdAt ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          const mt5Check = await db.select({ id: schema.mt5Data.id }).from(schema.mt5Data).where(eq(schema.mt5Data.userId, seq.userId)).limit(1);
          const hasMt5 = mt5Check.length > 0;
          const ruleCount = await getUserRuleCount(seq.userId);
          const topic = topics[seq.currentStep] || topics[topics.length - 1];
          const userData: AIEmailUserData = { name: userName, tier: 'ELITE', hasMt5, ruleCount, daysSinceSignup, email: seq.userId };
          const aiResult = await generateAIEmail('elite_retention', userData, { topic, step: seq.currentStep, isElite: true });
          if (aiResult) {
            const unsubUrl = await getUnsubscribeUrl(seq.userId);
            const html = wrapEmailBody(aiResult.body, aiResult.subject, aiResult.subject, unsubUrl);
            const headers: Record<string, string> = {};
            if (unsubUrl) headers['List-Unsubscribe'] = `<${unsubUrl}>`;
            const sent = await sendEmail(seq.userId, aiResult.subject, html, true, Object.keys(headers).length ? headers : undefined);
            console.log(`[DRIP] elite_retention step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);
          }
          const nextStep = seq.currentStep + 1;
          const isLastStep = nextStep >= ELITE_RETENTION_TOTAL_STEPS;
          const intervalDays = ELITE_RETENTION_INTERVALS_DAYS[nextStep] ?? 7;
          const nextSendAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
          await db.update(schema.emailSequences)
            .set({ currentStep: nextStep, nextSendAt, completed: isLastStep })
            .where(eq(schema.emailSequences.id, seq.id));
          if (isLastStep) {
            queueInsightsNewsletterSequence(seq.userId).catch(e => console.error('[DRIP] queueInsights after elite_retention:', e));
          }

        } else if (seq.track === 'insights_newsletter') {
          if (!seq.userId) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const [user] = await db.select({ userId: schema.userRole.userId, subscriptionTier: schema.userRole.subscriptionTier, fullName: schema.userRole.fullName, createdAt: schema.userRole.createdAt })
            .from(schema.userRole).where(eq(schema.userRole.userId, seq.userId)).limit(1);
          if (!user) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const tier = user.subscriptionTier?.toUpperCase() || 'FREE';
          if (tier === 'FREE') { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const isElite = tier === 'ELITE';
          const userName = user.fullName || seq.userId.split('@')[0];
          const daysSinceSignup = user.createdAt ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          const mt5Check = await db.select({ id: schema.mt5Data.id }).from(schema.mt5Data).where(eq(schema.mt5Data.userId, seq.userId)).limit(1);
          const hasMt5 = mt5Check.length > 0;
          const ruleCount = await getUserRuleCount(seq.userId);
          const newsHeadlines = await fetchMarketNews();
          const userData: AIEmailUserData = { name: userName, tier, hasMt5, ruleCount, daysSinceSignup, email: seq.userId };
          const aiResult = await generateAIEmail('insights_newsletter', userData, {
            topic: 'Market insights and prop firm trading discipline',
            newsHeadlines,
            step: seq.currentStep,
            isElite,
          });
          if (aiResult) {
            const unsubUrl = await getUnsubscribeUrl(seq.userId);
            const html = wrapEmailBody(aiResult.body, aiResult.subject, aiResult.subject, unsubUrl);
            const headers: Record<string, string> = {};
            if (unsubUrl) headers['List-Unsubscribe'] = `<${unsubUrl}>`;
            const sent = await sendEmail(seq.userId, aiResult.subject, html, true, Object.keys(headers).length ? headers : undefined);
            console.log(`[DRIP] insights_newsletter step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);
          }
          const nextStep = seq.currentStep + 1;
          const willCycle = nextStep >= INSIGHTS_TOTAL_STEPS;
          const nextSendAt = new Date(Date.now() + INSIGHTS_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
          await db.update(schema.emailSequences)
            .set({ currentStep: willCycle ? 0 : nextStep, nextSendAt, completed: false })
            .where(eq(schema.emailSequences.id, seq.id));

        } else if (seq.track === 'first_trade') {
          if (!seq.userId) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const [user] = await db.select({ userId: schema.userRole.userId, fullName: schema.userRole.fullName })
            .from(schema.userRole).where(eq(schema.userRole.userId, seq.userId)).limit(1);
          if (!user) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const userName = user.fullName || seq.userId.split('@')[0];
          const unsubUrl = await getUnsubscribeUrl(seq.userId);
          const emailData = buildFirstTradeEmail(seq.currentStep, userName, unsubUrl);
          if (!emailData) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const headers: Record<string, string> = {};
          if (unsubUrl) headers['List-Unsubscribe'] = `<${unsubUrl}>`;
          const sent = await sendEmail(seq.userId, emailData.subject, emailData.html, true, Object.keys(headers).length ? headers : undefined);
          console.log(`[DRIP] first_trade step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);
          const nextStep = seq.currentStep + 1;
          const isLastStep = nextStep >= FIRST_TRADE_TOTAL_STEPS;
          const nextHours = FIRST_TRADE_INTERVALS_HOURS[nextStep] ?? 24;
          await db.update(schema.emailSequences)
            .set({ currentStep: nextStep, nextSendAt: new Date(Date.now() + nextHours * 60 * 60 * 1000), completed: isLastStep })
            .where(eq(schema.emailSequences.id, seq.id));

        } else if (seq.track === 'first_payout') {
          if (!seq.userId) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const [user] = await db.select({ userId: schema.userRole.userId, fullName: schema.userRole.fullName })
            .from(schema.userRole).where(eq(schema.userRole.userId, seq.userId)).limit(1);
          if (!user) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const userName = user.fullName || seq.userId.split('@')[0];
          const unsubUrl = await getUnsubscribeUrl(seq.userId);
          const emailData = buildFirstPayoutEmail(seq.currentStep, userName, unsubUrl);
          if (!emailData) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const headers: Record<string, string> = {};
          if (unsubUrl) headers['List-Unsubscribe'] = `<${unsubUrl}>`;
          const sent = await sendEmail(seq.userId, emailData.subject, emailData.html, true, Object.keys(headers).length ? headers : undefined);
          console.log(`[DRIP] first_payout step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);
          const nextStep = seq.currentStep + 1;
          const isLastStep = nextStep >= FIRST_PAYOUT_TOTAL_STEPS;
          const nextHours = FIRST_PAYOUT_INTERVALS_HOURS[nextStep] ?? 24;
          await db.update(schema.emailSequences)
            .set({ currentStep: nextStep, nextSendAt: new Date(Date.now() + nextHours * 60 * 60 * 1000), completed: isLastStep })
            .where(eq(schema.emailSequences.id, seq.id));

        } else if (seq.track === 'at_risk') {
          if (!seq.userId) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const [user] = await db.select({ userId: schema.userRole.userId, fullName: schema.userRole.fullName })
            .from(schema.userRole).where(eq(schema.userRole.userId, seq.userId)).limit(1);
          if (!user) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          // Stop the sequence the moment the user comes back: if any trade
          // was journaled in the last 7 days, mark this track complete.
          const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const [recentTrade] = await db.select({ id: schema.tradeJournal.id })
            .from(schema.tradeJournal)
            .where(and(eq(schema.tradeJournal.userId, seq.userId), gte(schema.tradeJournal.createdAt, recentCutoff)))
            .limit(1);
          if (recentTrade) {
            await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id));
            console.log(`[DRIP] at_risk cancelled — ${seq.userId} returned to journaling`);
            continue;
          }
          const userName = user.fullName || seq.userId.split('@')[0];
          const unsubUrl = await getUnsubscribeUrl(seq.userId);
          const emailData = buildAtRiskEmail(seq.currentStep, userName, unsubUrl);
          if (!emailData) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const headers: Record<string, string> = {};
          if (unsubUrl) headers['List-Unsubscribe'] = `<${unsubUrl}>`;
          const sent = await sendEmail(seq.userId, emailData.subject, emailData.html, true, Object.keys(headers).length ? headers : undefined);
          console.log(`[DRIP] at_risk step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);
          const nextStep = seq.currentStep + 1;
          const isLastStep = nextStep >= AT_RISK_TOTAL_STEPS;
          const nextDays = AT_RISK_INTERVALS_DAYS[nextStep] ?? 7;
          await db.update(schema.emailSequences)
            .set({ currentStep: nextStep, nextSendAt: new Date(Date.now() + nextDays * 24 * 60 * 60 * 1000), completed: isLastStep })
            .where(eq(schema.emailSequences.id, seq.id));

        } else if (seq.track === 'win_back') {
          if (!seq.userId) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const [user] = await db.select({ userId: schema.userRole.userId, fullName: schema.userRole.fullName, subscriptionTier: schema.userRole.subscriptionTier, subscriptionStatus: schema.userRole.subscriptionStatus })
            .from(schema.userRole).where(eq(schema.userRole.userId, seq.userId)).limit(1);
          if (!user) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          // If the user resubscribed (back to active PRO/ELITE), kill the win-back.
          const tier = (user.subscriptionTier || 'FREE').toUpperCase();
          const status = (user.subscriptionStatus || '').toLowerCase();
          if ((tier === 'PRO' || tier === 'ELITE') && (status === 'active' || status === '')) {
            await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id));
            console.log(`[DRIP] win_back cancelled — ${seq.userId} reactivated`);
            continue;
          }
          const userName = user.fullName || seq.userId.split('@')[0];
          const unsubUrl = await getUnsubscribeUrl(seq.userId);
          const emailData = buildWinBackEmail(seq.currentStep, userName, unsubUrl);
          if (!emailData) { await db.update(schema.emailSequences).set({ completed: true }).where(eq(schema.emailSequences.id, seq.id)); continue; }
          const headers: Record<string, string> = {};
          if (unsubUrl) headers['List-Unsubscribe'] = `<${unsubUrl}>`;
          const sent = await sendEmail(seq.userId, emailData.subject, emailData.html, true, Object.keys(headers).length ? headers : undefined);
          console.log(`[DRIP] win_back step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);
          const nextStep = seq.currentStep + 1;
          const isLastStep = nextStep >= WIN_BACK_TOTAL_STEPS;
          const nextDays = WIN_BACK_INTERVALS_DAYS[nextStep] ?? 30;
          await db.update(schema.emailSequences)
            .set({ currentStep: nextStep, nextSendAt: new Date(Date.now() + nextDays * 24 * 60 * 60 * 1000), completed: isLastStep })
            .where(eq(schema.emailSequences.id, seq.id));
        }
      } catch (seqErr) {
        console.error(`[DRIP] Error processing sequence ${seq.id}:`, seqErr);
      }
    }
  } catch (err) {
    console.error('[DRIP] processDripSequences error:', err);
  }
}

// ==================== RISK ALERT EMAILS ====================

interface RiskAlertEmailData {
  type: string;
  severity: "low" | "medium" | "high";
  title: string;
  body: string;
  linkUrl?: string;
  payload?: Record<string, any>;
}

const ALERT_THEME: Record<string, { color: string; emoji: string; label: string }> = {
  daily_dd_critical:    { color: "#EF4444", emoji: "🛑", label: "Daily Drawdown — Critical" },
  daily_dd_warn:        { color: "#F59E0B", emoji: "⚠️", label: "Daily Drawdown — Warning" },
  max_dd_critical:      { color: "#EF4444", emoji: "🛑", label: "Max Drawdown — Critical" },
  max_dd_warn:          { color: "#F59E0B", emoji: "⚠️", label: "Max Drawdown — Warning" },
  revenge_trade:        { color: "#EF4444", emoji: "🚨", label: "Revenge Trading Detected" },
  overtrading:          { color: "#F59E0B", emoji: "📊", label: "Overtrading Alert" },
  strategy_deviation:   { color: "#3B82F6", emoji: "🧭", label: "Strategy Deviation" },
};

export async function sendRiskAlertEmail(
  userIdOrEmail: string,
  alert: RiskAlertEmailData
): Promise<boolean> {
  try {
    if (!SMTP_USER || !SMTP_APP_PASSWORD) return false;
    // Critical risk alerts (drawdown breach imminent, revenge trading) are
    // account-protecting transactional notices — they intentionally bypass
    // the marketing unsubscribe so the user is never silently denied a
    // notification that could prevent a blown challenge.
    const isCriticalSafety = alert.severity === "high";
    if (!isCriticalSafety && await isUserUnsubscribed(userIdOrEmail)) {
      console.log(`[RiskAlert] User ${userIdOrEmail} is unsubscribed — skipping non-critical email (${alert.type})`);
      return false;
    }

    const theme = ALERT_THEME[alert.type] || { color: "#00D9A3", emoji: "🔔", label: "Tradify Alert" };
    const ctaUrl = alert.linkUrl ? `${APP_URL}${alert.linkUrl}` : `${APP_URL}/dashboard`;
    const unsubUrl = await getUnsubscribeUrl(userIdOrEmail);

    const content = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding-bottom: 8px;">
          <span style="display: inline-block; background-color: ${theme.color}1A; color: ${theme.color}; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 12px; border-radius: 4px; border: 1px solid ${theme.color}40;">
            ${theme.emoji} ${theme.label}
          </span>
        </td></tr>
        <tr><td style="padding-bottom: 16px;">
          <h1 style="margin: 12px 0 0 0; font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.3; font-family: Arial, sans-serif;">
            ${alert.title}
          </h1>
        </td></tr>
        <tr><td style="padding-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; color: #D1D5DB; line-height: 1.6; font-family: Arial, sans-serif;">
            ${alert.body}
          </p>
        </td></tr>
        <tr><td style="padding-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color: #00D9A3; border-radius: 6px;">
                <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; font-size: 13px; font-weight: 800; color: #0A0F1E; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; font-family: Arial, sans-serif;">
                  Open Tradify →
                </a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="border-top: 1px solid #1F2937; padding-top: 20px;">
          <p style="margin: 0; font-size: 12px; color: #6B7280; line-height: 1.6; font-family: Arial, sans-serif;">
            You're receiving this because you've enabled risk alerts for your TradifyApp account. You can adjust which alerts you receive — or turn email alerts off entirely — from your <a href="${APP_URL}/profile" style="color: #00D9A3; text-decoration: none;">Alert Settings</a>.
          </p>
        </td></tr>
      </table>`;

    const subject = `${theme.emoji} ${alert.title}`;
    const html = wrapEmailBody(content, alert.title, alert.body.slice(0, 120), unsubUrl);

    return await sendEmail(userIdOrEmail, subject, html, true, {
      "List-Unsubscribe": unsubUrl ? `<${unsubUrl}>` : "",
      "X-Tradify-Alert-Type": alert.type,
    });
  } catch (err) {
    console.error("[RiskAlert] sendRiskAlertEmail error:", err);
    return false;
  }
}

export interface DailyDigestEmailData {
  date: string;
  total: number;
  groups: Array<{ type: string; severity: string; count: number }>;
}

const SEVERITY_LABEL: Record<string, string> = {
  high: "Critical",
  medium: "Warning",
  low: "Info",
};
const SEVERITY_COLOR: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#3B82F6",
};

export async function sendDailyAlertDigestEmail(
  userIdOrEmail: string,
  data: DailyDigestEmailData,
): Promise<boolean> {
  try {
    if (!SMTP_USER || !SMTP_APP_PASSWORD) return false;
    if (await isUserUnsubscribed(userIdOrEmail)) {
      console.log(`[DailyDigest] User ${userIdOrEmail} unsubscribed — skipping digest`);
      return false;
    }

    const ctaUrl = `${APP_URL}/dashboard`;
    const unsubUrl = await getUnsubscribeUrl(userIdOrEmail);

    const rows = data.groups.map(g => {
      const theme = ALERT_THEME[g.type] || { color: "#00D9A3", emoji: "🔔", label: g.type };
      const sevColor = SEVERITY_COLOR[g.severity] || "#9CA3AF";
      const sevLabel = SEVERITY_LABEL[g.severity] || g.severity;
      return `
        <tr>
          <td style="padding: 12px 4px; border-bottom: 1px solid #1F2937;">
            <table width="100%" role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 14px; color: #ffffff; font-family: Arial, sans-serif;">
                  <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${theme.color}; margin-right:10px; vertical-align:middle;"></span>
                  <span style="vertical-align:middle;">${theme.emoji} ${theme.label}</span>
                </td>
                <td align="right" style="font-family: Arial, sans-serif; font-size: 12px; white-space: nowrap;">
                  <span style="color: ${sevColor}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-right: 12px;">${sevLabel}</span>
                  <span style="color:#ffffff; font-weight: 700;">×${g.count}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }).join("");

    const content = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding-bottom: 8px;">
          <span style="display: inline-block; background-color: #00D9A31A; color: #00D9A3; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 12px; border-radius: 4px; border: 1px solid #00D9A340;">
            📬 Daily Risk Digest
          </span>
        </td></tr>
        <tr><td style="padding-bottom: 16px;">
          <h1 style="margin: 12px 0 0 0; font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.3; font-family: Arial, sans-serif;">
            Risk recap — last 24 hours
          </h1>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #6B7280; font-family: Arial, sans-serif;">
            ${data.date} · ${data.total} alert${data.total === 1 ? "" : "s"}
          </p>
        </td></tr>
        <tr><td style="padding-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; color: #D1D5DB; line-height: 1.6; font-family: Arial, sans-serif;">
            Here's a calm summary of every risk event your account triggered in the last 24 hours, grouped by type and severity. Use it as a once-a-day discipline check — no need to chase every notification individually.
          </p>
        </td></tr>
        <tr><td style="padding-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0F172A; border:1px solid #1F2937; border-radius: 8px;">
            ${rows}
          </table>
        </td></tr>
        <tr><td style="padding-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color: #00D9A3; border-radius: 6px;">
                <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; font-size: 13px; font-weight: 800; color: #0A0F1E; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; font-family: Arial, sans-serif;">
                  Open Tradify →
                </a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="border-top: 1px solid #1F2937; padding-top: 20px;">
          <p style="margin: 0; font-size: 12px; color: #6B7280; line-height: 1.6; font-family: Arial, sans-serif;">
            You're receiving this digest because it's enabled in your <a href="${APP_URL}/profile" style="color: #00D9A3; text-decoration: none;">Alert Settings</a>. You can switch off just the digest there without affecting real-time alerts.
          </p>
        </td></tr>
      </table>`;

    const subject = `📬 Risk recap (24h) — ${data.total} alert${data.total === 1 ? "" : "s"}`;
    const html = wrapEmailBody(
      content,
      "Daily risk digest",
      `Summary of ${data.total} risk alert${data.total === 1 ? "" : "s"} from the last 24 hours`,
      unsubUrl,
    );

    return await sendEmail(userIdOrEmail, subject, html, true, {
      "List-Unsubscribe": unsubUrl ? `<${unsubUrl}>` : "",
      "X-Tradify-Alert-Type": "daily_digest",
    });
  } catch (err) {
    console.error("[DailyDigest] send error:", err);
    return false;
  }
}

async function sendCustomEmail(to: string, subject: string, html: string): Promise<boolean> {
  return sendEmail(to, subject, html);
}

async function sendCoachInviteEmail(studentEmail: string, coachName: string): Promise<boolean> {
  const safeCoach = String(coachName || "Your coach").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">You've been invited as a student &#127891;</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;"><strong style="color:#A78BFA;">${safeCoach}</strong> has invited you to be their coaching student on ${APP_NAME}.</p>
        <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">If you accept, your coach will be able to <strong>read your trade journal</strong> and leave <strong>per-trade written feedback</strong>. They cannot see your password, payment info, or your account settings. You can revoke access at any time.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #8B5CF6; border-radius: 8px;"><a href="${APP_URL}/dashboard" style="display: inline-block; color: #ffffff; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Review the invite</a></td></tr>
        </table>
        <p style="color: #9CA3AF; font-size: 12px; line-height: 1.6; margin: 16px 0 0 0;">You'll see Accept / Decline buttons on your dashboard.</p>`;
  const html = wrapEmailBody(content, `Coach invite from ${safeCoach}`, `${safeCoach} invited you to be their coaching student`);
  return sendEmail(studentEmail, `${safeCoach} invited you as a student on ${APP_NAME}`, html);
}

async function sendCoachFeedbackEmail(studentEmail: string, coachName: string, snippet: string, tradeId: number | null): Promise<boolean> {
  const escape = (s: string) => String(s || "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
  const safeCoach = escape(coachName || "Your coach");
  const safeSnippet = escape(snippet.slice(0, 280));
  const tradeLine = tradeId ? `<p style="color:#9CA3AF;font-size:12px;margin:0 0 12px 0;">On trade #${tradeId}</p>` : "";
  const content = `
        <h1 style="color: #ffffff; font-size: 24px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">New feedback from your coach</h1>
        <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;"><strong style="color:#A78BFA;">${safeCoach}</strong> just left you new feedback.</p>
        ${tradeLine}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 16px 0 24px 0;">
          <tr><td style="background-color:#131A2B;padding:16px;border-radius:8px;border-left:3px solid #8B5CF6;">
            <p style="color:#E5E7EB;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${safeSnippet}${snippet.length > 280 ? "…" : ""}</p>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0;">
          <tr><td style="background-color:#8B5CF6;border-radius:8px;"><a href="${APP_URL}/dashboard" style="display:inline-block;color:#ffffff;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:14px;">View on dashboard</a></td></tr>
        </table>`;
  const html = wrapEmailBody(content, `New coach feedback`, `New feedback from ${safeCoach}`);
  return sendEmail(studentEmail, `New feedback from ${safeCoach}`, html);
}

export async function sendWeeklyPerformanceDigestEmail(
  email: string,
  s: {
    total: number; wins: number; losses: number; winRate: number;
    netPl: number; bestTrade: { pair: string; pl: number } | null;
    worstTrade: { pair: string; pl: number } | null;
    ruleComplianceRate: number; insight: string; weekLabel: string;
  },
): Promise<boolean> {
  const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
  const plColor = s.netPl >= 0 ? "#10B981" : "#F43F5E";
  const plSign = s.netPl >= 0 ? "+" : "";
  const stat = (label: string, value: string, color = "#E5E7EB") => `
    <td style="padding:14px 12px;background:#0F172A;border-radius:10px;text-align:center;">
      <div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;font-weight:bold;">${label}</div>
      <div style="font-size:22px;color:${color};font-weight:900;margin-top:6px;">${value}</div>
    </td>`;
  const bestRow = s.bestTrade
    ? `<tr><td style="padding:6px 0;color:#94A3B8;font-size:13px;">Best trade</td><td style="padding:6px 0;text-align:right;font-weight:bold;color:#10B981;">${escape(s.bestTrade.pair)} ${plSign}${s.bestTrade.pl >= 0 ? "+" : ""}${s.bestTrade.pl.toFixed(2)}</td></tr>`
    : "";
  const worstRow = s.worstTrade
    ? `<tr><td style="padding:6px 0;color:#94A3B8;font-size:13px;">Worst trade</td><td style="padding:6px 0;text-align:right;font-weight:bold;color:#F43F5E;">${escape(s.worstTrade.pair)} ${s.worstTrade.pl >= 0 ? "+" : ""}${s.worstTrade.pl.toFixed(2)}</td></tr>`
    : "";

  const content = `
    <h1 style="margin:0 0 6px 0;color:#FFFFFF;font-size:24px;font-weight:900;">Your week in trading</h1>
    <p style="margin:0 0 24px 0;color:#94A3B8;font-size:13px;">${escape(s.weekLabel)}</p>
    <table role="presentation" cellpadding="0" cellspacing="8" border="0" width="100%" style="margin-bottom:20px;">
      <tr>
        ${stat("Trades", String(s.total))}
        ${stat("Win rate", `${s.winRate.toFixed(0)}%`)}
      </tr>
      <tr>
        ${stat("Net P/L", `${plSign}${s.netPl.toFixed(2)}`, plColor)}
        ${stat("Rule compliance", `${s.ruleComplianceRate.toFixed(0)}%`)}
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0F172A;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
      ${bestRow}
      ${worstRow}
      <tr><td style="padding:6px 0;color:#94A3B8;font-size:13px;">Wins / Losses</td><td style="padding:6px 0;text-align:right;color:#E5E7EB;font-weight:bold;">${s.wins} / ${s.losses}</td></tr>
    </table>
    <div style="background:linear-gradient(135deg,#1E293B,#0F172A);border-left:4px solid #00D9A3;padding:16px 18px;border-radius:8px;margin-bottom:24px;">
      <div style="font-size:11px;color:#00D9A3;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Insight of the week</div>
      <div style="color:#E5E7EB;font-size:14px;line-height:1.5;">${escape(s.insight)}</div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
      <tr><td style="background-color:#00D9A3;border-radius:8px;"><a href="${APP_URL}/journal" style="display:inline-block;color:#0A0F1E;padding:13px 30px;text-decoration:none;font-weight:bold;font-size:14px;">Open my journal</a></td></tr>
    </table>`;
  const html = wrapEmailBody(content, "Your weekly trading digest", `Week ${s.weekLabel}: ${s.total} trades, ${s.winRate.toFixed(0)}% win rate`);
  return sendEmail(email, `Your week in trading — ${s.weekLabel}`, html);
}

export const emailService = {
  sendTransactionalEmail,
  sendCustomEmail,
  sendCoachInviteEmail,
  sendCoachFeedbackEmail,
  sendWeeklyPerformanceDigestEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendAdminCreatedUserEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCanceledEmail,
  sendContactFormNotification,
  sendContactFormAutoReply,
  sendEmailVerificationEmail,
  sendAdminSignupNotification,
  sendBackupFailureAlertEmail,
  sendBackupVerificationFailureAlertEmail,
  sendRiskAlertEmail,
  getEmailLogs,
  isEmailConfigured,
  queueLeadSequence,
  queueFreeUserSequence,
  queueFreeOngoingSequence,
  queueProToEliteSequence,
  queueEliteRetentionSequence,
  queueInsightsNewsletterSequence,
  queueFirstTradeSequence,
  queueFirstPayoutSequence,
  queueAtRiskSequence,
  queueWinBackSequence,
  scanForAtRiskUsers,
  cancelActiveTrack,
  processDripSequences,
  backfillEmailSequences,
};

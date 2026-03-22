import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { db } from "./db";
import * as schema from "@shared/schema";
import { and, count, eq, lte, ne } from "drizzle-orm";
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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  retryOnce = true
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

function getEmailFooter(): string {
  return `
          <tr>
            <td style="background-color: #131A2B; padding: 28px 40px; border-top: 1px solid #1F2937;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">&copy; ${new Date().getFullYear()} TradifyApp. All rights reserved. | Trading Discipline Platform</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color: #00D9A3; text-decoration: none;">${SUPPORT_EMAIL}</a></p>
              <p style="margin: 0; font-size: 11px; color: #4B5563;">You received this because you have a TradifyApp account. Reply STOP to unsubscribe from marketing emails.</p>
            </td>
          </tr>`;
}

function wrapEmailBody(content: string, title: string, preheader: string): string {
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
          ${getEmailFooter()}
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

function dripFooterNote(isLead: boolean): string {
  const reason = isLead
    ? 'You received this because you downloaded a TradifyApp resource.'
    : 'You received this because you signed up for a free TradifyApp account.';
  return `<p style="margin: 24px 0 0 0; font-size: 12px; color: #6B7280; border-top: 1px solid #1F2937; padding-top: 16px;">${reason} Reply STOP to unsubscribe.</p>`;
}

// ==================== AI EMAIL GENERATION ====================

const PRODUCT_REFERENCE = `
TradifyApp — Trading Discipline Platform. Tagline: "Your Rules. Enforced."
NOT a journal. NOT a trade log. An enforcement layer.

FREE plan: MT5 auto-sync via connector EA (read-only, installs in 3 min), trade history (30-day), basic analytics, psychology tracking, CSV import, risk calculators, 3 education lessons, basic rule validation.

PRO plan ($29/month): Everything in Free + unlimited trade history, advanced analytics (win rate by session/day/instrument/setup), unlimited rule engine, multi-account MT5 tracking, full 19-lesson education hub, monthly AI self-review report, Prop Firm Challenge Tracker (FTMO / MyFundedFX / The Funded Trader / custom), AI instrument analysis, priority support.

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

function buildLeadEmail(step: number, email: string): { subject: string; html: string } | null {
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
        ${dripFooterNote(true)}`,
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
        ${dripFooterNote(true)}`,
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
        ${dripFooterNote(true)}`,
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
        ${dripFooterNote(true)}`,
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
        ${dripFooterNote(true)}`,
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
        ${dripFooterNote(true)}`,
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
        ${dripFooterNote(true)}`,
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
  userName: string
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
            ${dripFooterNote(false)}`,
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
            ${dripFooterNote(false)}`,
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
        ${dripFooterNote(false)}`,
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
        ${dripFooterNote(false)}`,
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
        ${dripFooterNote(false)}`,
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
        ${dripFooterNote(false)}`,
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

async function backfillEmailSequences(): Promise<void> {
  try {
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
        if (seq.track === 'lead_7day') {
          if (!seq.email) {
            await db.update(schema.emailSequences)
              .set({ completed: true })
              .where(eq(schema.emailSequences.id, seq.id));
            continue;
          }

          const emailData = buildLeadEmail(seq.currentStep, seq.email);
          if (!emailData) {
            await db.update(schema.emailSequences)
              .set({ completed: true })
              .where(eq(schema.emailSequences.id, seq.id));
            continue;
          }

          const sent = await sendEmail(seq.email, emailData.subject, emailData.html);
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
          const emailData = await buildFreeUserEmail(seq.currentStep, seq.userId, userName);

          if (!emailData) {
            await db.update(schema.emailSequences)
              .set({ completed: true })
              .where(eq(schema.emailSequences.id, seq.id));
            continue;
          }

          const sent = await sendEmail(seq.userId, emailData.subject, emailData.html);
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
            const html = wrapEmailBody(aiResult.body, aiResult.subject, aiResult.subject);
            const sent = await sendEmail(seq.userId, aiResult.subject, html);
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
            'Prop Firm Challenge Tracker with FTMO and MyFundedFX',
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
            const html = wrapEmailBody(aiResult.body, aiResult.subject, aiResult.subject);
            const sent = await sendEmail(seq.userId, aiResult.subject, html);
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
            const html = wrapEmailBody(aiResult.body, aiResult.subject, aiResult.subject);
            const sent = await sendEmail(seq.userId, aiResult.subject, html);
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
            const html = wrapEmailBody(aiResult.body, aiResult.subject, aiResult.subject);
            const sent = await sendEmail(seq.userId, aiResult.subject, html);
            console.log(`[DRIP] insights_newsletter step ${seq.currentStep} → ${seq.userId}: ${sent ? 'sent' : 'failed'}`);
          }
          const nextStep = seq.currentStep + 1;
          const willCycle = nextStep >= INSIGHTS_TOTAL_STEPS;
          const nextSendAt = new Date(Date.now() + INSIGHTS_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
          await db.update(schema.emailSequences)
            .set({ currentStep: willCycle ? 0 : nextStep, nextSendAt, completed: false })
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

export const emailService = {
  sendTransactionalEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendAdminCreatedUserEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCanceledEmail,
  sendContactFormNotification,
  sendContactFormAutoReply,
  sendEmailVerificationEmail,
  sendAdminSignupNotification,
  getEmailLogs,
  isEmailConfigured,
  queueLeadSequence,
  queueFreeUserSequence,
  queueFreeOngoingSequence,
  queueProToEliteSequence,
  queueEliteRetentionSequence,
  queueInsightsNewsletterSequence,
  cancelActiveTrack,
  processDripSequences,
  backfillEmailSequences,
};

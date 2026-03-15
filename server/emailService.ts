import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { db } from "./db";
import * as schema from "@shared/schema";
import { and, eq, lte } from "drizzle-orm";

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
            <td style="background-color: #131A2B; padding: 32px 40px; border-bottom: 2px solid #00D9A3;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right: 12px; vertical-align: middle;">
                    <img src="${APP_URL}/logo-email.png" alt="TradifyApp" width="40" height="40" style="display: block; border-radius: 10px;" />
                  </td>
                  <td>
                    <div style="font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px; line-height: 1;">TRADIFYAPP</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function getEmailFooter(): string {
  return `
          <tr>
            <td style="background-color: #131A2B; padding: 32px 40px; border-top: 1px solid #1F2937;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #9CA3AF; line-height: 1.6;">This email was sent by Tradifyapp.com</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">&copy; ${new Date().getFullYear()} TradifyApp. All rights reserved.</p>
              <p style="margin: 0; font-size: 12px; color: #6B7280;">Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #00D9A3; text-decoration: none;">${SUPPORT_EMAIL}</a></p>
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

async function sendContactFormNotification(fromEmail: string, fromName: string, subject: string, message: string): Promise<boolean> {
  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: Arial, sans-serif; background-color: #0a0a0a; color: #e5e5e5; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background-color: #171717; border-radius: 8px; padding: 24px; border: 1px solid #262626; }
      h1 { color: #00D9A3; margin-top: 0; }
      .info-row { padding: 12px 0; border-bottom: 1px solid #262626; }
      .label { color: #a3a3a3; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
      .value { color: #ffffff; font-size: 16px; margin-top: 4px; }
    </style></head><body>
      <div class="container">
        <h1>Contact Form Submission</h1>
        <div class="info-row"><div class="label">From</div><div class="value">${fromName} (${fromEmail})</div></div>
        <div class="info-row"><div class="label">Subject</div><div class="value">${subject}</div></div>
        <div class="info-row"><div class="label">Message</div><div class="value">${message}</div></div>
      </div>
    </body></html>`;
  return sendEmail(SUPPORT_EMAIL, `[Contact Form] ${subject}`, html);
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
    ? '<span style="background-color: #f59e0b; color: #000; padding: 2px 8px; border-radius: 4px; font-weight: bold;">FOUNDING MEMBER</span>' 
    : '';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #e5e5e5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #171717; border-radius: 8px; padding: 24px; border: 1px solid #262626; }
        h1 { color: #22c55e; margin-top: 0; }
        .info-row { padding: 12px 0; border-bottom: 1px solid #262626; }
        .label { color: #a3a3a3; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .value { color: #ffffff; font-size: 16px; margin-top: 4px; }
        .footer { margin-top: 24px; font-size: 12px; color: #737373; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>New User Signup ${foundingBadge}</h1>
        <p style="color: #a3a3a3;">A new user has registered on ${APP_NAME}.</p>
        
        <div class="info-row">
          <div class="label">Full Name</div>
          <div class="value">${fullName}</div>
        </div>
        
        <div class="info-row">
          <div class="label">Email</div>
          <div class="value">${userEmail}</div>
        </div>
        
        <div class="info-row">
          <div class="label">Country</div>
          <div class="value">${country}</div>
        </div>
        
        <div class="info-row">
          <div class="label">Signup Time</div>
          <div class="value">${formattedDate}</div>
        </div>
        
        <div class="info-row">
          <div class="label">Status</div>
          <div class="value">${isFoundingMember ? 'Founding Member (Early Access)' : 'Standard Registration'}</div>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from ${APP_NAME}.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const subject = isFoundingMember 
    ? `[Founding Member] New Signup: ${fullName}` 
    : `New User Signup: ${fullName}`;

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
            .set({
              currentStep: nextStep,
              nextSendAt,
              completed: isLastStep,
            })
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
  processDripSequences,
};

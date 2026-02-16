import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { db } from "./db";
import * as schema from "@shared/schema";

// Use process.cwd() for path resolution (works in both ESM and CJS)
const EMAIL_TEMPLATES_DIR = path.join(process.cwd(), 'server', 'emails');

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD || '';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@tradifyapp.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tradifyapp.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@tradifyapp.com';
const APP_NAME = 'Tradify';
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
                    <img src="${APP_URL}/logo-email.png" alt="Tradify" width="40" height="40" style="display: block; border-radius: 10px;" />
                  </td>
                  <td>
                    <div style="font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px; line-height: 1;">TRADIFY</div>
                    <div style="font-size: 10px; color: #9CA3AF; letter-spacing: 2px; line-height: 1;">TERMINAL</div>
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
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">&copy; ${new Date().getFullYear()} Tradify Terminal. All rights reserved.</p>
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
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Thanks for signing up for Tradify Terminal! We're excited to have you on board.</p>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">To complete your registration and start tracking your trades, please verify your email address by clicking the button below:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #00D9A3; border-radius: 8px;"><a href="${verificationUrl}" style="display: inline-block; color: #0A0F1E; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Verify Email Address</a></td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
          <tr><td style="background-color: #131A2B; padding: 20px; border-radius: 8px; border-left: 4px solid #00D9A3;">
            <p style="color: #9CA3AF; font-size: 14px; margin: 0 0 8px 0;"><strong style="color: #ffffff;">&#9200; This link expires in 24 hours</strong></p>
            <p style="color: #9CA3AF; font-size: 14px; margin: 0;">If you didn't create an account with Tradify, you can safely ignore this email.</p>
          </td></tr>
        </table>
        <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin-top: 32px; margin-bottom: 0;">If the button doesn't work, copy and paste this link into your browser:<br /><a href="${verificationUrl}" style="color: #00D9A3; word-break: break-all;">${verificationUrl}</a></p>`;

  const html = wrapEmailBody(content, 'Verify Your Email Address', 'Verify your email address to get started with Tradify');
  return sendEmail(email, `Verify your email - ${APP_NAME}`, html);
}

async function sendWelcomeEmail(email: string, userName: string): Promise<boolean> {
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Welcome to Tradify! &#127881;</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Your account is now active and ready to use. You're about to discover a better way to track, analyze, and improve your trading.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td style="background-color: #131A2B; padding: 24px; border-radius: 8px;">
            <h2 style="color: #00D9A3; font-size: 18px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">&#128640; Get Started in 3 Easy Steps:</h2>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding-bottom: 16px;"><p style="color: #ffffff; font-size: 16px; font-weight: bold; margin: 0 0 8px 0;">1. Connect Your MT5 Account</p><p style="color: #9CA3AF; font-size: 14px; margin: 0;">Auto-sync your trades from MetaTrader 5</p></td></tr>
              <tr><td style="padding-bottom: 16px;"><p style="color: #ffffff; font-size: 16px; font-weight: bold; margin: 0 0 8px 0;">2. Set Up Your Trading Rules</p><p style="color: #9CA3AF; font-size: 14px; margin: 0;">Define your strategy and track rule compliance</p></td></tr>
              <tr><td><p style="color: #ffffff; font-size: 16px; font-weight: bold; margin: 0 0 8px 0;">3. Start Journaling</p><p style="color: #9CA3AF; font-size: 14px; margin: 0;">Log your trades and track your progress</p></td></tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #00D9A3; border-radius: 8px;"><a href="${APP_URL}/dashboard" style="display: inline-block; color: #0A0F1E; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Go to Dashboard</a></td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 32px;">
          <tr><td style="background-color: #1F2937; padding: 20px; border-radius: 8px;">
            <p style="color: #D1D5DB; font-size: 14px; margin: 0 0 12px 0;"><strong style="color: #ffffff;">&#128161; Pro Tip:</strong></p>
            <p style="color: #9CA3AF; font-size: 14px; margin: 0; line-height: 1.6;">The most successful traders journal every single trade. Make it a habit from day one and watch your consistency improve.</p>
          </td></tr>
        </table>`;

  const html = wrapEmailBody(content, 'Welcome to Tradify Terminal', 'Welcome to Tradify Terminal - Your trading journey starts now');
  return sendEmail(email, `Welcome to ${APP_NAME}!`, html);
}

async function sendPasswordResetEmail(email: string, userName: string, resetUrl: string): Promise<boolean> {
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Reset Your Password</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">We received a request to reset the password for your Tradify account.</p>
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

  const html = wrapEmailBody(content, 'Reset Your Password', 'Reset your Tradify password');
  return sendEmail(email, `Reset Your ${APP_NAME} Password`, html);
}

async function sendAdminCreatedUserEmail(email: string, userName: string, tempPassword: string): Promise<boolean> {
  const content = `
        <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 16px;">Your Account Has Been Created</h1>
        <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">An administrator has created a Tradify Terminal account for you. Here are your login credentials:</p>
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

  const html = wrapEmailBody(content, 'Your Tradify Account Has Been Created', 'Your Tradify account has been created');
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
                  <li>Trade correlation analysis</li>
                  <li>Priority support</li>
                </ul>
              </td></tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
          <tr><td style="background-color: #00D9A3; border-radius: 8px;"><a href="${APP_URL}/dashboard" style="display: inline-block; color: #0A0F1E; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 16px;">Explore ${planName} Features</a></td></tr>
        </table>`;

  const html = wrapEmailBody(content, `Welcome to Tradify ${planName}`, `Your ${planName} subscription is now active`);
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
};

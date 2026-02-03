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

async function sendWelcomeEmail(email: string, userName: string): Promise<boolean> {
  const template = loadTemplate('welcome');
  if (!template) {
    console.warn('[EMAIL] Welcome template not found, using fallback');
    const fallback = `<h1>Welcome to ${APP_NAME}!</h1><p>Hi ${userName}, your account is ready.</p>`;
    return sendEmail(email, `Welcome to ${APP_NAME}!`, fallback);
  }
  const html = replaceTemplatePlaceholders(template, { user_name: userName });
  return sendEmail(email, `Welcome to ${APP_NAME}!`, html);
}

async function sendPasswordResetEmail(email: string, userName: string, resetUrl: string): Promise<boolean> {
  const template = loadTemplate('reset-password');
  if (!template) {
    const fallback = `<h1>Password Reset</h1><p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`;
    return sendEmail(email, `Reset Your ${APP_NAME} Password`, fallback);
  }
  const html = replaceTemplatePlaceholders(template, { user_name: userName, action_url: resetUrl });
  return sendEmail(email, `Reset Your ${APP_NAME} Password`, html);
}

async function sendAdminCreatedUserEmail(email: string, userName: string, tempPassword: string): Promise<boolean> {
  const template = loadTemplate('admin-created-user');
  if (!template) {
    const fallback = `<h1>Your Account is Ready</h1><p>Login with temporary password: <strong>${tempPassword}</strong></p><p>You'll be prompted to change it on first login.</p>`;
    return sendEmail(email, `Your ${APP_NAME} Account Has Been Created`, fallback);
  }
  const html = replaceTemplatePlaceholders(template, {
    user_name: userName,
    temp_password: tempPassword,
    action_url: `${APP_URL}/login`,
  });
  return sendEmail(email, `Your ${APP_NAME} Account Has Been Created`, html);
}

async function sendSubscriptionActivatedEmail(email: string, userName: string, planName: string): Promise<boolean> {
  const template = loadTemplate('subscription-activated');
  if (!template) {
    const fallback = `<h1>Welcome to ${planName}!</h1><p>Your subscription is now active.</p>`;
    return sendEmail(email, `Welcome to ${APP_NAME} ${planName}!`, fallback);
  }
  const html = replaceTemplatePlaceholders(template, { user_name: userName, plan_name: planName });
  return sendEmail(email, `Welcome to ${APP_NAME} ${planName}!`, html);
}

async function sendSubscriptionCanceledEmail(email: string, userName: string, planName: string): Promise<boolean> {
  const template = loadTemplate('subscription-canceled');
  if (!template) {
    const fallback = `<h1>Subscription Canceled</h1><p>Your ${planName} subscription has been canceled.</p>`;
    return sendEmail(email, `Your ${APP_NAME} ${planName} Subscription Has Been Canceled`, fallback);
  }
  const html = replaceTemplatePlaceholders(template, { user_name: userName, plan_name: planName });
  return sendEmail(email, `Your ${APP_NAME} ${planName} Subscription Has Been Canceled`, html);
}

async function sendContactFormNotification(fromEmail: string, fromName: string, subject: string, message: string): Promise<boolean> {
  const template = loadTemplate('contact-form-admin');
  if (!template) {
    const fallback = `<h1>Contact Form Submission</h1><p>From: ${fromName} (${fromEmail})</p><p>Subject: ${subject}</p><p>Message: ${message}</p>`;
    return sendEmail(SUPPORT_EMAIL, `[Contact Form] ${subject}`, fallback);
  }
  const html = replaceTemplatePlaceholders(template, {
    from_name: fromName,
    from_email: fromEmail,
    subject: subject,
    message: message,
  });
  return sendEmail(SUPPORT_EMAIL, `[Contact Form] ${subject}`, html);
}

async function sendContactFormAutoReply(email: string, name: string): Promise<boolean> {
  const template = loadTemplate('contact-form-reply');
  if (!template) {
    const fallback = `<h1>We Got Your Message!</h1><p>Hi ${name}, thank you for reaching out. We'll get back to you within 24-48 hours.</p>`;
    return sendEmail(email, `We received your message - ${APP_NAME}`, fallback);
  }
  const html = replaceTemplatePlaceholders(template, { user_name: name });
  return sendEmail(email, `We received your message - ${APP_NAME}`, html);
}

// Send email verification email
async function sendEmailVerificationEmail(email: string, fullName: string, verificationToken: string): Promise<boolean> {
  const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${verificationToken}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0f1a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden;">
          <tr>
            <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              <h1 style="color: #0a0f1a; margin: 0; font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: -1px;">
                Welcome to ${APP_NAME}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="color: #f3f4f6; font-size: 16px; margin: 0 0 20px 0;">
                Hi ${fullName},
              </p>
              <p style="color: #9ca3af; font-size: 14px; margin: 0 0 30px 0; line-height: 1.6;">
                Thank you for creating your ${APP_NAME} account. To complete your registration and access your trading terminal, please verify your email address by clicking the button below.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #0a0f1a; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                  Verify Email Address
                </a>
              </div>
              <p style="color: #6b7280; font-size: 12px; margin: 30px 0 0 0; line-height: 1.6;">
                This verification link will expire in 24 hours. If you didn't create an account with ${APP_NAME}, you can safely ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #1f2937; margin: 30px 0;">
              <p style="color: #6b7280; font-size: 11px; margin: 0; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <span style="color: #10b981; word-break: break-all;">${verificationUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #0d1117; text-align: center;">
              <p style="color: #6b7280; font-size: 11px; margin: 0;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  
  return sendEmail(email, `Verify your email - ${APP_NAME}`, html);
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
  const adminEmail = 'admin@tradifyapp.com';
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

  return sendEmail(adminEmail, subject, html);
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

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { db } from "./db";
import * as schema from "@shared/schema";

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
  const templatePath = path.join(__dirname, 'emails', `${templateName}.html`);
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
        userId: to,
        emailType: 'transactional',
        subject,
        content: html.substring(0, 500),
        status: 'sent'
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

// Legacy function for backward compatibility with existing code
async function sendTransactionalEmail(userId: string, type: "signup" | "payment_success" | "password_reset", data: any): Promise<boolean> {
  const userName = userId.split('@')[0]; // Extract name from email
  
  switch (type) {
    case "signup":
      return sendWelcomeEmail(userId, userName);
    case "payment_success":
      return sendSubscriptionActivatedEmail(userId, userName, data.planName || 'Pro');
    case "password_reset":
      return sendPasswordResetEmail(userId, userName, data.resetUrl || '');
    default:
      console.warn(`[EMAIL] Unknown transactional email type: ${type}`);
      return false;
  }
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
  getEmailLogs,
  isEmailConfigured,
};

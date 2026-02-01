import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

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
  const templatePath = path.join(__dirname, '..', 'emails', `${templateName}.html`);
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

export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<boolean> {
  const template = loadTemplate('welcome');
  const html = replaceTemplatePlaceholders(template, {
    user_name: userName,
  });
  return sendEmail(email, `Welcome to ${APP_NAME}!`, html);
}

export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetUrl: string
): Promise<boolean> {
  const template = loadTemplate('reset-password');
  const html = replaceTemplatePlaceholders(template, {
    user_name: userName,
    action_url: resetUrl,
  });
  return sendEmail(email, `Reset Your ${APP_NAME} Password`, html);
}

export async function sendAdminCreatedUserEmail(
  email: string,
  userName: string,
  tempPassword: string
): Promise<boolean> {
  const template = loadTemplate('admin-created-user');
  const html = replaceTemplatePlaceholders(template, {
    user_name: userName,
    temp_password: tempPassword,
    action_url: `${APP_URL}/login`,
  });
  return sendEmail(email, `Your ${APP_NAME} Account Has Been Created`, html);
}

export async function sendSubscriptionActivatedEmail(
  email: string,
  userName: string,
  planName: string
): Promise<boolean> {
  const template = loadTemplate('subscription-activated');
  const html = replaceTemplatePlaceholders(template, {
    user_name: userName,
    plan_name: planName,
  });
  return sendEmail(email, `Welcome to ${APP_NAME} ${planName}!`, html);
}

export async function sendSubscriptionCanceledEmail(
  email: string,
  userName: string,
  planName: string
): Promise<boolean> {
  const template = loadTemplate('subscription-canceled');
  const html = replaceTemplatePlaceholders(template, {
    user_name: userName,
    plan_name: planName,
  });
  return sendEmail(email, `Your ${APP_NAME} ${planName} Subscription Has Been Canceled`, html);
}

export async function sendContactFormNotification(
  fromEmail: string,
  fromName: string,
  subject: string,
  message: string
): Promise<boolean> {
  const template = loadTemplate('contact-form-admin');
  const html = replaceTemplatePlaceholders(template, {
    from_name: fromName,
    from_email: fromEmail,
    subject: subject,
    message: message,
  });
  return sendEmail(SUPPORT_EMAIL, `[Contact Form] ${subject}`, html);
}

export async function sendContactFormAutoReply(
  email: string,
  name: string
): Promise<boolean> {
  const template = loadTemplate('contact-form-reply');
  const html = replaceTemplatePlaceholders(template, {
    user_name: name,
  });
  return sendEmail(email, `We received your message - ${APP_NAME}`, html);
}

export function getEmailLogs(): EmailLog[] {
  return [...emailLogs];
}

export function isEmailConfigured(): boolean {
  return !!(SMTP_USER && SMTP_APP_PASSWORD);
}

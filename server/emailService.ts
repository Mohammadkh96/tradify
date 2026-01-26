
import { db } from "./db";
import * as schema from "@shared/schema";

export const emailService = {
  async sendTransactionalEmail(userId: string, type: "signup" | "payment_success" | "password_reset", data: any) {
    console.log(`[Email Service] Simulating ${type} email to ${userId}`, data);
    
    let subject = "";
    let content = "";

    switch (type) {
      case "signup":
        subject = "Welcome to Tradify";
        content = "Your institutional terminal is ready. Precision trading starts now.";
        break;
      case "payment_success":
        subject = "Tradify Pro Activated";
        content = "Your Pro subscription is now active. Intelligence layer unlocked.";
        break;
      case "password_reset":
        subject = "Password Reset Request";
        content = `Reset link: ${data.resetUrl}`;
        break;
    }

    try {
      // In a real app, integrate with SendGrid/SES here
      await db.insert(schema.sentEmails).values({
        userId,
        emailType: type,
        subject,
        content,
        status: "sent"
      });
      return true;
    } catch (error) {
      console.error("[Email Service] Failed to log email:", error);
      return false;
    }
  }
};

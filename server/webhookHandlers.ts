import { getStripeSync } from './stripeClient';
import { emailService } from "./emailService";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer.'
      );
    }

    const sync = await getStripeSync();
    const event = await sync.processWebhook(payload, signature);

    // Handle specific events for emails
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const customerId = invoice.customer;
      const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.stripeCustomerId, customerId)).limit(1);
      if (user) {
        await emailService.sendTransactionalEmail(user.userId, "payment_success", {});
      }
    }
  }
}

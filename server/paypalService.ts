import { storage } from './storage';
import { db } from './db';
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

export class PayPalService {
  async handleWebhook(payload: any) {
    const eventType = payload.event_type;
    const resource = payload.resource;

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.UPDATED':
        await this.updateSubscription(resource);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await this.cancelSubscription(resource);
        break;
    }
  }

  private async updateSubscription(resource: any) {
    const paypalSubscriptionId = resource.id;
    const status = resource.status; 
    const customId = resource.custom_id || resource.subscriber?.custom_id; 
    const nextBillingTime = resource.billing_info?.next_billing_time;

    if (customId) {
      await storage.updateUserSubscriptionInfo(customId, {
        subscriptionProvider: 'paypal',
        subscriptionStatus: status.toLowerCase(),
        subscriptionTier: 'PRO', 
        paypalSubscriptionId,
        currentPeriodEnd: nextBillingTime ? new Date(nextBillingTime) : undefined
      });
    }
  }

  private async cancelSubscription(resource: any) {
    const customId = resource.custom_id;
    if (customId) {
      await storage.updateUserSubscriptionInfo(customId, {
        subscriptionTier: 'FREE',
        subscriptionStatus: 'cancelled'
      });
    }
  }
}

export const paypalService = new PayPalService();

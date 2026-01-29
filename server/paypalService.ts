import { storage } from './storage';

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_PLAN_ID, PAYPAL_ELITE_PLAN_ID } = process.env;
const PAYPAL_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Plan types
export type PlanTier = 'PRO' | 'ELITE';

// Cached plan IDs - use env vars or create on demand
const cachedPlanIds: { PRO: string | null; ELITE: string | null } = {
  PRO: PAYPAL_PLAN_ID || null,
  ELITE: PAYPAL_ELITE_PLAN_ID || null,
};

// Plan pricing
const PLAN_PRICES: Record<PlanTier, string> = {
  PRO: '19.00',
  ELITE: '39.00',
};

export class PayPalService {
  private async getAccessToken(): Promise<string> {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error('PayPal credentials not configured');
    }
    
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    
    if (!response.ok) {
      throw new Error('Failed to get PayPal access token');
    }
    
    const data = await response.json();
    return data.access_token;
  }

  private async createProduct(): Promise<string> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `TRADIFY-PRODUCT-${Date.now()}`,
      },
      body: JSON.stringify({
        name: 'Tradify Pro Subscription',
        description: 'Monthly subscription to Tradify Pro trading journal',
        type: 'SERVICE',
        category: 'SOFTWARE',
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create PayPal product:', error);
      throw new Error('Failed to create PayPal product');
    }
    
    const data = await response.json();
    return data.id;
  }

  private async createBillingPlan(productId: string, tier: PlanTier): Promise<string> {
    const accessToken = await this.getAccessToken();
    const price = PLAN_PRICES[tier];
    const planName = tier === 'ELITE' ? 'Tradify Elite Monthly' : 'Tradify Pro Monthly';
    const planDesc = tier === 'ELITE' ? 'Monthly subscription to Tradify Elite' : 'Monthly subscription to Tradify Pro';
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `TRADIFY-${tier}-PLAN-${Date.now()}`,
      },
      body: JSON.stringify({
        product_id: productId,
        name: planName,
        description: planDesc,
        status: 'ACTIVE',
        billing_cycles: [
          {
            frequency: {
              interval_unit: 'MONTH',
              interval_count: 1,
            },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0, // Infinite
            pricing_scheme: {
              fixed_price: {
                value: price,
                currency_code: 'USD',
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: '0',
            currency_code: 'USD',
          },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3,
        },
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create PayPal plan:', error);
      throw new Error('Failed to create PayPal plan');
    }
    
    const data = await response.json();
    return data.id;
  }

  async getOrCreatePlanId(tier: PlanTier = 'PRO'): Promise<string> {
    // Return cached plan ID if available
    if (cachedPlanIds[tier]) {
      return cachedPlanIds[tier]!;
    }
    
    // Check if we have a stored plan ID in env
    if (tier === 'PRO' && process.env.PAYPAL_PLAN_ID) {
      cachedPlanIds.PRO = process.env.PAYPAL_PLAN_ID;
      return cachedPlanIds.PRO;
    }
    if (tier === 'ELITE' && process.env.PAYPAL_ELITE_PLAN_ID) {
      cachedPlanIds.ELITE = process.env.PAYPAL_ELITE_PLAN_ID;
      return cachedPlanIds.ELITE;
    }
    
    // Create new product and plan
    console.log(`Creating new PayPal product and billing plan for ${tier}...`);
    const productId = await this.createProduct();
    console.log('Created PayPal product:', productId);
    
    const planId = await this.createBillingPlan(productId, tier);
    console.log(`Created PayPal ${tier} billing plan:`, planId);
    console.log(`Save this PAYPAL_${tier === 'ELITE' ? 'ELITE_' : ''}PLAN_ID for future use:`, planId);
    
    cachedPlanIds[tier] = planId;
    return planId;
  }

  async createSubscription(userId: string, returnUrl: string, cancelUrl: string, tier: PlanTier = 'PRO'): Promise<{ subscriptionId: string; approvalUrl: string; tier: PlanTier }> {
    const planId = await this.getOrCreatePlanId(tier);
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `TRADIFY-SUB-${userId}-${Date.now()}`,
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: userId, // Store userId to link subscription to user
        application_context: {
          brand_name: 'Tradify',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create PayPal subscription:', error);
      throw new Error('Failed to create subscription');
    }
    
    const data = await response.json();
    const approvalUrl = data.links.find((link: any) => link.rel === 'approve')?.href;
    
    return {
      subscriptionId: data.id,
      approvalUrl,
      tier,
    };
  }

  async getSubscriptionDetails(subscriptionId: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to get subscription details:', error);
      throw new Error('Failed to get subscription details');
    }
    
    return await response.json();
  }

  async cancelSubscription(subscriptionId: string, reason: string = 'User requested cancellation'): Promise<void> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to cancel subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  async verifyWebhookSignature(headers: any, body: string): Promise<boolean> {
    // Skip verification if webhook ID not configured (development mode)
    if (!PAYPAL_WEBHOOK_ID) {
      console.warn('PayPal webhook verification skipped - PAYPAL_WEBHOOK_ID not set');
      return true;
    }

    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: PAYPAL_WEBHOOK_ID,
          webhook_event: JSON.parse(body),
        }),
      });

      if (!response.ok) {
        console.error('Webhook verification request failed:', await response.text());
        return false;
      }

      const result = await response.json();
      return result.verification_status === 'SUCCESS';
    } catch (error) {
      console.error('Webhook verification error:', error);
      return false;
    }
  }

  async handleWebhook(payload: any, headers?: any, rawBody?: string) {
    // Verify webhook signature if headers provided
    if (headers && rawBody && PAYPAL_WEBHOOK_ID) {
      const isValid = await this.verifyWebhookSignature(headers, rawBody);
      if (!isValid) {
        console.error('PayPal webhook signature verification failed');
        throw new Error('Invalid webhook signature');
      }
    }

    const eventType = payload.event_type;
    const resource = payload.resource;

    console.log('PayPal webhook event:', eventType);

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.UPDATED':
        await this.handleSubscriptionActivated(resource);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await this.handleSubscriptionCancelled(resource);
        break;
      case 'PAYMENT.SALE.COMPLETED':
        // Subscription payment received
        console.log('Subscription payment completed:', resource.id);
        break;
    }
  }

  // Activate subscription directly by fetching details (called on return URL)
  async activateSubscriptionByUser(userId: string, subscriptionId: string, tier: PlanTier = 'PRO'): Promise<boolean> {
    try {
      const details = await this.getSubscriptionDetails(subscriptionId);
      
      // Verify subscription belongs to this user
      if (details.custom_id !== userId) {
        console.error('Subscription does not belong to this user');
        return false;
      }

      // Determine tier from plan - check which cached plan ID matches
      let determinedTier: PlanTier = tier;
      if (details.plan_id) {
        if (details.plan_id === cachedPlanIds.ELITE || details.plan_id === process.env.PAYPAL_ELITE_PLAN_ID) {
          determinedTier = 'ELITE';
        } else {
          determinedTier = 'PRO';
        }
      }

      // Only activate if subscription is active or approved
      if (details.status === 'ACTIVE' || details.status === 'APPROVED') {
        await storage.updateUserSubscriptionInfo(userId, {
          subscriptionProvider: 'paypal',
          subscriptionStatus: details.status.toLowerCase(),
          subscriptionTier: determinedTier,
          paypalSubscriptionId: subscriptionId,
          renewalDate: details.billing_info?.next_billing_time 
            ? new Date(details.billing_info.next_billing_time) 
            : undefined,
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to activate subscription:', error);
      return false;
    }
  }

  private async handleSubscriptionActivated(resource: any) {
    const paypalSubscriptionId = resource.id;
    const status = resource.status; 
    const customId = resource.custom_id; 
    const nextBillingTime = resource.billing_info?.next_billing_time;
    const planId = resource.plan_id;

    // Determine tier from plan ID
    let tier: PlanTier = 'PRO';
    if (planId === cachedPlanIds.ELITE || planId === process.env.PAYPAL_ELITE_PLAN_ID) {
      tier = 'ELITE';
    }

    console.log(`Subscription activated for user: ${customId}, tier: ${tier}`);

    if (customId) {
      await storage.updateUserSubscriptionInfo(customId, {
        subscriptionProvider: 'paypal',
        subscriptionStatus: status?.toLowerCase() || 'active',
        subscriptionTier: tier, 
        paypalSubscriptionId,
        renewalDate: nextBillingTime ? new Date(nextBillingTime) : undefined,
      });
    }
  }

  private async handleSubscriptionCancelled(resource: any) {
    const customId = resource.custom_id;
    console.log('Subscription cancelled for user:', customId);
    
    if (customId) {
      // Mark as cancelled but don't downgrade immediately - user retains access until billing period ends
      // The downgrade happens when the subscription actually expires (BILLING.SUBSCRIPTION.EXPIRED)
      const status = resource.status?.toLowerCase() || 'cancelled';
      
      // Only downgrade to FREE if subscription is actually expired, not just cancelled
      if (status === 'expired' || status === 'suspended') {
        await storage.updateUserSubscriptionInfo(customId, {
          subscriptionTier: 'FREE',
          subscriptionStatus: status,
        });
      } else {
        // For cancelled status, user keeps PRO until billing period ends
        await storage.updateUserSubscriptionInfo(customId, {
          subscriptionStatus: 'cancelled', // Mark as cancelled but keep tier
        });
      }
    }
  }
}

export const paypalService = new PayPalService();

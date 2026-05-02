import { storage } from './storage';
import { emailService } from './emailService';

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_PLAN_ID, PAYPAL_ELITE_PLAN_ID, PAYPAL_PRO_ANNUAL_PLAN_ID, PAYPAL_ELITE_ANNUAL_PLAN_ID, PAYPAL_FM_PRO_PLAN_ID, PAYPAL_FM_ELITE_PLAN_ID, PAYPAL_FM_PRO_ANNUAL_PLAN_ID, PAYPAL_FM_ELITE_ANNUAL_PLAN_ID, PAYPAL_COACH_PLAN_ID, PAYPAL_COACH_ANNUAL_PLAN_ID, PAYPAL_MODE } = process.env;
const PAYPAL_BASE_URL = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

export type PlanTier = 'PRO' | 'ELITE' | 'COACH';
export type BillingPeriod = 'monthly' | 'annual';

const cachedPlanIds: Record<string, string | null> = {
  PRO_monthly: PAYPAL_PLAN_ID || null,
  ELITE_monthly: PAYPAL_ELITE_PLAN_ID || null,
  COACH_monthly: PAYPAL_COACH_PLAN_ID || null,
  PRO_annual: PAYPAL_PRO_ANNUAL_PLAN_ID || null,
  ELITE_annual: PAYPAL_ELITE_ANNUAL_PLAN_ID || null,
  COACH_annual: PAYPAL_COACH_ANNUAL_PLAN_ID || null,
};

const foundingMemberPlanIds: Record<string, string | null> = {
  PRO_monthly: PAYPAL_FM_PRO_PLAN_ID || null,
  ELITE_monthly: PAYPAL_FM_ELITE_PLAN_ID || null,
  PRO_annual: PAYPAL_FM_PRO_ANNUAL_PLAN_ID || null,
  ELITE_annual: PAYPAL_FM_ELITE_ANNUAL_PLAN_ID || null,
};

const ALL_PLAN_IDS = new Set([
  PAYPAL_PLAN_ID,
  PAYPAL_ELITE_PLAN_ID,
  PAYPAL_COACH_PLAN_ID,
  PAYPAL_PRO_ANNUAL_PLAN_ID,
  PAYPAL_ELITE_ANNUAL_PLAN_ID,
  PAYPAL_COACH_ANNUAL_PLAN_ID,
  PAYPAL_FM_PRO_PLAN_ID,
  PAYPAL_FM_ELITE_PLAN_ID,
  PAYPAL_FM_PRO_ANNUAL_PLAN_ID,
  PAYPAL_FM_ELITE_ANNUAL_PLAN_ID,
].filter(Boolean));

function getPlanKeyFromId(planId: string): { tier: PlanTier; period: BillingPeriod } | null {
  if (planId === cachedPlanIds.COACH_annual || planId === PAYPAL_COACH_ANNUAL_PLAN_ID) return { tier: 'COACH', period: 'annual' };
  if (planId === cachedPlanIds.COACH_monthly || planId === PAYPAL_COACH_PLAN_ID) return { tier: 'COACH', period: 'monthly' };
  if (planId === cachedPlanIds.ELITE_annual || planId === PAYPAL_ELITE_ANNUAL_PLAN_ID || planId === PAYPAL_FM_ELITE_ANNUAL_PLAN_ID) return { tier: 'ELITE', period: 'annual' };
  if (planId === cachedPlanIds.PRO_annual || planId === PAYPAL_PRO_ANNUAL_PLAN_ID || planId === PAYPAL_FM_PRO_ANNUAL_PLAN_ID) return { tier: 'PRO', period: 'annual' };
  if (planId === cachedPlanIds.ELITE_monthly || planId === PAYPAL_ELITE_PLAN_ID || planId === PAYPAL_FM_ELITE_PLAN_ID) return { tier: 'ELITE', period: 'monthly' };
  if (planId === cachedPlanIds.PRO_monthly || planId === PAYPAL_PLAN_ID || planId === PAYPAL_FM_PRO_PLAN_ID) return { tier: 'PRO', period: 'monthly' };
  return null;
}

const PLAN_PRICES: Record<PlanTier, string> = {
  PRO: '29.00',
  ELITE: '59.00',
  COACH: '99.00',
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

  async getOrCreatePlanId(tier: PlanTier = 'PRO', period: BillingPeriod = 'monthly'): Promise<string> {
    const key = `${tier}_${period}`;
    if (cachedPlanIds[key]) {
      return cachedPlanIds[key]!;
    }
    
    console.log(`Creating new PayPal product and billing plan for ${tier} ${period}...`);
    const productId = await this.createProduct();
    console.log('Created PayPal product:', productId);
    
    const planId = await this.createBillingPlan(productId, tier);
    console.log(`Created PayPal ${tier} ${period} billing plan:`, planId);
    
    cachedPlanIds[key] = planId;
    return planId;
  }

  async createSubscription(userId: string, returnUrl: string, cancelUrl: string, tier: PlanTier = 'PRO', period: BillingPeriod = 'monthly', isFoundingMember: boolean = false): Promise<{ subscriptionId: string; approvalUrl: string; tier: PlanTier; period: BillingPeriod }> {
    const planKey = `${tier}_${period}`;
    const fmPlanId = isFoundingMember ? foundingMemberPlanIds[planKey] : null;
    const planId = fmPlanId || await this.getOrCreatePlanId(tier, period);
    if (isFoundingMember && fmPlanId) {
      console.log(`[PayPal] Using founding member plan for ${tier} ${period}: ${fmPlanId}`);
    }
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
      period,
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

      let determinedTier: PlanTier = tier;
      let determinedPeriod: BillingPeriod = 'monthly';
      if (details.plan_id) {
        const planInfo = getPlanKeyFromId(details.plan_id);
        if (planInfo) {
          determinedTier = planInfo.tier;
          determinedPeriod = planInfo.period;
        }
      }

      // Only activate if subscription is active or approved
      if (details.status === 'ACTIVE' || details.status === 'APPROVED') {
        await storage.updateUserSubscriptionInfo(userId, {
          subscriptionProvider: 'paypal',
          subscriptionStatus: details.status.toLowerCase(),
          subscriptionTier: determinedTier,
          billingPeriod: determinedPeriod,
          paypalSubscriptionId: subscriptionId,
          renewalDate: details.billing_info?.next_billing_time 
            ? new Date(details.billing_info.next_billing_time) 
            : undefined,
        });
        
        const userName = userId.split('@')[0];
        await emailService.sendSubscriptionActivatedEmail(userId, userName, determinedTier);
        emailService.cancelActiveTrack(userId, 'free_user').catch(() => {});
        emailService.cancelActiveTrack(userId, 'free_ongoing').catch(() => {});
        emailService.cancelActiveTrack(userId, 'pro_to_elite').catch(() => {});
        if (determinedTier === 'ELITE') {
          emailService.queueEliteRetentionSequence(userId).catch(e => console.error('[DRIP] queueEliteRetention:', e));
        } else {
          emailService.queueProToEliteSequence(userId).catch(e => console.error('[DRIP] queueProToElite:', e));
        }
        console.log(`Subscription activated for ${userId}, tier: ${determinedTier}, period: ${determinedPeriod}, email sent`);
        
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

    let tier: PlanTier = 'PRO';
    let period: BillingPeriod = 'monthly';
    if (planId) {
      const planInfo = getPlanKeyFromId(planId);
      if (planInfo) {
        tier = planInfo.tier;
        period = planInfo.period;
      }
    }

    console.log(`Subscription activated for user: ${customId}, tier: ${tier}`);

    if (customId) {
      await storage.updateUserSubscriptionInfo(customId, {
        subscriptionProvider: 'paypal',
        subscriptionStatus: status?.toLowerCase() || 'active',
        subscriptionTier: tier,
        billingPeriod: period,
        paypalSubscriptionId,
        renewalDate: nextBillingTime ? new Date(nextBillingTime) : undefined,
      });
      
      const userName = customId.split('@')[0];
      await emailService.sendSubscriptionActivatedEmail(customId, userName, tier);
      emailService.cancelActiveTrack(customId, 'free_user').catch(() => {});
      emailService.cancelActiveTrack(customId, 'free_ongoing').catch(() => {});
      emailService.cancelActiveTrack(customId, 'pro_to_elite').catch(() => {});
      if (tier === 'ELITE') {
        emailService.queueEliteRetentionSequence(customId).catch(e => console.error('[DRIP] queueEliteRetention webhook:', e));
      } else {
        emailService.queueProToEliteSequence(customId).catch(e => console.error('[DRIP] queueProToElite webhook:', e));
      }
    }
  }

  private async handleSubscriptionCancelled(resource: any) {
    const customId = resource.custom_id;
    console.log('Subscription cancelled for user:', customId);
    
    if (customId) {
      // Get current user to know their plan for the email
      const user = await storage.getUserRole(customId);
      const planName = user?.subscriptionTier || 'Pro';
      
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
      
      // Send subscription canceled email
      const userName = customId.split('@')[0];
      await emailService.sendSubscriptionCanceledEmail(customId, userName, planName);
    }
  }

  async testConnection(): Promise<{ success: boolean; mode: string; message: string; details?: any }> {
    const mode = process.env.PAYPAL_MODE === 'live' ? 'LIVE' : 'SANDBOX';
    
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return {
        success: false,
        mode,
        message: 'PayPal credentials not configured',
        details: {
          hasClientId: !!PAYPAL_CLIENT_ID,
          hasClientSecret: !!PAYPAL_CLIENT_SECRET,
        }
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      
      return {
        success: true,
        mode,
        message: `PayPal ${mode} connection successful`,
        details: {
          baseUrl: PAYPAL_BASE_URL,
          tokenObtained: !!accessToken,
          clientIdPrefix: PAYPAL_CLIENT_ID.substring(0, 10) + '...',
        }
      };
    } catch (error: any) {
      return {
        success: false,
        mode,
        message: `PayPal ${mode} connection failed: ${error.message}`,
        details: {
          baseUrl: PAYPAL_BASE_URL,
          error: error.message,
        }
      };
    }
  }
}

export const paypalService = new PayPalService();

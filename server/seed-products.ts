
import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  // Check if Pro Plan already exists
  const products = await stripe.products.search({ query: "name:'Pro Plan'" });
  let product;
  
  if (products.data.length > 0) {
    product = products.data[0];
    console.log('Pro Plan already exists:', product.id);
  } else {
    // Create product
    product = await stripe.products.create({
      name: 'Pro Plan',
      description: 'Professional trading journal features including unlimited history and advanced analytics.',
      metadata: {
        plan: 'PRO'
      }
    });
    console.log('Created Product:', product.id);
  }

  // Check for monthly price
  const prices = await stripe.prices.list({ product: product.id, active: true });
  const hasMonthly = prices.data.some(p => p.recurring?.interval === 'month' && p.unit_amount === 1900);
  const hasYearly = prices.data.some(p => p.recurring?.interval === 'year' && p.unit_amount === 19000);

  if (!hasMonthly) {
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 1900, // $19.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log('Created Monthly Price:', monthlyPrice.id);
  }

  if (!hasYearly) {
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 19000, // $190.00
      currency: 'usd',
      recurring: { interval: 'year' },
    });
    console.log('Created Yearly Price:', yearlyPrice.id);
  }
}

createProducts().catch(console.error);

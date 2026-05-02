import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};

    // Create products fresh
    const proProduct = await stripe.products.create({ name: 'STAGE Pro', description: 'Pro subscription for STAGE platform' });
    const eliteProduct = await stripe.products.create({ name: 'STAGE Elite', description: 'Elite subscription for STAGE platform' });

    const proMonthly = await stripe.prices.create({ product: proProduct.id, unit_amount: 399, currency: 'eur', recurring: { interval: 'month' }, nickname: 'Pro Monthly' });
    const proYearly = await stripe.prices.create({ product: proProduct.id, unit_amount: 3990, currency: 'eur', recurring: { interval: 'year' }, nickname: 'Pro Yearly' });
    results.pro_monthly = proMonthly.id;
    results.pro_yearly = proYearly.id;

    const eliteMonthly = await stripe.prices.create({ product: eliteProduct.id, unit_amount: 999, currency: 'eur', recurring: { interval: 'month' }, nickname: 'Elite Monthly' });
    const eliteYearly = await stripe.prices.create({ product: eliteProduct.id, unit_amount: 9990, currency: 'eur', recurring: { interval: 'year' }, nickname: 'Elite Yearly' });
    results.elite_monthly = eliteMonthly.id;
    results.elite_yearly = eliteYearly.id;

    return Response.json({ success: true, price_ids: results });
  } catch (error) {
    console.error('stripeSetupProducts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
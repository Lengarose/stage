import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

// Stripe Price IDs (created via stripeSetupProducts on existing products)
const SUBSCRIPTION_PRICES = {
  pro_monthly:   { priceId: 'price_1TOZpL2fnaWmNMFQ9s0urzOD' },
  pro_yearly:    { priceId: 'price_1TOZpM2fnaWmNMFQWeNwttmB' },
  elite_monthly: { priceId: 'price_1TOZpM2fnaWmNMFQRUPsGVfB' },
  elite_yearly:  { priceId: 'price_1TOZpM2fnaWmNMFQXayEAcHW' },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tier, billing, successUrl, cancelUrl } = await req.json();

    const priceKey = `${tier}_${billing}`;
    const priceData = SUBSCRIPTION_PRICES[priceKey];
    if (!priceData) return Response.json({ error: 'Invalid tier/billing combination' }, { status: 400 });

    // Fetch player to check current subscription and expiry
    const players = await base44.entities.Player.filter({ email: user.email });
    const player = players[0];
    if (!player) return Response.json({ error: 'Player profile not found' }, { status: 404 });

    // Block if subscription hasn't expired yet
    if (player.subscription !== 'rookie' && player.subscription_expires_at) {
      const expiresAt = new Date(player.subscription_expires_at);
      if (expiresAt > new Date()) {
        return Response.json({
          error: 'active_subscription',
          expires_at: player.subscription_expires_at,
          message: `Your current subscription is active until ${expiresAt.toLocaleDateString()}. You can change plan after it expires.`
        }, { status: 400 });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceData.priceId, quantity: 1 }],
      success_url: successUrl || `${req.headers.get('origin')}/store?sub=success&tier=${tier}&billing=${billing}`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/store?sub=cancelled`,
      customer_email: user.email,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        user_email: user.email,
        player_id: player.id,
        subscription_tier: tier,
        subscription_billing: billing,
        type: 'subscription',
      },
      subscription_data: {
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
          user_email: user.email,
          player_id: player.id,
          subscription_tier: tier,
          subscription_billing: billing,
        },
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('stripeSubscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
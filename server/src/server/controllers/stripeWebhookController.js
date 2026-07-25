/**
 * Stripe webhook — server-to-server payment fulfilment.
 *
 * MUST be mounted BEFORE express.json() with a raw body parser, because Stripe
 * signature verification requires the exact bytes of the request body:
 *
 *   app.use('/api/stage/stripe/webhook',
 *     require('express').raw({ type: 'application/json' }),
 *     require('./server/controllers/stripeWebhookController'));
 *
 * Configure the endpoint in the Stripe dashboard pointing at
 *   https://stageleagues.com/api/stage/stripe/webhook
 * subscribed to: checkout.session.completed, invoice.paid,
 *   customer.subscription.deleted. Put the signing secret (whsec_...) in
 * STRIPE_WEBHOOK_SECRET (env.local.js).
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const functions = require('./functionsController');
const { EXECUTESQL } = require('../db/database');

// Verify Stripe's `Stripe-Signature` header against the raw body without pulling
// in the stripe SDK (keeps the Gandi node_modules footprint unchanged).
function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = String(header).split(',').reduce((acc, kv) => {
    const [k, v] = kv.split('=');
    if (k === 't') acc.t = v;
    if (k === 'v1') (acc.v1 = acc.v1 || []).push(v);
    return acc;
  }, {});
  if (!parts.t || !parts.v1) return false;

  // Replay protection.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t));
  if (!Number.isFinite(age) || age > toleranceSec) return false;

  const payload = `${parts.t}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  // Constant-time compare against any of the provided v1 signatures.
  return parts.v1.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch { return false; }
  });
}

router.post('/', async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook not configured');
  }

  // req.body is a Buffer here (express.raw). Verify the signature first.
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'], secret)) {
    console.warn('[stripe-webhook] invalid signature');
    return res.status(400).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).send('Invalid payload');
  }

  // Acknowledge fast; Stripe retries on non-2xx. Fulfilment is idempotent, so a
  // retry after a slow DB write is safe.
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // The event payload usually carries enough, but re-retrieve to get a
        // trusted, fully-expanded object (payment_status, subscription, customer).
        let full = session;
        try { full = await functions.retrieveStripeCheckoutSession(session.id); }
        catch (e) { console.warn('[stripe-webhook] retrieve session failed, using event payload:', e.message); }
        const outcome = await functions.fulfilCheckoutSession(full);
        console.log('[stripe-webhook] checkout.session.completed →', JSON.stringify(outcome));
        break;
      }
      case 'invoice.paid': {
        // Recurring renewal — refresh STAGE Plus expiry for the subscription.
        const invoice = event.data.object;
        const subId = invoice.subscription;
        const billing = String(invoice.lines?.data?.[0]?.plan?.interval || '') === 'year' ? 'yearly' : 'monthly';
        if (subId && String(invoice.billing_reason || '') === 'subscription_cycle') {
          const expiresExpr = billing === 'yearly'
            ? 'DATE_ADD(NOW(), INTERVAL 1 YEAR)'
            : 'DATE_ADD(NOW(), INTERVAL 1 MONTH)';
          await EXECUTESQL(
            `UPDATE players
                SET subscription = 'stage_plus',
                    subscription_billing = ?,
                    subscription_expires_at = ${expiresExpr},
                    updated_date = NOW()
              WHERE stripe_subscription_id = ?`,
            [billing, String(subId)]
          ).catch((e) => console.error('[stripe-webhook] invoice.paid renew failed:', e.message));
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await EXECUTESQL(
          `UPDATE players
              SET subscription = 'free',
                  subscription_billing = NULL,
                  subscription_expires_at = NULL,
                  updated_date = NOW()
            WHERE stripe_subscription_id = ?`,
          [String(sub.id)]
        ).catch((e) => console.error('[stripe-webhook] subscription.deleted failed:', e.message));
        break;
      }
      default:
        // Ignore other event types.
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err.message);
    // Return 200 anyway for handler-level errors we don't want Stripe to retry
    // forever on (fulfilment is idempotent and logged); return 500 only for
    // truly transient failures. Here we choose 200 to avoid retry storms.
    return res.status(200).json({ received: true, error: err.message });
  }

  return res.status(200).json({ received: true });
});

module.exports = router;

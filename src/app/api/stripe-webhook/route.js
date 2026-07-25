// src/app/api/stripe-webhook/route.js
// Confirms every tier change server-side via Stripe's signed webhook — never
// trust the client-side success_url redirect alone, since anyone could visit
// that URL directly without paying.
//
// Setup (Stripe Dashboard -> Developers -> Webhooks -> Add endpoint):
//   URL:    https://<your-domain>/api/stripe-webhook
//   Events: checkout.session.completed, customer.subscription.created,
//           customer.subscription.updated, customer.subscription.deleted,
//           charge.refunded
// Copy the resulting signing secret into STRIPE_WEBHOOK_SECRET.
import Stripe from "stripe";
import {
  grantProOneTime,
  activateSubscription,
  downgradeSubscriptionEnded,
  downgradeRefunded,
  findDeviceByPaymentIntent,
} from "@/lib/access";

const ACTIVATING_STATUSES = ["active", "trialing", "past_due"];

// The current_period_end field has moved around across Stripe API versions
// (subscription-level vs. subscription-item-level) — read defensively
// rather than assuming either location exists.
function subscriptionPeriodEnd(subscription) {
  const raw = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  return raw ? new Date(raw * 1000) : null;
}

export async function POST(request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return Response.json({ error: "Webhook isn't configured yet" }, { status: 500 });
  }

  const stripe = new Stripe(secretKey);
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const deviceId = session.client_reference_id;
        if (!deviceId) {
          console.error("Stripe webhook: checkout.session.completed with no client_reference_id", session.id);
          break;
        }
        if (session.mode === "payment") {
          await grantProOneTime(deviceId, {
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent,
            stripeCustomerId: session.customer,
          });
        }
        // mode === "subscription": intentionally a no-op here — the
        // customer.subscription.created event (which carries the actual
        // subscription status and the deviceId/product metadata we set via
        // subscription_data.metadata) finishes activating the tier.
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const deviceId = subscription.metadata?.deviceId;
        const product = subscription.metadata?.product; // "pro" | "contractor"
        if (!deviceId) {
          console.error(`Stripe webhook: ${event.type} with no deviceId in subscription metadata`, subscription.id);
          break;
        }
        if (ACTIVATING_STATUSES.includes(subscription.status)) {
          await activateSubscription(deviceId, {
            tier: product,
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscriptionPeriodEnd(subscription),
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await downgradeSubscriptionEnded(subscription.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        // Only act on a full refund of a one-time payment. Subscription
        // invoice charges (charge.invoice set) are excluded — those are
        // handled via customer.subscription.deleted, not refunds.
        if (!charge.refunded || charge.invoice) break;

        let deviceId = charge.metadata?.deviceId;
        if (!deviceId && charge.payment_intent) {
          deviceId = await findDeviceByPaymentIntent(charge.payment_intent);
        }
        if (!deviceId) {
          console.error("Stripe webhook: charge.refunded with no resolvable deviceId", charge.id);
          break;
        }
        await downgradeRefunded(deviceId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Log but still 200 — Stripe retries on non-2xx, and a DB hiccup here
    // shouldn't cause Stripe to hammer this endpoint indefinitely for an
    // event we can't usefully act on anyway.
    console.error(`Stripe webhook: error handling ${event.type}`, err);
  }

  return Response.json({ received: true });
}

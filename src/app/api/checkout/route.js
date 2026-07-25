// src/app/api/checkout/route.js
// Single checkout entry point for both PRO (one-time or monthly) and
// CONTRACTOR (monthly only). Replaces the old /api/unlock and
// /api/unlock-architecture routes — Design Studio is no longer a separate
// purchase, it's bundled into PRO.
//
// client_reference_id carries the device ID through to the webhook for
// one-time payments. For subscriptions, session-level metadata does NOT
// propagate to the resulting Subscription object, so subscription_data.metadata
// is also set — that's what the customer.subscription.* webhook handlers read.
import Stripe from "stripe";
import { PRO_ONE_TIME_PRICE_GBP, TIERS, tierAtLeast } from "@/lib/pricing";
import { getBillingIdentity } from "@/lib/access";

export async function POST(request) {
  try {
    const { deviceId, plan, billing } = await request.json();
    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
    }
    if (!["pro", "contractor"].includes(plan)) {
      return Response.json({ error: "Invalid plan" }, { status: 400 });
    }
    if (!["one_time", "monthly"].includes(billing)) {
      return Response.json({ error: "Invalid billing option" }, { status: 400 });
    }
    if (plan === "contractor" && billing === "one_time") {
      return Response.json({ error: "CONTRACTOR is only available as a monthly subscription" }, { status: 400 });
    }

    // Block starting a second, parallel purchase for a device that already
    // has active access — surface the billing portal instead, where plan
    // switches and cancellations actually belong.
    const identity = await getBillingIdentity(deviceId);
    const alreadyCovered = billing === "monthly"
      ? identity.hasActiveSubscription
      : tierAtLeast(identity.tier, TIERS.PRO);
    if (!identity.isAdmin && alreadyCovered) {
      return Response.json(
        {
          error: "You already have an active plan. Manage or change it from your billing portal.",
          usePortal: !!identity.stripeCustomerId,
        },
        { status: 409 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return Response.json({ error: "Checkout isn't configured yet (missing STRIPE_SECRET_KEY)" }, { status: 500 });
    }

    const stripe = new Stripe(secretKey);
    const origin = new URL(request.url).origin;

    let session;
    if (billing === "one_time") {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        client_reference_id: deviceId,
        customer_creation: "always",
        payment_intent_data: { metadata: { deviceId, product: "pro" } },
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: Math.round(PRO_ONE_TIME_PRICE_GBP * 100),
              product_data: {
                name: "DIY vs PRO — PRO (one-time)",
                description: "One-time purchase: unlimited AI diagnosis, step-by-step guides, materials guide, and Design Studio.",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/?checkout=success&plan=pro`,
        cancel_url: `${origin}/?checkout=cancelled`,
      });
    } else {
      const priceId = plan === "contractor"
        ? process.env.STRIPE_PRICE_CONTRACTOR_MONTHLY
        : process.env.STRIPE_PRICE_PRO_MONTHLY;
      if (!priceId) {
        return Response.json(
          { error: `Checkout isn't configured yet (missing STRIPE_PRICE_${plan.toUpperCase()}_MONTHLY)` },
          { status: 500 }
        );
      }

      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        client_reference_id: deviceId,
        metadata: { deviceId, product: plan },
        subscription_data: { metadata: { deviceId, product: plan } },
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/?checkout=success&plan=${plan}`,
        cancel_url: `${origin}/?checkout=cancelled`,
      });
    }

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Checkout route failed:", err);
    return Response.json({ error: "Couldn't start checkout", detail: String(err.message || err) }, { status: 500 });
  }
}

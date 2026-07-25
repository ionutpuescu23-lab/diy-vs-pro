// src/app/api/checkout/route.js
// Single checkout entry point for PRO and CONTRACTOR — both subscription-
// only now (the one-time PRO purchase was discontinued; legacy one-time
// buyers keep lifetime access via pro_lifetime, see src/lib/access.js).
// Replaces the old /api/unlock and /api/unlock-architecture routes —
// Design Studio is no longer a separate purchase, it's bundled into PRO.
//
// client_reference_id carries the device ID through to the webhook.
// Session-level metadata does NOT propagate to the resulting Subscription
// object, so subscription_data.metadata is also set — that's what the
// customer.subscription.* webhook handlers read.
import Stripe from "stripe";
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
    if (billing !== "monthly") {
      return Response.json({ error: "PRO and CONTRACTOR are subscription-only — one-time purchases are no longer available" }, { status: 400 });
    }

    // Block starting a second, parallel subscription for a device that
    // already has an active one — surface the billing portal instead,
    // where plan switches and cancellations actually belong.
    const identity = await getBillingIdentity(deviceId);
    if (!identity.isAdmin && identity.hasActiveSubscription) {
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

    const priceId = plan === "contractor"
      ? process.env.STRIPE_PRICE_CONTRACTOR_MONTHLY
      : process.env.STRIPE_PRICE_PRO_MONTHLY;
    if (!priceId) {
      return Response.json(
        { error: `Checkout isn't configured yet (missing STRIPE_PRICE_${plan.toUpperCase()}_MONTHLY)` },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      client_reference_id: deviceId,
      metadata: { deviceId, product: plan },
      subscription_data: { metadata: { deviceId, product: plan } },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success&plan=${plan}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Checkout route failed:", err);
    return Response.json({ error: "Couldn't start checkout", detail: String(err.message || err) }, { status: 500 });
  }
}

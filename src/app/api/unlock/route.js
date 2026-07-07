// src/app/api/unlock/route.js
// One-time Stripe Checkout Session to unlock unlimited access for a device.
// client_reference_id carries the device ID through to the webhook, which is
// what actually flips the unlock flag once payment is confirmed.
import Stripe from "stripe";
import { UNLOCK_PRICE_GBP } from "@/lib/access";

export async function POST(request) {
  try {
    const { deviceId } = await request.json();
    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return Response.json({ error: "Unlock isn't configured yet (missing STRIPE_SECRET_KEY)" }, { status: 500 });
    }

    const stripe = new Stripe(secretKey);
    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: deviceId,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(UNLOCK_PRICE_GBP * 100),
            product_data: {
              name: "DIY vs PRO — Unlock unlimited access",
              description: "One-time purchase: unlimited AI photo analysis, step-by-step guides, and material lookups.",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?unlock=success`,
      cancel_url: `${origin}/?unlock=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Unlock route failed:", err);
    return Response.json({ error: "Couldn't start checkout", detail: String(err.message || err) }, { status: 500 });
  }
}

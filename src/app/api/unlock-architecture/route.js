// src/app/api/unlock-architecture/route.js
// One-time Stripe Checkout Session to unlock Design Studio for a device.
// This is a separate purchase from the main /api/unlock flow — a device can
// be fully unlocked for the core app and still need this to use Design
// Studio, since image-generation cost is higher than the other AI routes.
// metadata.product distinguishes this from the main unlock in the shared
// webhook handler.
import Stripe from "stripe";
import { ARCHITECTURE_UNLOCK_PRICE_GBP } from "@/lib/access";

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
      metadata: { product: "architecture" },
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(ARCHITECTURE_UNLOCK_PRICE_GBP * 100),
            product_data: {
              name: "DIY vs PRO — Unlock Design Studio",
              description: "One-time purchase: AI architecture concept spec + generated exterior render.",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?archUnlock=success`,
      cancel_url: `${origin}/?archUnlock=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Unlock-architecture route failed:", err);
    return Response.json({ error: "Couldn't start checkout", detail: String(err.message || err) }, { status: 500 });
  }
}

// src/app/api/donate/route.js
// Creates a one-time Stripe Checkout Session for a flexible "support this
// tool" donation. No accounts/subscriptions — just a redirect to Stripe's
// hosted checkout and back. STRIPE_SECRET_KEY is server-only, never exposed
// to the client.
import Stripe from "stripe";

export async function POST(request) {
  try {
    const { amount } = await request.json();
    const pounds = Math.round(Number(amount));

    if (!Number.isFinite(pounds) || pounds < 1) {
      return Response.json({ error: "Enter an amount of at least £1" }, { status: 400 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return Response.json({ error: "Donations aren't configured yet (missing STRIPE_SECRET_KEY)" }, { status: 500 });
    }

    const stripe = new Stripe(secretKey);
    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: pounds * 100,
            product_data: {
              name: "Support DIY vs PRO",
              description: "One-off donation to help maintain and improve the app",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?donation=success`,
      cancel_url: `${origin}/?donation=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Donate route failed:", err);
    return Response.json({ error: "Couldn't start checkout", detail: String(err.message || err) }, { status: 500 });
  }
}

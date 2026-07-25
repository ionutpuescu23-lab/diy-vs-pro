// src/app/api/billing-portal/route.js
// Redirects a device to the Stripe-hosted Customer Portal so PRO/CONTRACTOR
// subscribers can self-serve: update their card, view invoices, switch
// between PRO monthly and CONTRACTOR monthly, or cancel — without needing
// the admin panel or a support email.
import Stripe from "stripe";
import { getStripeCustomerId } from "@/lib/access";

export async function POST(request) {
  try {
    const { deviceId } = await request.json();
    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
    }

    const stripeCustomerId = await getStripeCustomerId(deviceId);
    if (!stripeCustomerId) {
      return Response.json(
        { error: "No billing account found for this device yet — make a purchase first." },
        { status: 400 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return Response.json({ error: "Billing portal isn't configured yet (missing STRIPE_SECRET_KEY)" }, { status: 500 });
    }

    const stripe = new Stripe(secretKey);
    const origin = new URL(request.url).origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Billing portal route failed:", err);
    return Response.json({ error: "Couldn't open the billing portal", detail: String(err.message || err) }, { status: 500 });
  }
}

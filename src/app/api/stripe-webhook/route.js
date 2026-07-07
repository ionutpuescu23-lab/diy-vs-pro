// src/app/api/stripe-webhook/route.js
// Confirms unlock payment server-side via Stripe's signed webhook — never
// trust the client-side success_url redirect alone, since anyone could visit
// that URL directly without paying.
//
// Setup (Stripe Dashboard -> Developers -> Webhooks -> Add endpoint):
//   URL:    https://<your-domain>/api/stripe-webhook
//   Events: checkout.session.completed
// Copy the resulting signing secret into STRIPE_WEBHOOK_SECRET.
import Stripe from "stripe";
import { markUnlocked } from "@/lib/access";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const deviceId = session.client_reference_id;
    if (deviceId) {
      await markUnlocked(deviceId, session.id);
    } else {
      console.error("Stripe webhook: checkout.session.completed with no client_reference_id", session.id);
    }
  }

  return Response.json({ received: true });
}

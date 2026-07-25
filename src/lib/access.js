// src/lib/access.js
// Server-side enforcement for the FREE / PRO / CONTRACTOR tier model.
//
// Enforced server-side, not just hidden in the UI — a client-side-only gate
// would be trivially bypassed by calling the API directly, which defeats the
// whole point of capping API cost exposure.
//
// Fails OPEN if DATABASE_URL isn't configured yet, so the app keeps working
// (ungated, as PRO) during setup rather than breaking outright.
//
// Uses the generic `postgres` client (not a Neon-specific driver) so this
// works with any standard Postgres provider — Supabase, Neon, RDS, etc.
// DATABASE_URL must be an actual connection string (postgresql://user:pass@host/db),
// not a provider dashboard/project URL.
import postgres from "postgres";
import { TIERS, TIER_RANK, tierAtLeast, FREE_ESTIMATE_USES_PER_MONTH } from "@/lib/pricing";

const SUBSCRIPTION_ACTIVE_STATUSES = ["active", "trialing", "past_due"];

let cachedSql = null;

function getSql() {
  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connStr) return null;
  if (!cachedSql) {
    // prepare: false — required for poolers running in transaction mode
    // (e.g. Supabase's pgbouncer on port 6543), which don't support
    // server-side prepared statements across pooled connections.
    cachedSql = postgres(connStr, { ssl: "require", prepare: false });
  }
  return cachedSql;
}

// Guards the legacy->tier backfill below so it runs once per warm server
// instance rather than scanning the table on every single request.
let migrated = false;

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS device_access (
      device_id TEXT PRIMARY KEY,
      trial_uses_remaining INTEGER NOT NULL DEFAULT 2,
      unlocked BOOLEAN NOT NULL DEFAULT false,
      unlocked_at TIMESTAMPTZ,
      stripe_session_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Legacy one-time-unlock columns — kept (not dropped) because they're the
  // source data for the one-time grandfathering backfill below. No longer
  // written to by any code path other than that backfill.
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS architecture_unlocked BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS architecture_unlocked_at TIMESTAMPTZ`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS architecture_stripe_session_id TEXT`;
  // Admin devices bypass every gate below at every tier — there's no login
  // system, so this is only ever set directly, via /api/admin/grant or the
  // admin panel, not through any user-facing flow.
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`;

  // --- Tier model (FREE / PRO / CONTRACTOR) ---
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS tier_source TEXT`;
  // pro_lifetime = perpetual PRO from a one-time purchase, legacy
  // grandfathering, or an admin comp — survives a subscription lapsing.
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS pro_lifetime BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`;
  // Which tier the active subscription (if any) is for — separate from the
  // resolved `tier` column, since a lapsed/refunded subscription needs to
  // fall back to whatever pro_lifetime alone would grant.
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS subscription_tier TEXT`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS subscription_status TEXT`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS estimate_uses_this_period INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS estimate_period_start TIMESTAMPTZ NOT NULL DEFAULT now()`;

  if (!migrated) {
    // Design Studio used to be a separate one-time purchase
    // (architecture_unlocked); it's now bundled into PRO, so either legacy
    // flag being true is sufficient to grandfather a device into lifetime
    // PRO with zero action required from them. Idempotent via the
    // `tier = 'free'` guard regardless of how often this runs.
    await sql`
      UPDATE device_access SET tier = 'pro', tier_source = 'legacy_grandfather', pro_lifetime = true
      WHERE tier = 'free' AND (unlocked = true OR architecture_unlocked = true)
    `;
    migrated = true;
  }
}

function failOpenState() {
  return {
    configured: false,
    tier: TIERS.PRO,
    is_admin: false,
    pro_lifetime: true,
    subscription_status: null,
    estimate_uses_remaining: null,
    estimate_period_resets_at: null,
  };
}

// Read-only status check — does not consume or mutate anything. Used by the
// frontend to show "N/5 free this month" / "PRO" / "CONTRACTOR".
export async function getAccessState(deviceId) {
  const sql = getSql();
  if (!sql) return failOpenState();
  await ensureTable(sql);

  await sql`INSERT INTO device_access (device_id) VALUES (${deviceId}) ON CONFLICT (device_id) DO NOTHING`;
  const rows = await sql`
    SELECT tier, is_admin, pro_lifetime, subscription_status,
      estimate_uses_this_period, estimate_period_start,
      (now() >= estimate_period_start + INTERVAL '1 month') AS period_expired,
      (CASE WHEN now() >= estimate_period_start + INTERVAL '1 month'
            THEN now() + INTERVAL '1 month'
            ELSE estimate_period_start + INTERVAL '1 month' END) AS estimate_period_resets_at
    FROM device_access WHERE device_id = ${deviceId}
  `;
  const row = rows[0];
  if (!row) return failOpenState();

  const effectiveUses = row.period_expired ? 0 : row.estimate_uses_this_period;
  const estimate_uses_remaining = !row.is_admin && row.tier === TIERS.FREE
    ? Math.max(0, FREE_ESTIMATE_USES_PER_MONTH - effectiveUses)
    : null; // null = unlimited

  return {
    configured: true,
    tier: row.tier,
    is_admin: row.is_admin,
    pro_lifetime: row.pro_lifetime,
    subscription_status: row.subscription_status,
    estimate_uses_remaining,
    estimate_period_resets_at: row.estimate_period_resets_at,
  };
}

// Read-only pre-check for the main photo-diagnosis feature. Call BEFORE the
// AI provider call — never decrements anything, so a request that goes on
// to fail costs the user nothing. Pair with recordEstimateUse() after a
// successful response is parsed.
export async function checkEstimateGate(deviceId) {
  const sql = getSql();
  if (!sql) return { allowed: true, reason: "not_configured" };
  await ensureTable(sql);

  await sql`INSERT INTO device_access (device_id) VALUES (${deviceId}) ON CONFLICT (device_id) DO NOTHING`;
  const rows = await sql`
    SELECT tier, is_admin, estimate_uses_this_period, estimate_period_start,
      (now() >= estimate_period_start + INTERVAL '1 month') AS period_expired
    FROM device_access WHERE device_id = ${deviceId}
  `;
  const row = rows[0];
  if (!row) return { allowed: true, reason: "lookup_failed_fallback" };

  if (row.is_admin || row.tier !== TIERS.FREE) return { allowed: true, state: { tier: row.tier } };

  const effectiveUses = row.period_expired ? 0 : row.estimate_uses_this_period;
  const allowed = effectiveUses < FREE_ESTIMATE_USES_PER_MONTH;
  return {
    allowed,
    state: { tier: row.tier, estimate_uses_remaining: Math.max(0, FREE_ESTIMATE_USES_PER_MONTH - effectiveUses) },
  };
}

// Call ONLY after a photo-diagnosis request has succeeded. Atomically
// applies the lazy monthly reset and increments in one statement (mirrors
// the old atomic `WHERE trial_uses_remaining > 0` pattern for concurrency
// safety); a small bounded race window vs. checkEstimateGate is accepted —
// see the plan doc for why (can't hold a DB lock across the external AI
// call). Non-fatal: a DB hiccup here must never turn an already-successful
// response into an error for the user.
export async function recordEstimateUse(deviceId) {
  const sql = getSql();
  if (!sql) return;
  try {
    await ensureTable(sql);
    await sql`
      UPDATE device_access SET
        estimate_uses_this_period = CASE WHEN now() >= estimate_period_start + INTERVAL '1 month' THEN 1 ELSE estimate_uses_this_period + 1 END,
        estimate_period_start     = CASE WHEN now() >= estimate_period_start + INTERVAL '1 month' THEN now() ELSE estimate_period_start END
      WHERE device_id = ${deviceId} AND tier = 'free'
    `;
  } catch (err) {
    console.error("recordEstimateUse failed (non-fatal):", err);
  }
}

// Boolean gate for every PRO+ feature (guide, shopping-guide, design-mockup,
// design-engine). Nothing to consume/decrement — just tier-rank comparison,
// with admins bypassing everything.
export async function checkFeatureAccess(deviceId, requiredTier) {
  const sql = getSql();
  if (!sql) return { allowed: true, reason: "not_configured" };
  await ensureTable(sql);

  await sql`INSERT INTO device_access (device_id) VALUES (${deviceId}) ON CONFLICT (device_id) DO NOTHING`;
  const rows = await sql`SELECT tier, is_admin FROM device_access WHERE device_id = ${deviceId}`;
  const row = rows[0];
  if (!row) return { allowed: true, reason: "lookup_failed_fallback" };

  const allowed = row.is_admin || tierAtLeast(row.tier, requiredTier);
  return allowed ? { allowed: true, state: row } : { allowed: false, state: row };
}

// Re-derives the effective `tier` column as the max (by TIER_RANK) of
// perpetual PRO (pro_lifetime) and any currently-active subscription tier.
// Call after anything that changes either input, so e.g. a refunded
// one-time purchase doesn't wipe out an still-active CONTRACTOR
// subscription, or vice versa.
export async function recomputeTier(deviceId) {
  const sql = getSql();
  if (!sql) return;
  const rows = await sql`SELECT pro_lifetime, subscription_tier, subscription_status FROM device_access WHERE device_id = ${deviceId}`;
  const row = rows[0];
  if (!row) return;

  const baseTier = row.pro_lifetime ? TIERS.PRO : TIERS.FREE;
  const subActive = SUBSCRIPTION_ACTIVE_STATUSES.includes(row.subscription_status);
  const subTier = subActive ? (row.subscription_tier || TIERS.PRO) : TIERS.FREE;
  const effectiveTier = tierAtLeast(baseTier, subTier) ? baseTier : subTier;

  await sql`UPDATE device_access SET tier = ${effectiveTier} WHERE device_id = ${deviceId}`;
}

// Called by the Stripe webhook when a one-time PRO checkout completes.
export async function grantProOneTime(deviceId, { stripeSessionId, stripePaymentIntentId, stripeCustomerId } = {}) {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  await sql`
    INSERT INTO device_access (device_id, pro_lifetime, tier_source, unlocked, unlocked_at, stripe_session_id, stripe_payment_intent_id, stripe_customer_id)
    VALUES (${deviceId}, true, 'one_time_purchase', true, now(), ${stripeSessionId || null}, ${stripePaymentIntentId || null}, ${stripeCustomerId || null})
    ON CONFLICT (device_id) DO UPDATE SET
      pro_lifetime = true,
      tier_source = 'one_time_purchase',
      unlocked = true,
      unlocked_at = now(),
      stripe_session_id = ${stripeSessionId || null},
      stripe_payment_intent_id = COALESCE(${stripePaymentIntentId || null}, device_access.stripe_payment_intent_id),
      stripe_customer_id = COALESCE(${stripeCustomerId || null}, device_access.stripe_customer_id)
  `;
  await recomputeTier(deviceId);
}

// Called by the Stripe webhook whenever a subscription is created/updated
// into an active/trialing/past_due state. `tier` is "pro" or "contractor"
// (read from the Subscription object's own metadata — session-level
// metadata does NOT propagate to the Subscription object).
export async function activateSubscription(deviceId, { tier, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd } = {}) {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  await sql`
    INSERT INTO device_access (device_id, subscription_tier, subscription_status, subscription_current_period_end, stripe_customer_id, stripe_subscription_id, tier_source)
    VALUES (${deviceId}, ${tier || null}, ${status || null}, ${currentPeriodEnd || null}, ${stripeCustomerId || null}, ${stripeSubscriptionId || null}, 'subscription')
    ON CONFLICT (device_id) DO UPDATE SET
      subscription_tier = COALESCE(${tier || null}, device_access.subscription_tier),
      subscription_status = ${status || null},
      subscription_current_period_end = ${currentPeriodEnd || null},
      stripe_customer_id = COALESCE(${stripeCustomerId || null}, device_access.stripe_customer_id),
      stripe_subscription_id = COALESCE(${stripeSubscriptionId || null}, device_access.stripe_subscription_id),
      tier_source = 'subscription'
  `;
  await recomputeTier(deviceId);
}

// Called by the Stripe webhook when a subscription actually ends
// (customer.subscription.deleted — fires at the end of the paid period for
// cancel_at_period_end subscriptions, so access correctly persists until
// then rather than being cut off the moment the user clicks "cancel").
export async function downgradeSubscriptionEnded(stripeSubscriptionId) {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  const rows = await sql`
    UPDATE device_access SET subscription_status = 'canceled'
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
    RETURNING device_id
  `;
  const deviceId = rows[0]?.device_id;
  if (deviceId) await recomputeTier(deviceId);
}

// Called by the Stripe webhook when a one-time PRO purchase is fully
// refunded. Only clears pro_lifetime — an active subscription (if any) is
// untouched, so recomputeTier can still land on pro/contractor via that path.
export async function downgradeRefunded(deviceId) {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  await sql`UPDATE device_access SET pro_lifetime = false, tier_source = 'refunded' WHERE device_id = ${deviceId}`;
  await recomputeTier(deviceId);
}

// Only ever called from /api/admin/grant, which gates on ADMIN_SECRET —
// there's no user-facing flow that can reach this.
export async function setAdminFlag(deviceId, isAdmin) {
  const sql = getSql();
  if (!sql) return { ok: false, reason: "not_configured" };
  await ensureTable(sql);
  await sql`INSERT INTO device_access (device_id) VALUES (${deviceId}) ON CONFLICT (device_id) DO NOTHING`;
  const rows = await sql`
    UPDATE device_access SET is_admin = ${isAdmin}
    WHERE device_id = ${deviceId}
    RETURNING device_id, is_admin
  `;
  return { ok: true, state: rows[0] };
}

// Fresh, server-side check of whether a device currently has admin rights —
// used by /api/admin/manage to authorize every request. Never trust a
// client-supplied "I'm an admin" claim; always re-check against the DB.
export async function isDeviceAdmin(deviceId) {
  const sql = getSql();
  if (!sql) return false;
  await ensureTable(sql);
  const rows = await sql`SELECT is_admin FROM device_access WHERE device_id = ${deviceId}`;
  return !!rows[0]?.is_admin;
}

// Admin-panel comp/revoke of a device's tier — no payment behind these,
// distinct from the Stripe-driven grant/activate functions above.
export async function setDeviceTier(deviceId, { tier, source = "admin_grant" } = {}) {
  const sql = getSql();
  if (!sql) return { ok: false, reason: "not_configured" };
  if (!Object.values(TIERS).includes(tier)) return { ok: false, reason: "invalid_tier" };
  await ensureTable(sql);
  await sql`INSERT INTO device_access (device_id) VALUES (${deviceId}) ON CONFLICT (device_id) DO NOTHING`;

  if (tier === TIERS.FREE) {
    // Clear both entitlement paths so recomputeTier doesn't immediately
    // re-derive it back to pro/contractor.
    await sql`
      UPDATE device_access SET pro_lifetime = false, subscription_status = 'canceled', tier_source = ${source}
      WHERE device_id = ${deviceId}
    `;
  } else if (tier === TIERS.PRO) {
    await sql`UPDATE device_access SET pro_lifetime = true, tier_source = ${source} WHERE device_id = ${deviceId}`;
  } else if (tier === TIERS.CONTRACTOR) {
    await sql`
      UPDATE device_access SET subscription_tier = 'contractor', subscription_status = 'active', tier_source = ${source}
      WHERE device_id = ${deviceId}
    `;
  }

  await recomputeTier(deviceId);
  const rows = await sql`
    SELECT device_id, tier, pro_lifetime, subscription_status, subscription_tier, estimate_uses_this_period, is_admin
    FROM device_access WHERE device_id = ${deviceId}
  `;
  return { ok: true, state: rows[0] };
}

// Used by the webhook to correlate a refunded Charge back to a device when
// the charge's own metadata (inherited from payment_intent_data) is absent.
export async function findDeviceByPaymentIntent(stripePaymentIntentId) {
  const sql = getSql();
  if (!sql) return null;
  await ensureTable(sql);
  const rows = await sql`SELECT device_id FROM device_access WHERE stripe_payment_intent_id = ${stripePaymentIntentId}`;
  return rows[0]?.device_id || null;
}

// Used by /api/billing-portal to find which Stripe Customer to open a
// portal session for.
export async function getStripeCustomerId(deviceId) {
  const sql = getSql();
  if (!sql) return null;
  await ensureTable(sql);
  const rows = await sql`SELECT stripe_customer_id FROM device_access WHERE device_id = ${deviceId}`;
  return rows[0]?.stripe_customer_id || null;
}

// Used by /api/checkout to block starting a second, parallel subscription
// (or re-buying the one-time purchase) for a device that already has
// active access — kept separate from getAccessState so that function's
// frontend-facing contract doesn't grow fields it doesn't need.
export async function getBillingIdentity(deviceId) {
  const sql = getSql();
  if (!sql) return { tier: TIERS.PRO, isAdmin: false, stripeCustomerId: null, hasActiveSubscription: false };
  await ensureTable(sql);

  await sql`INSERT INTO device_access (device_id) VALUES (${deviceId}) ON CONFLICT (device_id) DO NOTHING`;
  const rows = await sql`
    SELECT tier, is_admin, stripe_customer_id, subscription_status
    FROM device_access WHERE device_id = ${deviceId}
  `;
  const row = rows[0];
  if (!row) return { tier: TIERS.FREE, isAdmin: false, stripeCustomerId: null, hasActiveSubscription: false };

  return {
    tier: row.tier,
    isAdmin: row.is_admin,
    stripeCustomerId: row.stripe_customer_id,
    hasActiveSubscription: SUBSCRIPTION_ACTIVE_STATUSES.includes(row.subscription_status),
  };
}

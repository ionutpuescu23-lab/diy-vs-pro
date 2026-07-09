// src/lib/access.js
// Shared free-trial / paywall enforcement for the AI-costing routes
// (estimate, guide, shopping-guide, measure-room, design-mockup).
//
// Enforced server-side, not just hidden in the UI — a client-side-only gate
// would be trivially bypassed by calling the API directly, which defeats the
// whole point of capping API cost exposure.
//
// Fails OPEN if DATABASE_URL isn't configured yet, so the app keeps working
// (ungated) during setup rather than breaking outright.
//
// Uses the generic `postgres` client (not a Neon-specific driver) so this
// works with any standard Postgres provider — Supabase, Neon, RDS, etc.
// DATABASE_URL must be an actual connection string (postgresql://user:pass@host/db),
// not a provider dashboard/project URL.
import postgres from "postgres";

export const FREE_TRIAL_USES = 2; // keep in sync with the DEFAULT below
export const UNLOCK_PRICE_GBP = 4.99;
// Design Studio is gated separately from the main trial/unlock — it's an
// extra one-time purchase even for devices that already unlocked everything
// else, not a share of the shared free-trial pool.
export const ARCHITECTURE_UNLOCK_PRICE_GBP = 4.99;

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
  // Added after the table already existed in production, hence ADD COLUMN
  // IF NOT EXISTS here rather than folding these into the CREATE TABLE above.
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS architecture_unlocked BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS architecture_unlocked_at TIMESTAMPTZ`;
  await sql`ALTER TABLE device_access ADD COLUMN IF NOT EXISTS architecture_stripe_session_id TEXT`;
}

// Read-only status check — does not consume a trial use. Used by the
// frontend to show "X free left" / "Unlocked" without side effects.
export async function getAccessState(deviceId) {
  const sql = getSql();
  if (!sql) return { configured: false, unlocked: true, trial_uses_remaining: FREE_TRIAL_USES, architecture_unlocked: true };
  await ensureTable(sql);

  await sql`INSERT INTO device_access (device_id) VALUES (${deviceId}) ON CONFLICT (device_id) DO NOTHING`;
  const rows = await sql`SELECT trial_uses_remaining, unlocked, architecture_unlocked FROM device_access WHERE device_id = ${deviceId}`;
  return { configured: true, ...rows[0] };
}

// Call at the top of every AI-costing route. Returns { allowed, state }.
export async function consumeAccess(deviceId) {
  const sql = getSql();
  if (!sql) return { allowed: true, reason: "not_configured" };
  await ensureTable(sql);

  await sql`INSERT INTO device_access (device_id) VALUES (${deviceId}) ON CONFLICT (device_id) DO NOTHING`;
  const rows = await sql`SELECT trial_uses_remaining, unlocked FROM device_access WHERE device_id = ${deviceId}`;
  const row = rows[0];
  if (!row) return { allowed: true, reason: "lookup_failed_fallback" };

  if (row.unlocked) return { allowed: true, state: row };

  if (row.trial_uses_remaining > 0) {
    // WHERE trial_uses_remaining > 0 makes this atomic under concurrent
    // requests — only one racing request can win the last free use.
    const updated = await sql`
      UPDATE device_access SET trial_uses_remaining = trial_uses_remaining - 1
      WHERE device_id = ${deviceId} AND trial_uses_remaining > 0
      RETURNING trial_uses_remaining, unlocked
    `;
    if (updated.length === 0) return { allowed: false, state: { trial_uses_remaining: 0, unlocked: false } };
    return { allowed: true, state: updated[0] };
  }

  return { allowed: false, state: row };
}

// Called by the Stripe webhook once payment is confirmed.
export async function markUnlocked(deviceId, stripeSessionId) {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  await sql`
    INSERT INTO device_access (device_id, unlocked, unlocked_at, stripe_session_id)
    VALUES (${deviceId}, true, now(), ${stripeSessionId})
    ON CONFLICT (device_id) DO UPDATE SET unlocked = true, unlocked_at = now(), stripe_session_id = ${stripeSessionId}
  `;
}

// Design Studio's own gate — a straight boolean, independent of the shared
// trial pool above. Call at the top of /api/design-engine; unlike
// consumeAccess there's nothing to decrement, just a purchased/not-purchased check.
export async function checkArchitectureAccess(deviceId) {
  const sql = getSql();
  if (!sql) return { allowed: true, reason: "not_configured" };
  await ensureTable(sql);

  await sql`INSERT INTO device_access (device_id) VALUES (${deviceId}) ON CONFLICT (device_id) DO NOTHING`;
  const rows = await sql`SELECT architecture_unlocked FROM device_access WHERE device_id = ${deviceId}`;
  const row = rows[0];
  if (!row) return { allowed: true, reason: "lookup_failed_fallback" };

  return row.architecture_unlocked
    ? { allowed: true, state: row }
    : { allowed: false, state: row };
}

// Called by the Stripe webhook once the Design Studio unlock payment is confirmed.
export async function markArchitectureUnlocked(deviceId, stripeSessionId) {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  await sql`
    INSERT INTO device_access (device_id, architecture_unlocked, architecture_unlocked_at, architecture_stripe_session_id)
    VALUES (${deviceId}, true, now(), ${stripeSessionId})
    ON CONFLICT (device_id) DO UPDATE SET architecture_unlocked = true, architecture_unlocked_at = now(), architecture_stripe_session_id = ${stripeSessionId}
  `;
}

// src/lib/pricing.js
// Shared tier/price constants — safe to import from both server routes
// (src/lib/access.js) and "use client" components (the dashboard), since
// this file has no server-only imports (no `postgres`, no Stripe SDK).
// This is the single source of truth for tier names/ranks/prices; nothing
// else should hardcode a tier string or a price.

export const TIERS = { FREE: "free", PRO: "pro", CONTRACTOR: "contractor" };

export const TIER_RANK = { free: 0, pro: 1, contractor: 2 };

export function tierAtLeast(tier, minTier) {
  return (TIER_RANK[tier] ?? 0) >= (TIER_RANK[minTier] ?? 0);
}

export const FREE_ESTIMATE_USES_PER_MONTH = 5;

// PRO is subscription-only now — the one-time purchase was discontinued.
// Legacy one-time buyers keep their lifetime access (see access.js's
// pro_lifetime/grandfathering logic); this constant is intentionally gone
// since no new one-time purchase can be started.
export const PRO_MONTHLY_PRICE_GBP = 1.99;
export const CONTRACTOR_MONTHLY_PRICE_GBP = 19.99;

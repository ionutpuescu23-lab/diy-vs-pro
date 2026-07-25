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

export const PRO_ONE_TIME_PRICE_GBP = 4.99;
export const PRO_MONTHLY_PRICE_GBP = 1.99;
export const CONTRACTOR_MONTHLY_PRICE_GBP = 19.99;

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

// Anonymous devices get a single free diagnosis/month — enough to see the
// app work. Providing an email (no password, no full account) raises that
// to 5/month; it's a lead-gen mechanic, not an anti-abuse one.
export const FREE_ANONYMOUS_USES_PER_MONTH = 1;
export const FREE_EMAIL_USES_PER_MONTH = 5;
export function freeMonthlyLimit(hasEmail) {
  return hasEmail ? FREE_EMAIL_USES_PER_MONTH : FREE_ANONYMOUS_USES_PER_MONTH;
}

export const PRO_ONE_TIME_PRICE_GBP = 4.99;
export const PRO_MONTHLY_PRICE_GBP = 1.99;
export const CONTRACTOR_MONTHLY_PRICE_GBP = 19.99;

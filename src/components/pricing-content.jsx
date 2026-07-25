"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  PRO_ONE_TIME_PRICE_GBP,
  PRO_MONTHLY_PRICE_GBP,
  CONTRACTOR_MONTHLY_PRICE_GBP,
  FREE_ESTIMATE_USES_PER_MONTH,
} from "@/lib/pricing";

// Matches the hex values used by the dashboard's dark theme (T tokens in
// diy-vs-pro-dashboard.jsx) and the other standalone pages (refund/terms/
// privacy) — kept self-contained per this codebase's existing convention of
// not sharing style tokens across standalone pages.
const C = {
  bg: "#0B0D10",
  ink: "#F1F5F9",
  faint: "#94A3B8",
  line: "rgba(255,255,255,0.09)",
  blue: "#60A5FA",
  diy: "#34D399",
  diySoft: "rgba(52,211,153,0.14)",
  pro: "#FB923C",
  amber: "#FBBF24",
  panel: "rgba(24,26,32,0.78)",
  inputBg: "#1C2027",
  danger: "#F87171",
};

const money = (n) => "£" + n.toFixed(2).replace(/\.00$/, "");

export default function PricingContent() {
  const [deviceId, setDeviceId] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutConflict, setCheckoutConflict] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    let id = window.localStorage.getItem("diyvspro_device_id");
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem("diyvspro_device_id", id); }
    setDeviceId(id);
  }, []);

  const startCheckout = async (plan, billing) => {
    setCheckoutBusy(true); setCheckoutError(""); setCheckoutConflict(false);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, plan, billing }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data.usePortal) setCheckoutConflict(true);
        throw new Error(data.error || "Couldn't start checkout");
      }
      window.location.href = data.url;
    } catch (e) {
      setCheckoutError(e.message || "Couldn't start checkout — try again.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  const openBillingPortal = async () => {
    setPortalBusy(true); setPortalError("");
    try {
      const response = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't open the billing portal");
      window.location.href = data.url;
    } catch (e) {
      setPortalError(e.message || "Couldn't open the billing portal — try again.");
      setPortalBusy(false);
    }
  };

  return (
    <main style={{ background: C.bg, color: C.ink, minHeight: "100vh" }} className="px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <a href="/" className="text-sm underline" style={{ color: C.blue }}>← Back to DIY vs PRO</a>
        <h1 className="text-2xl font-black uppercase tracking-wide mt-4">Pricing</h1>
        <p className="text-sm mt-1 mb-8" style={{ color: C.faint }}>
          Start free. Upgrade whenever the free plan's monthly limit stops being enough.
        </p>

        {checkoutConflict ? (
          <div className="rounded-lg border p-4 max-w-md" style={{ borderColor: C.line, background: C.panel }}>
            <p className="text-sm mb-3" style={{ color: C.ink }}>
              {checkoutError || "You already have an active plan."} Switching plans, updating your card, and
              cancelling all happen from your billing portal.
            </p>
            <button onClick={openBillingPortal} disabled={portalBusy}
                    className="w-full rounded py-2 text-sm font-bold text-white disabled:opacity-40"
                    style={{ background: C.pro }}>
              {portalBusy ? "Opening…" : "Manage billing"}
            </button>
            {portalError && <p className="mt-2 text-xs" style={{ color: C.danger }}>{portalError}</p>}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            <PlanCard
              name="FREE"
              price="£0"
              cadence="forever"
              features={[
                `${FREE_ESTIMATE_USES_PER_MONTH} photo diagnoses / month`,
                "Full diagnosis, materials list & regional pricing",
                "Unlimited room-dimension estimator",
              ]}
              cta={<a href="/" className="block w-full text-center rounded py-2.5 text-sm font-bold"
                      style={{ color: C.faint, background: C.inputBg }}>Get started free</a>}
            />

            <PlanCard
              name="PRO"
              highlight
              price={money(PRO_MONTHLY_PRICE_GBP)}
              cadence="/month, or one-time"
              features={[
                "Unlimited photo diagnoses",
                "Step-by-step fix guides",
                "Materials & tools guide",
                "Design Studio (room & garden concepts)",
              ]}
              cta={
                <div className="space-y-2">
                  <button onClick={() => startCheckout("pro", "monthly")} disabled={checkoutBusy || !deviceId}
                          className="w-full rounded py-2.5 text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                          style={{ background: C.pro }}>
                    {checkoutBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                    {money(PRO_MONTHLY_PRICE_GBP)}/mo
                  </button>
                  <button onClick={() => startCheckout("pro", "one_time")} disabled={checkoutBusy || !deviceId}
                          className="w-full rounded py-2 text-xs font-bold disabled:opacity-40"
                          style={{ color: C.pro, background: "transparent", border: `1px solid ${C.pro}` }}>
                    or pay once: {money(PRO_ONE_TIME_PRICE_GBP)}, unlimited forever
                  </button>
                </div>
              }
            />

            <PlanCard
              name="CONTRACTOR"
              accent={C.amber}
              price={money(CONTRACTOR_MONTHLY_PRICE_GBP)}
              cadence="/month"
              features={[
                "Everything in PRO",
                "Batch uploads — coming soon",
                "Client templates — coming soon",
                "API access — coming soon",
              ]}
              cta={
                <button onClick={() => startCheckout("contractor", "monthly")} disabled={checkoutBusy || !deviceId}
                        className="w-full rounded py-2.5 text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ background: C.amber }}>
                  {checkoutBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                  {money(CONTRACTOR_MONTHLY_PRICE_GBP)}/mo
                </button>
              }
            />
          </div>
        )}

        {!checkoutConflict && checkoutError && (
          <p className="mt-3 text-xs" style={{ color: C.danger }}>{checkoutError}</p>
        )}

        <p className="text-xs mt-10 pt-4" style={{ color: C.faint, borderTop: `1px solid ${C.line}` }}>
          Already on PRO or CONTRACTOR? Manage your plan, card, or cancellation from the "Manage billing" link in
          the app header, or read the{" "}
          <a href="/refund" className="underline" style={{ color: C.blue }}>Refund Policy</a>.
        </p>
      </div>
    </main>
  );
}

function PlanCard({ name, price, cadence, features, cta, highlight, accent = C.diy }) {
  return (
    <div className="rounded-xl border p-5 flex flex-col"
         style={{ borderColor: highlight ? C.pro : C.line, background: C.panel,
                  boxShadow: highlight ? `0 0 0 1px ${C.pro}` : "none" }}>
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>{name}</span>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-black">{price}</span>
        <span className="text-xs" style={{ color: C.faint }}>{cadence}</span>
      </div>
      <ul className="mt-4 space-y-2 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: accent }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">{cta}</div>
    </div>
  );
}

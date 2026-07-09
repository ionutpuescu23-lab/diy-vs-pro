"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Camera, Upload, Hammer, HardHat, MapPin, Fuel, AlertTriangle,
  CheckCircle2, Loader2, Plus, Trash2, Scale, ClipboardList, PoundSterling,
  ListChecks, Clock, ShieldAlert, PhoneCall, ExternalLink, Ruler,
  Package, Layers, Droplets, Wrench, Scissors, PaintBucket, ShoppingCart,
  Boxes, Drill, Plug, Fan, Gauge, Info, MessageSquare, Star,
  Building2, Sparkles, Home, Copy
} from "lucide-react";

/* =========================================================================
   DIY vs PRO — Property Calculators & Visual Guide
   -------------------------------------------------------------------------
   Single-file frontend dashboard.
   Modules:
     A. Visual Assessor  — photo upload -> AI issue diagnosis + material list
     B. Material Engine  — dual-tier (Trade Merchant / Retail) pricing + travel calc
     C. Labour Estimator — UK postcode -> regional multiplier -> pro quote
     D. Decision Matrix  — live DIY vs PRO ledger + Verdict Card
     E. Step-by-Step Guide — AI-generated phased fix plan: timing, UK building
        regs, safety warnings, official pro-finder directories, and an optional
        Beginner Mode (difficulty rating, confidence booster, common mistakes)
     F. Materials & Tools Guide — visual cards with real Pexels photos: material
        quality notes + supplier names, and tools needed with buy vs rent logic
     G. Design Studio — house shape/size/style brief -> AI structural concept
        spec (Claude) + a generated exterior concept render (OpenAI images)
   All costs recalculate in real time from a single shared state.
   ========================================================================= */

/* ---------------------------- DESIGN TOKENS -----------------------------
   Dark glassmorphism theme: near-black base, translucent blurred zinc
   panels, bright accent colours tuned for contrast against dark backgrounds
   (the old palette was tuned for a light "blueprint paper" background —
   the same hex values would wash out on dark, hence brighter accents here). */
const T = {
  paper:    "#0B0D10",              // near-black app background (behind the ambient photo)
  panel:    "rgba(24,26,32,0.78)",  // translucent zinc-900 glass card
  panelBg:  "rgba(24,26,32,0.92)",  // less-translucent variant for opaque-feeling surfaces (inputs, header)
  ink:      "#F1F5F9",              // near-white primary text
  faint:    "#94A3B8",              // slate-400 secondary text
  line:     "rgba(255,255,255,0.09)", // hairline border on dark glass
  blue:     "#60A5FA",              // structural / headings accent
  diy:      "#34D399",              // DIY side (bright emerald)
  diySoft:  "rgba(52,211,153,0.14)",
  pro:      "#FB923C",              // PRO side (bright orange)
  proSoft:  "rgba(251,146,60,0.14)",
  danger:   "#F87171",
  amber:    "#FBBF24",
  amberSoft:"rgba(251,191,36,0.14)",
  dangerSoft:"rgba(248,113,113,0.14)",
  inputBg:  "#1C2027",              // dark input/select field background
  headerBg: "rgba(9,10,13,0.85)",   // solid-feeling glass cover bar for the masthead
};
const money = (n) =>
  "£" + (isFinite(n) ? n : 0).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

/* ------------------- MOCK DATABASE (would live in Supabase) -------------- */

// Regional labour multipliers keyed on UK postcode *area* letters.
const REGION_MULTIPLIERS = {
  // London
  EC: 1.30, WC: 1.30, E: 1.30, N: 1.30, NW: 1.30, SE: 1.30, SW: 1.30, W: 1.30,
  // South East commuter belt
  KT: 1.20, TW: 1.20, CR: 1.18, BR: 1.18, SM: 1.18, GU: 1.20, RG: 1.18, SL: 1.20, OX: 1.15, BN: 1.12, ME: 1.10,
  // Midlands — baseline
  B: 1.00, CV: 1.00, LE: 1.00, NG: 1.00, DE: 1.00, ST: 0.98, WS: 1.00, WV: 0.98, NN: 1.02,
  // North
  L: 0.90, M: 0.95, LS: 0.93, S: 0.90, NE: 0.88, SR: 0.88, DH: 0.88, BD: 0.88,
  HD: 0.90, PR: 0.90, BL: 0.90, WN: 0.90, CH: 0.92, WA: 0.93, HU: 0.88, YO: 0.92, CA: 0.88,
  // Wales
  CF: 0.95, SA: 0.90, NP: 0.95, LL: 0.90,
  // Scotland
  G: 0.98, EH: 1.05, AB: 1.00, DD: 0.95,
  // Northern Ireland
  BT: 0.85,
};

// Baseline national trade day rates (£/day). "regulated" flags safety-critical trades.
const TRADES = [
  { id: "general",     name: "General Builder",          rate: 230, regulated: false },
  { id: "bricklayer",  name: "Bricklayer",               rate: 240, regulated: false },
  { id: "plasterer",   name: "Plasterer",                rate: 220, regulated: false },
  { id: "groundwork",  name: "Groundworker",             rate: 210, regulated: false },
  { id: "landscaper",  name: "Landscaper",               rate: 190, regulated: false },
  { id: "roofer",      name: "Roofer",                   rate: 250, regulated: false },
  { id: "damp",        name: "Damp Specialist",          rate: 260, regulated: false },
  { id: "electrician", name: "Electrician (Part P)",     rate: 280, regulated: true  },
  { id: "gas",         name: "Gas Engineer (Gas Safe)",  rate: 300, regulated: true  },
];

// Display-only copies of the free-trial/unlock constants enforced server-side
// in src/lib/access.js — keep these in sync with that file.
const FREE_TRIAL_USES_DISPLAY = 2;
const UNLOCK_PRICE_DISPLAY = 4.99;

// Starter material rows so the dashboard is useful before a photo is analysed.
const STARTER_MATERIALS = [
  { id: 1, name: "Multi-finish plaster 25kg", qty: 4, unit: "bag",  budget: 9.5,  high: 14 },
  { id: 2, name: "PVA / SBR bonding 5L",      qty: 1, unit: "tub",  budget: 12,   high: 22 },
  { id: 3, name: "Anti-damp membrane roll",   qty: 1, unit: "roll", budget: 45,   high: 89 },
];

// Starter tool rows so the Materials & Tools tab has content before the AI guide runs.
const STARTER_TOOLS = [
  { name: "Notched trowel & float", budgetPrice: 12, budgetSupplier: "B&Q", proPrice: 28, proSupplier: "Jewson",
    recommendation: "buy", rentPerDay: null,
    whyItMatters: "Budget gets the plaster on the wall; a pro stainless one glides smoother and resists rust for years.",
    rentReason: "Cheap and reusable on every future plastering job — always worth owning." },
  { name: "Mixing paddle + drill",  budgetPrice: 15, budgetSupplier: "Screwfix", proPrice: 45, proSupplier: "Toolstation",
    recommendation: "buy", rentPerDay: null,
    whyItMatters: "Budget paddles mix fine for occasional use; pro paddles handle thicker mixes without labouring your drill.",
    rentReason: "Attaches to a drill you likely already own; useful well beyond this job." },
  { name: "Moisture meter",         budgetPrice: 25, budgetSupplier: "Toolstation", proPrice: 90, proSupplier: "Screwfix Trade",
    recommendation: "rent", rentPerDay: 12,
    whyItMatters: "Budget meters give a rough go/no-go reading; pro meters are calibrated and more reliable on tricky walls.",
    rentReason: "Only needed to confirm drying before decorating — not worth owning for a one-off job." },
  { name: "Dust sheets & masking",  budgetPrice: 10, budgetSupplier: "B&Q", proPrice: 20, proSupplier: "Wickes",
    recommendation: "buy", rentPerDay: null,
    whyItMatters: "Budget sheets are thinner but fine for a single room; pro sheets are heavier and reusable many times over.",
    rentReason: "Cheap and consumable — budget dust sheets do the job." },
];

// Keyword -> icon/colour lookup so material & tool cards get a relevant glyph
// without depending on hotlinked retailer product photos.
const MATERIAL_ICON_RULES = [
  { test: /plaster|render|skim|paint/i,        icon: PaintBucket, color: T.blue },
  { test: /membrane|damp|dpc|waterproof/i,     icon: Droplets,    color: T.pro },
  { test: /pva|sbr|bond|adhesive|glue|sealant/i,icon: Droplets,   color: T.amber },
  { test: /insulation|board|sheet/i,           icon: Layers,      color: T.diy },
  { test: /brick|block|mortar|cement|sand/i,   icon: Boxes,       color: T.faint },
];
function materialIcon(name = "") {
  const hit = MATERIAL_ICON_RULES.find((r) => r.test.test(name));
  return hit || { icon: Package, color: T.faint };
}

const TOOL_ICON_RULES = [
  { test: /drill/i,                                 icon: Drill },
  { test: /trowel|float|scraper|filling knife|paint/i, icon: PaintBucket },
  { test: /saw|cutter|disc|scissors/i,               icon: Scissors },
  { test: /meter|gauge|thermo|hygrometer/i,          icon: Gauge },
  { test: /dehumidifier|fan|blower|extract/i,        icon: Fan },
  { test: /mixer|bucket|paddle/i,                    icon: Boxes },
  { test: /level|ruler|tape|square/i,                icon: Ruler },
  { test: /electric|plug|cable|socket/i,              icon: Plug },
];
function toolIcon(name = "") {
  const hit = TOOL_ICON_RULES.find((r) => r.test.test(name));
  return (hit && hit.icon) || Wrench;
}

/* --------------------------- SMALL UI ATOMS ------------------------------ */

// Brand mark — stylised Mjolnir (Thor's hammer), matching the app/PWA icon.
// `bg` is used for the strap-binding cutout lines, so pass whatever this
// renders on top of (defaults to the header badge's orange).
function MjolnirIcon({ size = 24, color = "white", bg = T.pro }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M 24 16 L 76 16 L 85 25 L 85 37 L 76 46 L 24 46 L 15 37 L 15 25 Z" fill={color} />
      <rect x="44" y="46" width="12" height="36" rx="2" fill={color} />
      <rect x="44" y="50" width="12" height="3.5" fill={bg} />
      <rect x="44" y="57" width="12" height="3.5" fill={bg} />
      <path d="M 44.5 82 q 0 9 5.5 9 q 5.5 0 5.5 -9" stroke={color} strokeWidth="4" fill="none" />
    </svg>
  );
}

// Uppercase blueprint-style label above a field or block.
function Eyebrow({ children, color = T.blue }) {
  return (
    <div className="text-xs font-bold uppercase" style={{ color, letterSpacing: "0.14em", fontFamily: "'Archivo', sans-serif" }}>
      {children}
    </div>
  );
}

// Numeric input with £ / unit adornment. All money edits flow through here.
function Field({ label, value, onChange, prefix, suffix, step = 1, width = "w-full" }) {
  return (
    <label className={`block ${width}`}>
      <span className="block text-xs mb-1" style={{ color: T.faint }}>{label}</span>
      <div className="flex items-center rounded border overflow-hidden focus-within:ring-2"
           style={{ borderColor: T.line, background: T.inputBg }}>
        {prefix && <span className="px-2 text-sm" style={{ color: T.faint }}>{prefix}</span>}
        <input
          type="number" step={step} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm outline-none"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.ink, background: "transparent" }}
        />
        {suffix && <span className="px-2 text-xs whitespace-nowrap" style={{ color: T.faint }}>{suffix}</span>}
      </div>
    </label>
  );
}

function Panel({ title, icon: Icon, accent = T.blue, children, subtitle }) {
  return (
    <section className="rounded-xl border shadow-xl overflow-hidden backdrop-blur-md" style={{ background: T.panel, borderColor: T.line }}>
      <header className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: T.line }}>
        {Icon && <Icon size={16} style={{ color: accent }} />}
        <h3 className="font-bold text-sm uppercase" style={{ color: T.ink, letterSpacing: "0.08em", fontFamily: "'Archivo', sans-serif" }}>
          {title}
        </h3>
        {subtitle && <span className="ml-auto text-xs" style={{ color: T.faint }}>{subtitle}</span>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ====================== MODULE A — VISUAL ASSESSOR ======================= */

function VisualAssessor({ onMaterials, onAnalysis, deviceId, onPaywall, onAccessChange }) {
  const [image, setImage] = useState(null);        // { data, mediaType, previewUrl }
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const [mockupBusy, setMockupBusy] = useState(false);
  const [mockupError, setMockupError] = useState("");
  const [mockupImage, setMockupImage] = useState(null);

  const visualizeFix = async () => {
    if (!image || !result) return;
    setMockupBusy(true); setMockupError(""); setMockupImage(null);
    try {
      const response = await fetch("/api/design-mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: image.data, mediaType: image.mediaType,
          issue: result.issue, rootCause: result.rootCause, deviceId,
        }),
      });
      const data = await response.json();
      onAccessChange?.();
      if (!response.ok) {
        if (onPaywall?.(response)) return;
        throw new Error(data.error || "Mockup generation failed");
      }
      setMockupImage(data.image);
    } catch (e) {
      setMockupError(e.message || "Couldn't generate a mockup — try again.");
    } finally {
      setMockupBusy(false);
    }
  };

  // Read a File into base64 for the vision request + object URL for preview.
  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) { setError("Please drop a JPG or PNG photo."); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = () =>
      setImage({ data: reader.result.split(",")[1], mediaType: file.type, previewUrl: URL.createObjectURL(file) });
    reader.readAsDataURL(file);
  };

  // Vision analysis: strict-JSON prompt so the response can drive the estimator.
  // A photo, a description, or both are accepted — the API just needs at least one.
  const analyse = async () => {
    if (!image && !description.trim()) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: image?.data, mediaType: image?.mediaType,
          description: description.trim(), deviceId,
        }),
      });
      const parsed = await response.json();
      onAccessChange?.();
      if (!response.ok) {
        if (onPaywall?.(response)) return;
        throw new Error(parsed.error || "Analysis failed");
      }
      setResult(parsed);
      onAnalysis(parsed);                                   // feeds labour tab + verdict safety flag
      onMaterials(                                          // feeds material engine
        (parsed.materials || []).map((m, i) => ({
          id: Date.now() + i, name: m.name, qty: num(m.qty) || 1,
          unit: m.unit || "each", budget: num(m.budget), high: num(m.high),
        }))
      );
    } catch (e) {
      setError("Analysis failed — try a clearer photo or re-run.");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Upload zone */}
      <Panel title="Photo Upload" icon={Camera} subtitle="damp, cracks, subfloors, gardens…">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
          className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer p-6 transition-colors"
          style={{ minHeight: "14rem", borderColor: dragOver ? T.blue : T.line, background: dragOver ? "rgba(96,165,250,0.10)" : "transparent" }}
        >
          {image ? (
            <img src={image.previewUrl} alt="Uploaded issue" className="max-h-64 rounded shadow" />
          ) : (
            <>
              <Upload size={28} style={{ color: T.blue }} />
              <p className="mt-2 text-sm font-medium" style={{ color: T.ink }}>Drag & drop a photo of the problem</p>
              <p className="text-xs mt-1" style={{ color: T.faint }}>or click to browse — JPG / PNG</p>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
                 onChange={(e) => loadFile(e.target.files[0])} />
        </div>

        <label className="block mt-3">
          <span className="block text-xs mb-1" style={{ color: T.faint }}>
            {image ? "Add extra detail (optional)" : "…or just describe the issue"}
          </span>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="e.g. Damp patch on the north wall, musty smell, gets worse after heavy rain…"
            className="w-full rounded border px-2 py-1.5 text-sm outline-none" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }}
          />
        </label>

        <button
          onClick={analyse} disabled={(!image && !description.trim()) || busy}
          className="mt-3 w-full rounded py-2.5 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: T.blue, fontFamily: "'Archivo', sans-serif", letterSpacing: "0.06em" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
          {busy ? "SURVEYING…" : "IDENTIFY PROBLEM & BUILD FIX PLAN"}
        </button>
        {error && <p className="mt-2 text-xs" style={{ color: T.danger }}>{error}</p>}
      </Panel>

      {/* Diagnosis output */}
      <Panel title="Surveyor's Report" icon={HardHat}
             subtitle={result ? `severity: ${result.severity}` : "awaiting photo or description"}>
        {!result && !busy && (
          <p className="text-sm" style={{ color: T.faint }}>
            Upload a photo, describe the issue in words, or both — the assessor will identify the issue,
            explain the root cause, write a step-by-step fix guide and push the exact material list into
            the price engine. A photo gives the most accurate diagnosis, but a good description works too.
          </p>
        )}
        {busy && <p className="text-sm animate-pulse" style={{ color: T.faint }}>Reading brickwork, moisture patterns, levels…</p>}
        {result && (
          <div className="space-y-3 text-sm" style={{ color: T.ink }}>
            <div>
              <Eyebrow>Identified issue</Eyebrow>
              <p className="font-semibold text-base mt-0.5">{result.issue}</p>
            </div>
            <div>
              <Eyebrow>Likely root cause</Eyebrow>
              <p className="mt-0.5">{result.rootCause}</p>
            </div>
            {result.regulated && (
              <div className="flex items-start gap-2 rounded p-2 text-xs font-semibold"
                   style={{ background: T.dangerSoft, color: T.danger }}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Regulated work — a certified {result.trade} is required by law. The verdict will enforce this.
              </div>
            )}
            <div>
              <Eyebrow>Fix guide</Eyebrow>
              <ol className="mt-1 space-y-1 list-decimal list-inside">
                {(result.steps || []).map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
            <div className="flex items-center gap-2 rounded p-2 text-xs font-semibold"
                 style={{ background: T.diySoft, color: T.diy }}>
              <CheckCircle2 size={14} />
              {result.materials?.length || 0} materials sent to the price engine · trade &amp; days sent to labour estimator
            </div>

            {image && (
              <div className="pt-2 border-t" style={{ borderColor: T.line }}>
                <button onClick={visualizeFix} disabled={mockupBusy}
                        className="w-full rounded py-2 text-xs font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                        style={{ background: T.blue, fontFamily: "'Archivo', sans-serif", letterSpacing: "0.05em" }}>
                  {mockupBusy ? <Loader2 size={14} className="animate-spin" /> : "🎨"}
                  {mockupBusy ? "GENERATING MOCKUP…" : "VISUALIZE THE FIX (AI MOCKUP)"}
                </button>
                {mockupError && <p className="mt-1 text-xs" style={{ color: T.danger }}>{mockupError}</p>}
                {mockupImage && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <Eyebrow>Before</Eyebrow>
                      <img src={image.previewUrl} alt="Before" className="mt-1 rounded w-full object-cover" style={{ aspectRatio: "1/1" }} />
                    </div>
                    <div>
                      <Eyebrow color={T.diy}>After (AI mockup)</Eyebrow>
                      <img src={mockupImage} alt="After — AI generated mockup" className="mt-1 rounded w-full object-cover" style={{ aspectRatio: "1/1" }} />
                    </div>
                  </div>
                )}
                {mockupImage && (
                  <p className="mt-1 text-[11px]" style={{ color: T.faint }}>
                    AI-generated impression only — not a guarantee of the actual finished result.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ================ MODULE B — DUAL-TIER MATERIAL PRICE ENGINE ============== */

function MaterialEngine({ materials, setMaterials, tier, setTier, travel, setTravel, travelCost }) {
  const edit = (id, key, val) =>
    setMaterials(materials.map((m) => (m.id === id ? { ...m, [key]: key === "name" || key === "unit" ? val : num(val) } : m)));
  const addRow = () =>
    setMaterials([...materials, { id: Date.now(), name: "New material", qty: 1, unit: "each", budget: 0, high: 0 }]);
  const remove = (id) => setMaterials(materials.filter((m) => m.id !== id));

  const totals = useMemo(() => ({
    budget: materials.reduce((s, m) => s + m.qty * m.budget, 0),
    high:   materials.reduce((s, m) => s + m.qty * m.high, 0),
  }), [materials]);

  return (
    <div className="space-y-4">
      <Panel title="Dual-Tier Material Pricing" icon={PoundSterling}
             subtitle="Trade Merchant = bulk/trade pricing · Retail = B&Q / Travis Perkins / Screwfix shelf price">
        {/* Tier toggle drives which column feeds the DIY & PRO totals */}
        <div className="flex rounded overflow-hidden border mb-3 w-full sm:w-auto" style={{ borderColor: T.line }}>
          {[
            { id: "budget", label: `Trade Merchant · ${money(totals.budget)}` },
            { id: "high",   label: `Retail (B&Q/Travis/Screwfix) · ${money(totals.high)}` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTier(t.id)}
              className="flex-1 px-4 py-2 text-xs font-bold uppercase"
              style={{
                fontFamily: "'Archivo', sans-serif", letterSpacing: "0.06em",
                background: tier === t.id ? T.blue : T.inputBg,
                color: tier === t.id ? "white" : T.faint,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Editable ledger — every cell live-updates the Decision Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <thead>
              <tr className="text-left text-xs uppercase" style={{ color: T.faint }}>
                <th className="py-1 pr-2 font-semibold">Material</th>
                <th className="py-1 pr-2 font-semibold w-20">Qty</th>
                <th className="py-1 pr-2 font-semibold w-24">Unit</th>
                <th className="py-1 pr-2 font-semibold w-28" style={{ color: tier === "budget" ? T.blue : T.faint }}>Trade £</th>
                <th className="py-1 pr-2 font-semibold w-28" style={{ color: tier === "high" ? T.blue : T.faint }}>Retail £</th>
                <th className="py-1 pr-2 font-semibold w-24 text-right">Line</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const line = m.qty * (tier === "budget" ? m.budget : m.high);
                return (
                  <tr key={m.id} className="border-t" style={{ borderColor: T.line }}>
                    <td className="py-1 pr-2">
                      <input value={m.name} onChange={(e) => edit(m.id, "name", e.target.value)}
                             className="w-full bg-transparent outline-none" style={{ minWidth: "10rem", color: T.ink }} />
                    </td>
                    <td><input type="number" value={m.qty} onChange={(e) => edit(m.id, "qty", e.target.value)}
                               className="w-16 rounded border px-1 py-0.5" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }} /></td>
                    <td><input value={m.unit} onChange={(e) => edit(m.id, "unit", e.target.value)}
                               className="w-20 rounded border px-1 py-0.5" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }} /></td>
                    <td><input type="number" step="0.5" value={m.budget} onChange={(e) => edit(m.id, "budget", e.target.value)}
                               className="w-24 rounded border px-1 py-0.5" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }} /></td>
                    <td><input type="number" step="0.5" value={m.high} onChange={(e) => edit(m.id, "high", e.target.value)}
                               className="w-24 rounded border px-1 py-0.5" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }} /></td>
                    <td className="text-right font-semibold" style={{ color: T.ink }}>{money(line)}</td>
                    <td className="text-right">
                      <button onClick={() => remove(m.id)} aria-label={`Remove ${m.name}`}>
                        <Trash2 size={14} style={{ color: T.faint }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={addRow} className="mt-3 flex items-center gap-1 text-xs font-bold" style={{ color: T.blue }}>
          <Plus size={14} /> Add material row
        </button>
      </Panel>

      {/* DIY travel overheads — merchant runs are a real hidden cost */}
      <Panel title="DIY Travel Expenses" icon={Fuel} accent={T.diy}
             subtitle="merchant runs are where DIY budgets quietly leak">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Vehicle economy" suffix="mpg" value={travel.mpg} onChange={(v) => setTravel({ ...travel, mpg: v })} />
          <Field label="Distance to merchant (one way)" suffix="miles" value={travel.miles} onChange={(v) => setTravel({ ...travel, miles: v })} />
          <Field label="Number of trips" suffix="trips" value={travel.trips} onChange={(v) => setTravel({ ...travel, trips: v })} />
          <Field label="Fuel price" prefix="£" suffix="/litre" step={0.01} value={travel.fuelPrice} onChange={(v) => setTravel({ ...travel, fuelPrice: v })} />
        </div>
        <p className="mt-3 text-sm" style={{ color: T.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
          {num(travel.trips)} round trips × {num(travel.miles) * 2} mi ÷ {num(travel.mpg)} mpg →
          <span className="font-bold" style={{ color: T.diy }}> {money(travelCost)}</span> added to the DIY column.
        </p>
      </Panel>
    </div>
  );
}

/* ================ MODULE C — REGIONAL LABOUR COST ESTIMATOR =============== */

// Extract the letter prefix of a UK postcode ("SW1A 1AA" -> "SW").
const postcodeArea = (pc) => (pc.trim().toUpperCase().match(/^[A-Z]{1,2}/) || [""])[0];

function LabourEstimator({ labour, setLabour, region, proLabour }) {
  const trade = TRADES.find((t) => t.id === labour.tradeId) || TRADES[0];
  return (
    <Panel title="Regional Labour Estimator" icon={MapPin} accent={T.pro}
           subtitle="baseline UK day rates × postcode multiplier">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-xs mb-1" style={{ color: T.faint }}>UK postcode</span>
          <input value={labour.postcode} onChange={(e) => setLabour({ ...labour, postcode: e.target.value })}
                 placeholder="e.g. L1, M4, SW11"
                 className="w-full rounded border px-2 py-1.5 text-sm uppercase outline-none"
                 style={{ borderColor: T.line, fontFamily: "'IBM Plex Mono', monospace", background: T.inputBg, color: T.ink }} />
        </label>
        <label className="block">
          <span className="block text-xs mb-1" style={{ color: T.faint }}>Trade required</span>
          <select value={labour.tradeId}
                  onChange={(e) => {
                    const t = TRADES.find((x) => x.id === e.target.value);
                    setLabour({ ...labour, tradeId: e.target.value, dayRate: t.rate });
                  }}
                  className="w-full rounded border px-2 py-1.5 text-sm" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }}>
          {TRADES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <Field label="Day rate (editable)" prefix="£" suffix="/day" value={labour.dayRate}
               onChange={(v) => setLabour({ ...labour, dayRate: v })} />
        <Field label="Estimated days" suffix="days" step={0.5} value={labour.days}
               onChange={(v) => setLabour({ ...labour, days: v })} />
      </div>

      {/* Region readout */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
           style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.ink }}>
        <span>Area <b>{region.area || "—"}</b></span>
        <span>multiplier <b style={{ color: region.mult > 1 ? T.pro : T.diy }}>×{region.mult.toFixed(2)}</b></span>
        <span>{money(num(labour.dayRate))} × {num(labour.days)}d × {region.mult.toFixed(2)} =
          <b style={{ color: T.pro }}> {money(proLabour)}</b></span>
        {trade.regulated && (
          <span className="flex items-center gap-1 font-bold" style={{ color: T.danger }}>
            <AlertTriangle size={13} /> regulated trade
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Actual quote received (overrides estimate)" prefix="£" value={labour.actualQuote}
               onChange={(v) => setLabour({ ...labour, actualQuote: v })} />
        <Field label="Builder material markup" suffix="%" value={labour.markup}
               onChange={(v) => setLabour({ ...labour, markup: v })} />
      </div>
      <p className="mt-2 text-xs" style={{ color: T.faint }}>
        Leave "actual quote" at 0 to use the regional estimate. Builders typically add 10–15% on materials they supply.
      </p>
    </Panel>
  );
}

/* ==================== MODULE D — DECISION MATRIX + VERDICT ================ */

function DecisionMatrix({ diy, pro, verdict, timeValue, setTimeValue, diyHours, setDiyHours }) {
  // Balance beam: share of total cost on each side (the signature live gauge).
  const total = diy.total + pro.total || 1;
  const diyShare = (diy.total / total) * 100;

  return (
    <div className="space-y-4">
      {/* The beam — tilts live as any number on any tab changes */}
      <div className="rounded-lg border p-4" style={{ background: T.panel, borderColor: T.line }}>
        <div className="flex items-center justify-between text-xs font-bold uppercase"
             style={{ fontFamily: "'Archivo', sans-serif", letterSpacing: "0.1em" }}>
          <span style={{ color: T.diy }}>DIY {money(diy.total)}</span>
          <Scale size={16} style={{ color: T.blue }} />
          <span style={{ color: T.pro }}>PRO {money(pro.total)}</span>
        </div>
        <div className="mt-2 h-3 rounded-full overflow-hidden flex" role="img"
             aria-label={`DIY ${money(diy.total)} versus professional ${money(pro.total)}`}>
          <div style={{ width: `${diyShare}%`, background: T.diy, transition: "width 300ms ease" }} />
          <div style={{ width: `${100 - diyShare}%`, background: T.pro, transition: "width 300ms ease" }} />
        </div>
      </div>

      {/* Two-column ledger */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* LEFT — DIY */}
        <Panel title="DIY Estimator" icon={Hammer} accent={T.diy}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Your time value" prefix="£" suffix="/hr" value={timeValue} onChange={setTimeValue} />
            <Field label="Your hours on the job" suffix="hrs" step={0.5} value={diyHours} onChange={setDiyHours} />
          </div>
          <dl className="text-sm space-y-1.5" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.ink }}>
            {[
              ["Materials (" + diy.tierLabel + ")", diy.materials],
              ["Travel & fuel", diy.travel],
              ["Value of your time", diy.time],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b pb-1" style={{ borderColor: T.line }}>
                <dt style={{ color: T.faint }}>{k}</dt><dd className="font-semibold">{money(v)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-1 text-base font-bold" style={{ color: T.diy }}>
              <dt>DIY TOTAL</dt><dd>{money(diy.total)}</dd>
            </div>
          </dl>
        </Panel>

        {/* RIGHT — PRO */}
        <Panel title="Professional Quote" icon={HardHat} accent={T.pro}>
          <dl className="text-sm space-y-1.5 mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.ink }}>
            {[
              [pro.usingActual ? "Labour (your real quote)" : "Labour (regional estimate)", pro.labour],
              [`Materials + ${pro.markupPct}% builder markup`, pro.materials],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b pb-1" style={{ borderColor: T.line }}>
                <dt style={{ color: T.faint }}>{k}</dt><dd className="font-semibold">{money(v)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-1 text-base font-bold" style={{ color: T.pro }}>
              <dt>PRO TOTAL</dt><dd>{money(pro.total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs" style={{ color: T.faint }}>
            Set postcode, trade and days in the Labour tab — or type a real quote to override.
          </p>
        </Panel>
      </div>

      {/* VERDICT CARD — stamped site-sign, hazard striped when safety forces PRO */}
      <div
        className="rounded-lg p-5 text-center border-2"
        style={{
          borderColor: verdict.color,
          background: verdict.hazard
            ? `repeating-linear-gradient(45deg, ${T.proSoft}, ${T.proSoft} 14px, rgba(251,146,60,0.06) 14px, rgba(251,146,60,0.06) 28px)`
            : verdict.diyWins ? T.diySoft : T.proSoft,
        }}
      >
        <Eyebrow color={verdict.color}>The bottom line</Eyebrow>
        <p className="mt-1 text-2xl md:text-3xl font-black uppercase"
           style={{ color: verdict.color, fontFamily: "'Archivo', sans-serif", letterSpacing: "0.04em" }}>
          {verdict.headline}
        </p>
        <p className="mt-1 text-sm font-medium" style={{ color: T.ink }}>{verdict.detail}</p>
      </div>
    </div>
  );
}

/* ================ MODULE E — AI STEP-BY-STEP GUIDE ========================= */

const SEVERITIES = ["low", "medium", "high"];

function StepByStepGuide({ analysis, materials, trade, region, labour, roomDims, setRoomDims, deviceId, onPaywall, onAccessChange }) {
  const [severity, setSeverity] = useState(analysis?.severity || "medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guide, setGuide] = useState(null);
  const [beginnerMode, setBeginnerMode] = useState(true);

  const [showMeasure, setShowMeasure] = useState(false);
  const [measurePhoto, setMeasurePhoto] = useState(null); // { data, mediaType, previewUrl }
  const [refObject, setRefObject] = useState("a4");
  const [measureBusy, setMeasureBusy] = useState(false);
  const [measureError, setMeasureError] = useState("");
  const [measureResult, setMeasureResult] = useState(null); // { confidence, notes }
  const measureFileRef = useRef(null);

  const loadMeasurePhoto = (file) => {
    if (!file || !file.type.startsWith("image/")) { setMeasureError("Please choose a JPG or PNG photo."); return; }
    setMeasureError("");
    const reader = new FileReader();
    reader.onload = () =>
      setMeasurePhoto({ data: reader.result.split(",")[1], mediaType: file.type, previewUrl: URL.createObjectURL(file) });
    reader.readAsDataURL(file);
  };

  const estimateFromPhoto = async () => {
    if (!measurePhoto) return;
    setMeasureBusy(true); setMeasureError(""); setMeasureResult(null);
    try {
      const response = await fetch("/api/measure-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: measurePhoto.data, mediaType: measurePhoto.mediaType, referenceObject: refObject, deviceId }),
      });
      const parsed = await response.json();
      onAccessChange?.();
      if (!response.ok) {
        if (onPaywall?.(response)) return;
        throw new Error(parsed.error || "Estimate failed");
      }
      setRoomDims({ length: parsed.widthM, width: parsed.heightM });
      setMeasureResult({ confidence: parsed.confidence, notes: parsed.notes });
    } catch (e) {
      setMeasureError("Couldn't estimate from that photo — try a clearer shot with the reference object fully visible.");
    } finally {
      setMeasureBusy(false);
    }
  };

  // Keep the severity dropdown in sync the first time a photo analysis lands.
  useEffect(() => { if (analysis?.severity) setSeverity(analysis.severity); }, [analysis]);

  const generate = async () => {
    setBusy(true); setError(""); setGuide(null);
    try {
      const response = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue: analysis?.issue, rootCause: analysis?.rootCause,
          severity, trade: trade.name, regulated: trade.regulated || analysis?.regulated === true,
          roomLength: roomDims.length, roomWidth: roomDims.width,
          materials, postcode: labour.postcode, regionArea: region.area, deviceId,
        }),
      });
      const parsed = await response.json();
      onAccessChange?.();
      if (!response.ok) {
        if (onPaywall?.(response)) return;
        throw new Error(parsed.error || "Guide generation failed");
      }
      setGuide(parsed);
    } catch (e) {
      setError("Couldn't generate the guide — try again in a moment.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Panel title="Job Details" icon={Ruler} subtitle="feeds the AI-generated fix plan">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Room length" suffix="m" step={0.1} value={roomDims.length}
                 onChange={(v) => setRoomDims({ ...roomDims, length: v })} />
          <Field label="Room width" suffix="m" step={0.1} value={roomDims.width}
                 onChange={(v) => setRoomDims({ ...roomDims, width: v })} />
          <label className="block">
            <span className="block text-xs mb-1" style={{ color: T.faint }}>Damage severity</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm capitalize" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="flex flex-col justify-end">
            <span className="block text-xs mb-1" style={{ color: T.faint }}>Room area</span>
            <div className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: T.line, fontFamily: "'IBM Plex Mono', monospace" }}>
              {(num(roomDims.length) * num(roomDims.width)).toFixed(1)} m²
            </div>
          </div>
        </div>

        <button onClick={() => setShowMeasure((s) => !s)}
                className="mt-3 text-xs font-bold flex items-center gap-1" style={{ color: T.blue }}>
          <Camera size={13} /> {showMeasure ? "Hide photo estimate" : "No tape measure? Estimate from a photo"}
        </button>

        {showMeasure && (
          <div className="mt-3 rounded-lg border p-3" style={{ borderColor: T.line, background: T.paper }}>
            <p className="text-xs" style={{ color: T.faint }}>
              Place an A4 sheet or a card flat against the wall, photograph the wall so the object is fully visible,
              and we'll estimate the width/height from it. This is a rough estimate — not a substitute for a tape measure.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select value={refObject} onChange={(e) => setRefObject(e.target.value)}
                      className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }}>
                <option value="a4">Reference: A4 sheet of paper</option>
                <option value="card">Reference: credit/debit card</option>
              </select>
              <button onClick={() => measureFileRef.current?.click()}
                      className="rounded border px-3 py-1.5 text-xs font-bold" style={{ borderColor: T.line, color: T.ink }}>
                {measurePhoto ? "Change photo" : "Choose photo"}
              </button>
              <input ref={measureFileRef} type="file" accept="image/*" capture="environment" className="hidden"
                     onChange={(e) => loadMeasurePhoto(e.target.files[0])} />
            </div>
            {measurePhoto && <img src={measurePhoto.previewUrl} alt="Room reference" className="mt-2 max-h-40 rounded" />}
            <button onClick={estimateFromPhoto} disabled={!measurePhoto || measureBusy}
                    className="mt-2 w-full rounded py-2 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: T.blue, fontFamily: "'Archivo', sans-serif" }}>
              {measureBusy ? <Loader2 size={14} className="animate-spin" /> : <Ruler size={14} />}
              {measureBusy ? "ESTIMATING…" : "ESTIMATE DIMENSIONS"}
            </button>
            {measureError && <p className="mt-2 text-xs" style={{ color: T.danger }}>{measureError}</p>}
            {measureResult && (
              <div className="mt-2 flex items-start gap-1.5 text-xs rounded p-1.5"
                   style={{ background: measureResult.confidence === "high" ? T.diySoft : T.amberSoft,
                            color: measureResult.confidence === "high" ? T.diy : T.amber }}>
                <Info size={12} className="mt-0.5 shrink-0" />
                <span><b className="uppercase">{measureResult.confidence} confidence</b> — {measureResult.notes}</span>
              </div>
            )}
          </div>
        )}

        <p className="mt-3 text-xs" style={{ color: T.faint }}>
          Issue: <b>{analysis?.issue || "no photo analysed yet — plan will be generic"}</b> ·
          Trade: <b>{trade.name}</b> · Materials: <b>{materials.length}</b> rows · Area: <b>{region.area || "—"}</b>
        </p>
        <label className="mt-3 flex items-center gap-2 text-xs font-semibold cursor-pointer select-none" style={{ color: T.ink }}>
          <input type="checkbox" checked={beginnerMode} onChange={(e) => setBeginnerMode(e.target.checked)} />
          Beginner Mode — difficulty rating, confidence booster & common mistakes
        </label>
        <button
          onClick={generate} disabled={busy}
          className="mt-3 w-full rounded py-2.5 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: T.blue, fontFamily: "'Archivo', sans-serif", letterSpacing: "0.06em" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ListChecks size={16} />}
          {busy ? "BUILDING FIX PLAN…" : "GENERATE STEP-BY-STEP GUIDE"}
        </button>
        {error && <p className="mt-2 text-xs" style={{ color: T.danger }}>{error}</p>}
      </Panel>

      {guide && (
        <>
          {guide.professionalRequired?.mustCallPro && (
            <div className="rounded-lg p-4 border-2 flex items-start gap-3"
                 style={{ borderColor: T.danger, background: T.dangerSoft }}>
              <ShieldAlert size={20} style={{ color: T.danger }} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-black uppercase text-sm" style={{ color: T.danger, fontFamily: "'Archivo', sans-serif", letterSpacing: "0.05em" }}>
                  Call a professional
                </p>
                <p className="text-sm mt-0.5" style={{ color: T.ink }}>{guide.professionalRequired.reason}</p>
              </div>
            </div>
          )}

          {beginnerMode && guide.difficulty && (
            <div className="rounded-lg border p-3 flex items-center gap-3" style={{ borderColor: T.line, background: T.panel }}>
              <div className="shrink-0 rounded-full flex items-center justify-center font-black text-xs"
                   style={{ width: 44, height: 44, background: T.diySoft, color: T.diy, fontFamily: "'Archivo', sans-serif" }}>
                {guide.difficulty.rating}/10
              </div>
              <div>
                <Eyebrow color={T.diy}>Difficulty</Eyebrow>
                <p className="text-sm mt-0.5" style={{ color: T.ink }}>{guide.difficulty.summary}</p>
              </div>
            </div>
          )}

          {beginnerMode && guide.confidenceBooster && (
            <div className="rounded-lg p-3 text-sm flex items-start gap-2" style={{ background: T.diySoft, color: T.diy }}>
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{guide.confidenceBooster}</span>
            </div>
          )}

          <Panel title="Overview" icon={ListChecks} subtitle={guide.totalEstimatedTime}>
            <p className="text-sm" style={{ color: T.ink }}>{guide.overview}</p>
          </Panel>

          <Panel title="Phased Fix Plan" icon={Clock}>
            <ol className="space-y-4">
              {(guide.phases || []).map((phase, i) => (
                <li key={i} className="border-l-2 pl-4" style={{ borderColor: T.blue }}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-bold text-sm" style={{ color: T.ink, fontFamily: "'Archivo', sans-serif" }}>
                      {i + 1}. {phase.name}
                    </span>
                    {phase.duration && (
                      <span className="text-xs flex items-center gap-1" style={{ color: T.faint }}>
                        <Clock size={12} /> {phase.duration}
                      </span>
                    )}
                  </div>
                  <ol className="mt-1.5 space-y-1 list-decimal list-inside text-sm" style={{ color: T.ink }}>
                    {(phase.steps || []).map((s, j) => <li key={j}>{s}</li>)}
                  </ol>
                  {(phase.safetyWarnings || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {phase.safetyWarnings.map((w, j) => (
                        <div key={j} className="flex items-start gap-1.5 text-xs font-semibold rounded p-1.5"
                             style={{ background: T.dangerSoft, color: T.danger }}>
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}
                        </div>
                      ))}
                    </div>
                  )}
                  {beginnerMode && (phase.commonMistakes || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {phase.commonMistakes.map((m, j) => (
                        <div key={j} className="flex items-start gap-1.5 text-xs rounded p-1.5"
                             style={{ background: T.amberSoft, color: T.amber }}>
                          <Info size={12} className="mt-0.5 shrink-0" /> {m}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Panel>

          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="UK Building Regulations" icon={ShieldAlert} accent={T.amber}>
              {(guide.buildingRegs || []).length === 0 ? (
                <p className="text-sm" style={{ color: T.faint }}>No specific regulations flagged for this job.</p>
              ) : (
                <div className="space-y-2">
                  {guide.buildingRegs.map((r, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-semibold" style={{ color: T.ink }}>{r.reference}</p>
                      <p className="text-xs mt-0.5" style={{ color: T.faint }}>{r.why}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="PPE Required" icon={AlertTriangle} accent={T.pro}>
              <div className="flex flex-wrap gap-1.5">
                {(guide.ppeRequired || []).map((p, i) => (
                  <span key={i} className="text-xs font-semibold rounded-full px-2.5 py-1"
                        style={{ background: T.proSoft, color: T.pro }}>
                    {p}
                  </span>
                ))}
                {(guide.ppeRequired || []).length === 0 && (
                  <p className="text-sm" style={{ color: T.faint }}>None specified.</p>
                )}
              </div>
            </Panel>
          </div>

          <Panel title="Find a Certified Professional" icon={PhoneCall} accent={T.pro}
                 subtitle={labour.postcode ? `search by postcode ${labour.postcode.toUpperCase()}` : "enter a postcode in the Labour tab"}>
            <p className="text-xs mb-3" style={{ color: T.faint }}>
              We don't invent tradesperson names or phone numbers — here are the official UK registers/directories
              for <b>{trade.name}</b>. Search each one using your postcode.
            </p>
            <div className="space-y-2">
              {(guide.findAProfessional || []).map((d, i) => (
                <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                   className="flex items-start gap-2 rounded border p-2.5 text-sm hover:bg-white/5 transition-colors"
                   style={{ borderColor: T.line }}>
                  <ExternalLink size={14} className="mt-0.5 shrink-0" style={{ color: T.blue }} />
                  <span>
                    <span className="font-semibold" style={{ color: T.ink }}>{d.body}</span>
                    <span className="block text-xs mt-0.5" style={{ color: T.faint }}>{d.notes}</span>
                  </span>
                </a>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

/* ================ MODULE F — MATERIALS & TOOLS GUIDE ======================= */

// Real product photo via our Pexels proxy, with a session-lifetime cache so
// switching tabs (which remounts the cards) doesn't re-fetch the same query.
// Falls back to the existing icon-tile look if there's no key / no result yet.
const imageCache = new Map();

function ProductImage({ query, fallbackIcon: FallbackIcon, fallbackColor = T.faint, height = "h-44" }) {
  const [state, setState] = useState(() => (imageCache.has(query) ? imageCache.get(query) : null));

  useEffect(() => {
    if (!query || imageCache.has(query)) { setState(imageCache.get(query) ?? null); return; }
    let cancelled = false;
    fetch(`/api/image-search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => { imageCache.set(query, data); if (!cancelled) setState(data); })
      .catch(() => { const fallback = { url: null }; imageCache.set(query, fallback); if (!cancelled) setState(fallback); });
    return () => { cancelled = true; };
  }, [query]);

  if (state?.url) {
    return (
      <div className={`relative ${height} overflow-hidden`} style={{ background: T.inputBg }}>
        <img src={state.url} alt={query} className="w-full h-full object-cover" />
        {state.photographer && (
          <span className="absolute bottom-1 right-1 text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(22,33,46,0.6)", color: "white" }}>
            📷 {state.photographer} / Pexels
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={`${height} flex items-center justify-center`} style={{ background: fallbackColor + "1A" }}>
      {state === null
        ? <Loader2 size={22} className="animate-spin" style={{ color: fallbackColor }} />
        : (FallbackIcon ? <FallbackIcon size={30} style={{ color: fallbackColor }} /> : <Package size={30} style={{ color: fallbackColor }} />)}
    </div>
  );
}

// Material card: real photo + trade/retail price & supplier + AI quality note + when-to-use-which.
function MaterialCard({ material, tier, note }) {
  const { icon: Icon, color } = materialIcon(material.name);
  const delta = num(material.high) - num(material.budget);
  return (
    <div className="rounded-lg border overflow-hidden flex flex-col" style={{ borderColor: T.line, background: T.panel }}>
      <ProductImage query={`${material.name} building material`} fallbackIcon={Icon} fallbackColor={color} />
      <div className="p-3 flex flex-col grow">
        <p className="font-semibold text-sm" style={{ color: T.ink }}>{material.name}</p>
        <p className="text-xs" style={{ color: T.faint }}>{material.qty} × {material.unit}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded p-2 border" style={{ borderColor: tier === "budget" ? T.blue : T.line, background: tier === "budget" ? "rgba(96,165,250,0.12)" : T.inputBg }}>
            <span className="text-[10px] uppercase font-bold" style={{ color: T.faint }}>Trade</span>
            <b className="block text-sm" style={{ color: T.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{money(material.budget)}</b>
            <span className="text-[10px]" style={{ color: T.faint }}>@ {note?.budgetSupplier || "trade counter"}</span>
          </div>
          <div className="rounded p-2 border" style={{ borderColor: tier === "high" ? T.blue : T.line, background: tier === "high" ? "rgba(96,165,250,0.12)" : T.inputBg }}>
            <span className="text-[10px] uppercase font-bold" style={{ color: T.faint }}>Retail</span>
            <b className="block text-sm" style={{ color: T.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{money(material.high)}</b>
            <span className="text-[10px]" style={{ color: T.faint }}>@ {note?.highSupplier || "DIY retailer"}</span>
          </div>
        </div>
        {delta > 0 && (
          <p className="mt-1 text-[11px]" style={{ color: T.faint }}>+{money(delta)} retail markup</p>
        )}
        <p className="mt-2 text-xs leading-snug" style={{ color: T.ink }}>
          {note?.qualityNote || "Generate the guide below for a like-for-like quality comparison."}
        </p>
        {note?.whenToUse && (
          <div className="mt-2 flex items-start gap-1.5 text-xs rounded p-1.5" style={{ background: T.diySoft, color: T.diy }}>
            <ListChecks size={12} className="mt-0.5 shrink-0" /> {note.whenToUse}
          </div>
        )}
      </div>
    </div>
  );
}

// Tool card: real photo + budget/pro buy price & supplier + hire price + buy-vs-rent verdict.
function ToolCard({ tool }) {
  const Icon = toolIcon(tool.name);
  const buy = tool.recommendation !== "rent";
  return (
    <div className="rounded-lg border overflow-hidden flex flex-col" style={{ borderColor: T.line, background: T.panel }}>
      <ProductImage query={`${tool.name} tool`} fallbackIcon={Icon} fallbackColor={T.diy} />
      <div className="p-3 flex flex-col grow">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm" style={{ color: T.ink }}>{tool.name}</p>
          <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 shrink-0"
                style={{ background: buy ? T.diySoft : T.proSoft, color: buy ? T.diy : T.pro }}>
            {buy ? "Buy" : "Rent"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded p-2 border" style={{ borderColor: T.line, background: T.paper }}>
            <span className="text-[10px] uppercase font-bold" style={{ color: T.faint }}>Budget</span>
            <b className="block text-sm" style={{ color: T.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{money(tool.budgetPrice)}</b>
            <span className="text-[10px]" style={{ color: T.faint }}>@ {tool.budgetSupplier || "B&Q"}</span>
          </div>
          <div className="rounded p-2 border" style={{ borderColor: T.line, background: T.paper }}>
            <span className="text-[10px] uppercase font-bold" style={{ color: T.faint }}>Pro-grade</span>
            <b className="block text-sm" style={{ color: T.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{money(tool.proPrice)}</b>
            <span className="text-[10px]" style={{ color: T.faint }}>@ {tool.proSupplier || "trade merchant"}</span>
          </div>
        </div>
        {tool.rentPerDay ? (
          <p className="mt-1 text-xs" style={{ color: T.faint }}>
            Hire: <b style={{ color: T.ink }}>{money(tool.rentPerDay)}/day</b>
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-snug" style={{ color: T.ink }}>{tool.whyItMatters}</p>
        {tool.rentReason && <p className="mt-1 text-xs" style={{ color: T.faint }}>{tool.rentReason}</p>}
      </div>
    </div>
  );
}

function MaterialsToolsGuide({ materials, tier, analysis, trade, deviceId, onPaywall, onAccessChange }) {
  const [tools, setTools] = useState(STARTER_TOOLS);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/shopping-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue: analysis?.issue, trade: trade.name,
          materials: materials.map((m) => ({ name: m.name, qty: m.qty, unit: m.unit, budget: m.budget, high: m.high })),
          deviceId,
        }),
      });
      const parsed = await response.json();
      onAccessChange?.();
      if (!response.ok) {
        if (onPaywall?.(response)) return;
        throw new Error(parsed.error || "Guide generation failed");
      }
      const noteMap = {};
      (parsed.materialNotes || []).forEach((n) => { noteMap[n.name] = n; });
      setNotes(noteMap);
      if (parsed.tools?.length) setTools(parsed.tools);
      setGenerated(true);
    } catch (e) {
      setError("Couldn't generate the guide — try again in a moment.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Panel title="Materials & Tools Guide" icon={ShoppingCart}
             subtitle="visual shopping list — what to buy, what to rent, and why">
        <p className="text-sm" style={{ color: T.ink }}>
          Every material and tool for this job in one visual list, with a plain-English note on when the
          cheaper option is fine and when the extra spend is worth it.
        </p>
        <button
          onClick={generate} disabled={busy}
          className="mt-3 rounded py-2.5 px-4 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: T.blue, fontFamily: "'Archivo', sans-serif", letterSpacing: "0.06em" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
          {busy ? "BUILDING GUIDE…" : generated ? "REGENERATE GUIDE" : "GENERATE QUALITY & TOOLS GUIDE"}
        </button>
        {error && <p className="mt-2 text-xs" style={{ color: T.danger }}>{error}</p>}
      </Panel>

      <div>
        <Eyebrow>Materials</Eyebrow>
        {materials.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: T.faint }}>Add materials in the Materials & Travel tab first.</p>
        ) : (
          <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {materials.map((m) => <MaterialCard key={m.id} material={m} tier={tier} note={notes[m.name]} />)}
          </div>
        )}
      </div>

      <div>
        <Eyebrow>Tools you'll need</Eyebrow>
        <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((t, i) => <ToolCard key={i} tool={t} />)}
        </div>
      </div>
    </div>
  );
}

/* ================ MODULE G — DESIGN STUDIO (ARCHITECTURE ENGINE) =========== */

const HOUSE_SHAPES = [
  { id: "rectangular", label: "Rectangular" },
  { id: "l-shape",     label: "L-shape" },
  { id: "u-shape",     label: "U-shape / courtyard" },
  { id: "split_level", label: "Split-level" },
];

const HOUSE_STYLES = [
  { id: "modern",      label: "Modern minimalist" },
  { id: "futuristic",  label: "Futuristic" },
  { id: "classic",     label: "Classic British" },
  { id: "oriental",    label: "Oriental-influenced" },
];

function SpecRow({ label, children }) {
  return (
    <div className="py-2 border-b last:border-b-0" style={{ borderColor: T.line }}>
      <span className="block text-[10px] uppercase font-bold mb-0.5" style={{ color: T.faint }}>{label}</span>
      <div className="text-sm" style={{ color: T.ink }}>{children}</div>
    </div>
  );
}

function DesignStudio({ deviceId, onPaywall, onAccessChange, unlocked, onUnlock, unlockBusy, unlockError }) {
  const [shape, setShape] = useState("rectangular");
  const [sizeM2, setSizeM2] = useState(120);
  const [storeys, setStoreys] = useState(2);
  const [style, setStyle] = useState("modern");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [spec, setSpec] = useState(null);
  const [image, setImage] = useState(null);

  const generate = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/design-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shape, sizeM2, storeys, style, notes, deviceId }),
      });
      const parsed = await response.json();
      onAccessChange?.();
      if (!response.ok) {
        if (parsed.architecturePaywall) throw new Error("Design Studio isn't unlocked on this device yet.");
        if (onPaywall?.(response)) return;
        throw new Error(parsed.error || "Design generation failed");
      }
      setSpec(parsed.spec);
      setImage(parsed.image);
    } catch (e) {
      setError(e.message || "Couldn't generate the design — try again in a moment.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 relative">
      {!unlocked && (
        <div className="absolute inset-0 z-10 rounded-xl flex flex-col items-center justify-center p-6 text-center backdrop-blur-md"
             style={{ background: "rgba(11,13,16,0.6)", border: `1px solid ${T.line}` }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
               style={{ background: "rgba(96,165,250,0.12)", border: `1px solid ${T.blue}` }}>
            <Sparkles size={22} style={{ color: T.blue }} />
          </div>
          <h3 className="text-base font-bold" style={{ color: T.ink, fontFamily: "'Archivo', sans-serif" }}>AI Design Studio</h3>
          <p className="text-xs mt-1 mb-4 max-w-xs" style={{ color: T.faint }}>
            Generate an AI structural concept spec and exterior render mapped to your house's shape, size and style.
            A one-time unlock, separate from the main free trial.
          </p>
          <button onClick={onUnlock} disabled={unlockBusy}
                  className="rounded-lg py-2 px-4 font-bold text-xs text-white disabled:opacity-40"
                  style={{ background: T.blue, fontFamily: "'Archivo', sans-serif", letterSpacing: "0.06em" }}>
            {unlockBusy ? "REDIRECTING…" : "UNLOCK DESIGN STUDIO • £4.99"}
          </button>
          {unlockError && <p className="mt-2 text-xs" style={{ color: T.danger }}>{unlockError}</p>}
        </div>
      )}
      <div className={`space-y-4 ${!unlocked ? "opacity-30 pointer-events-none select-none" : ""}`}>
      <Panel title="Design Studio" icon={Building2}
             subtitle="house brief -> AI structural concept + generated render">
        <p className="text-sm" style={{ color: T.ink }}>
          Describe the house you're imagining and the engine will produce an early-concept structural spec
          (footprint, storeys, materials, rough UK self-build cost) alongside a generated exterior concept render.
        </p>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-xs mb-1" style={{ color: T.faint }}>Footprint shape</span>
            <select value={shape} onChange={(e) => setShape(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }}>
              {HOUSE_SHAPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <Field label="Total floor area" suffix="m²" step={5} value={sizeM2} onChange={setSizeM2} />
          <label className="block">
            <span className="block text-xs mb-1" style={{ color: T.faint }}>Storeys</span>
            <select value={storeys} onChange={(e) => setStoreys(Number(e.target.value))}
                    className="w-full rounded border px-2 py-1.5 text-sm" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs mb-1" style={{ color: T.faint }}>Style direction</span>
            <select value={style} onChange={(e) => setStyle(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }}>
              {HOUSE_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <label className="block mt-3">
          <span className="block text-xs mb-1" style={{ color: T.faint }}>Anything specific? (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    placeholder="e.g. sloped site, south-facing garden, want a home office…"
                    className="w-full rounded border px-2 py-1.5 text-sm outline-none resize-none"
                    style={{ borderColor: T.line, background: T.inputBg, color: T.ink }} />
        </label>

        <button
          onClick={generate} disabled={busy}
          className="mt-3 rounded py-2.5 px-4 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: T.blue, fontFamily: "'Archivo', sans-serif", letterSpacing: "0.06em" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? "DESIGNING…" : spec ? "REGENERATE DESIGN" : "GENERATE DESIGN CONCEPT"}
        </button>
        {error && <p className="mt-2 text-xs" style={{ color: T.danger }}>{error}</p>}
      </Panel>

      {(spec || image) && (
        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="Concept Render" icon={Home} subtitle="AI-generated exterior visualisation">
            {image ? (
              <img src={image} alt="Generated house concept" className="w-full rounded-lg" style={{ border: `1px solid ${T.line}` }} />
            ) : (
              <div className="h-64 flex items-center justify-center rounded-lg" style={{ background: T.inputBg }}>
                <Loader2 size={24} className="animate-spin" style={{ color: T.faint }} />
              </div>
            )}
          </Panel>

          <Panel title="Structural Spec" icon={ClipboardList} subtitle="RIBA Stage 1 concept-level brief">
            {spec ? (
              <div>
                <p className="text-sm mb-2" style={{ color: T.ink }}>{spec.overview}</p>
                <SpecRow label="Footprint">
                  {spec.footprint?.shape} — {spec.footprint?.approxDimensions}
                  <p className="text-xs mt-1" style={{ color: T.faint }}>{spec.footprint?.orientation}</p>
                </SpecRow>
                <SpecRow label="Storeys">
                  {(spec.storeys || []).map((s, i) => (
                    <p key={i} className="text-xs mb-1">
                      <b style={{ color: T.ink }}>{s.level}</b> ({s.approxAreaM2} m²) — <span style={{ color: T.faint }}>{(s.rooms || []).join(", ")}</span>
                    </p>
                  ))}
                </SpecRow>
                <SpecRow label="Structure">
                  <p className="text-xs"><b>Foundation:</b> {spec.structure?.foundationType}</p>
                  <p className="text-xs mt-1"><b>Primary structure:</b> {spec.structure?.primaryStructure}</p>
                  <p className="text-xs mt-1"><b>Roof:</b> {spec.structure?.roofType}</p>
                </SpecRow>
                <SpecRow label="Materials">
                  <p className="text-xs"><b>Facade:</b> {spec.materials?.facade}</p>
                  <p className="text-xs mt-1"><b>Roof:</b> {spec.materials?.roof}</p>
                  <p className="text-xs mt-1"><b>Glazing:</b> {spec.materials?.glazing}</p>
                </SpecRow>
                {spec.sustainability?.length > 0 && (
                  <SpecRow label="Sustainability">
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                      {spec.sustainability.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </SpecRow>
                )}
                {spec.regulatoryNotes?.length > 0 && (
                  <SpecRow label="UK regulatory notes">
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                      {spec.regulatoryNotes.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </SpecRow>
                )}
                {spec.estimatedBuildCostGBP && (
                  <SpecRow label="Estimated UK self-build cost">
                    <b style={{ color: T.blue, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {money(spec.estimatedBuildCostGBP.low)} – {money(spec.estimatedBuildCostGBP.high)}
                    </b>
                    <p className="text-xs mt-1" style={{ color: T.faint }}>{spec.estimatedBuildCostGBP.basis}</p>
                  </SpecRow>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center rounded-lg" style={{ background: T.inputBg }}>
                <Loader2 size={24} className="animate-spin" style={{ color: T.faint }} />
              </div>
            )}
          </Panel>
        </div>
      )}
      </div>
    </div>
  );
}

/* ============================== APP SHELL ================================= */

const TABS = [
  { id: "assess",   label: "1 · Visual Assessor" },
  { id: "materials",label: "2 · Materials & Travel" },
  { id: "labour",   label: "3 · Labour by Region" },
  { id: "decision", label: "4 · Decision Matrix" },
  { id: "guide",    label: "5 · Step-by-Step Guide" },
  { id: "shopping", label: "6 · Materials & Tools" },
  { id: "design",   label: "7 · Design Studio" },
];

export default function DIYvsProDashboard() {
  const [tab, setTab] = useState("assess");

  /* ------- shared state: every module reads/writes this single source ------ */
  const [materials, setMaterials] = useState(STARTER_MATERIALS);
  const [tier, setTier] = useState("budget");
  const [travel, setTravel] = useState({ mpg: 38, miles: 6, trips: 3, fuelPrice: 1.45 });
  const [labour, setLabour] = useState({ postcode: "L1", tradeId: "plasterer", dayRate: 220, days: 2, actualQuote: 0, markup: 12 });
  const [timeValue, setTimeValue] = useState(20);   // £/hr the user values their own time at
  const [diyHours, setDiyHours] = useState(12);
  const [analysis, setAnalysis] = useState(null);   // last vision result (safety flag lives here)
  const [roomDims, setRoomDims] = useState({ length: 4, width: 3 });
  const [bgImage, setBgImage] = useState(null);     // ambient background photo — purely decorative
  const [showDonate, setShowDonate] = useState(false);
  const [donateAmount, setDonateAmount] = useState(5);
  const [donateBusy, setDonateBusy] = useState(false);
  const [donateError, setDonateError] = useState("");
  const [donationBanner, setDonationBanner] = useState(null); // "success" | "cancelled" | null, from the post-checkout redirect

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("donation");
    if (status === "success" || status === "cancelled") {
      setDonationBanner(status);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  /* ---------------------- free trial / unlock paywall ----------------------
     A per-browser device ID (localStorage) tracks a shared free-trial pool
     across every AI-costing action. Real enforcement happens server-side in
     each route (see src/lib/access.js) — this is just the UI reflecting that
     state and offering the one-time unlock when the trial runs out. */
  const [deviceId, setDeviceId] = useState(null);
  const [access, setAccess] = useState(null); // { unlocked, trial_uses_remaining, configured }
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [unlockBanner, setUnlockBanner] = useState(null); // "success" | "cancelled" | null
  const [deviceIdCopied, setDeviceIdCopied] = useState(false);

  // Lets a user (or someone walking them through support) grab their device
  // ID without needing DevTools — especially useful on mobile, where reading
  // localStorage otherwise requires remote debugging via a computer.
  const copyDeviceId = () => {
    if (!deviceId || !navigator.clipboard) return;
    navigator.clipboard.writeText(deviceId).then(() => {
      setDeviceIdCopied(true);
      setTimeout(() => setDeviceIdCopied(false), 2000);
    }).catch(() => {});
  };

  useEffect(() => {
    let id = window.localStorage.getItem("diyvspro_device_id");
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem("diyvspro_device_id", id); }
    setDeviceId(id);

    const status = new URLSearchParams(window.location.search).get("unlock");
    if (status === "success" || status === "cancelled") {
      setUnlockBanner(status);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Design Studio's own one-time unlock — separate purchase from the main
  // trial/unlock above, tracked via the same access-state row's
  // architecture_unlocked column.
  const [archUnlockBusy, setArchUnlockBusy] = useState(false);
  const [archUnlockError, setArchUnlockError] = useState("");
  const [archUnlockBanner, setArchUnlockBanner] = useState(null); // "success" | "cancelled" | null

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("archUnlock");
    if (status === "success" || status === "cancelled") {
      setArchUnlockBanner(status);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const refreshAccess = (id) => {
    fetch(`/api/access?deviceId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then(setAccess)
      .catch(() => {});
  };

  useEffect(() => { if (deviceId) refreshAccess(deviceId); }, [deviceId, unlockBanner, archUnlockBanner]);

  const handleUnlockArchitecture = async () => {
    setArchUnlockBusy(true); setArchUnlockError("");
    try {
      const response = await fetch("/api/unlock-architecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't start checkout");
      window.location.href = data.url;
    } catch (e) {
      setArchUnlockError(e.message || "Couldn't start checkout — try again.");
      setArchUnlockBusy(false);
    }
  };

  // Mini admin panel — only reachable via the header badge, which only
  // renders when access.is_admin is already true. Every action still goes
  // through /api/admin/manage, which re-checks admin status server-side
  // against deviceId rather than trusting this component's state.
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTargetId, setAdminTargetId] = useState("");
  const [adminLookup, setAdminLookup] = useState(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState("");

  const adminAction = async (action) => {
    const targetDeviceId = adminTargetId.trim();
    if (!targetDeviceId) { setAdminError("Enter a device ID first."); return; }
    setAdminBusy(true); setAdminError("");
    try {
      const response = await fetch("/api/admin/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerDeviceId: deviceId, targetDeviceId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");
      setAdminLookup(data);
      if (targetDeviceId === deviceId) refreshAccess(deviceId);
    } catch (e) {
      setAdminError(e.message || "Action failed — try again.");
    } finally {
      setAdminBusy(false);
    }
  };

  // Passed down to every AI-costing tab: call after a fetch response comes
  // back so a 402 (trial exhausted) pops the paywall instead of a generic error.
  const handlePaywall = (response) => {
    if (response.status === 402) { setShowUnlock(true); return true; }
    return false;
  };

  const handleUnlock = async () => {
    setUnlockBusy(true); setUnlockError("");
    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't start checkout");
      window.location.href = data.url;
    } catch (e) {
      setUnlockError(e.message || "Couldn't start checkout — try again.");
      setUnlockBusy(false);
    }
  };

  const handleDonate = async () => {
    setDonateBusy(true); setDonateError("");
    try {
      const response = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: donateAmount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't start checkout");
      window.location.href = data.url;
    } catch (e) {
      setDonateError(e.message || "Couldn't start checkout — try again.");
      setDonateBusy(false);
    }
  };

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackEase, setFeedbackEase] = useState(0);
  const [feedbackImprovements, setFeedbackImprovements] = useState("");
  const [feedbackComments, setFeedbackComments] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleFeedback = async () => {
    setFeedbackBusy(true); setFeedbackError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          easeOfUse: feedbackEase || null,
          improvements: feedbackImprovements,
          comments: feedbackComments,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't save feedback");
      setFeedbackSent(true);
    } catch (e) {
      setFeedbackError(e.message || "Couldn't save feedback — try again.");
    } finally {
      setFeedbackBusy(false);
    }
  };

  const closeFeedback = () => {
    setShowFeedback(false);
    setFeedbackSent(false); setFeedbackEase(0); setFeedbackImprovements(""); setFeedbackComments(""); setFeedbackError("");
  };

  // One-off ambient background photo so the app reads as a premium property tool
  // rather than a bare spreadsheet. Purely decorative: fails silently to the flat
  // paper colour if there's no Pexels key or the request fails.
  useEffect(() => {
    fetch(`/api/image-search?q=${encodeURIComponent("luxury modern house architecture")}&orientation=landscape`)
      .then((r) => r.json())
      .then((data) => { if (data?.url) setBgImage(data.url); })
      .catch(() => {});
  }, []);

  /* ------------------------- derived calculations -------------------------- */
  const region = useMemo(() => {
    const area = postcodeArea(labour.postcode);
    return { area, mult: REGION_MULTIPLIERS[area] ?? 1.0 };
  }, [labour.postcode]);

  const materialTotal = useMemo(
    () => materials.reduce((s, m) => s + m.qty * (tier === "budget" ? m.budget : m.high), 0),
    [materials, tier]
  );

  // Travel: round-trip miles / mpg -> gallons -> litres (×4.546) × pump price.
  const travelCost = useMemo(() => {
    const gallons = (num(travel.miles) * 2 * num(travel.trips)) / Math.max(num(travel.mpg), 1);
    return gallons * 4.546 * num(travel.fuelPrice);
  }, [travel]);

  const proLabourEstimate = num(labour.dayRate) * num(labour.days) * region.mult;
  const proLabour = num(labour.actualQuote) > 0 ? num(labour.actualQuote) : proLabourEstimate;
  const proMaterials = materialTotal * (1 + num(labour.markup) / 100);

  const diy = {
    materials: materialTotal, travel: travelCost, time: num(timeValue) * num(diyHours),
    tierLabel: tier === "budget" ? "trade merchant" : "retail",
    total: materialTotal + travelCost + num(timeValue) * num(diyHours),
  };
  const pro = {
    labour: proLabour, materials: proMaterials, markupPct: num(labour.markup),
    usingActual: num(labour.actualQuote) > 0, total: proLabour + proMaterials,
  };

  /* ---------------------------- verdict logic ------------------------------ */
  const trade = TRADES.find((t) => t.id === labour.tradeId) || TRADES[0];
  const safetyForced = trade.regulated || analysis?.regulated === true;
  const saving = Math.abs(diy.total - pro.total);
  const verdict = safetyForced
    ? { headline: "Hire a Professional", color: T.danger, hazard: true, diyWins: false,
        detail: "Safety / regulation risk: this work must be done by a certified trade (Gas Safe, Part P or structural). Cost comparison is overridden." }
    : diy.total < pro.total
    ? { headline: `Do It Yourself — saves ${money(saving)}`, color: T.diy, hazard: false, diyWins: true,
        detail: `Even valuing your time at ${money(num(timeValue))}/hr for ${num(diyHours)} hrs, DIY comes in under the pro route.` }
    : { headline: `Hire a Professional — DIY costs ${money(saving)} more`, color: T.pro, hazard: false, diyWins: false,
        detail: "Once your time and merchant runs are priced in, the pro quote wins on efficiency." };

  /* -------------------------------- render --------------------------------- */
  return (
    <div className="min-h-screen relative" style={{ color: T.ink }}>
      {/* Ambient background photo — fixed behind everything, tinted so panels stay crisp */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundColor: T.paper,
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(11,13,16,0.55)" }} />
      </div>

      {/* Load the two project faces once */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />

      {/* Masthead */}
      <header className="border-b backdrop-blur-md" style={{ background: T.headerBg, borderColor: T.line }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="rounded p-2" style={{ background: T.pro }}><MjolnirIcon size={18} color="white" bg={T.pro} /></div>
          <div>
            <h1 className="text-lg font-black uppercase leading-tight text-white"
                style={{ fontFamily: "'Archivo', sans-serif", letterSpacing: "0.06em" }}>
              DIY <span style={{ color: T.pro }}>vs</span> PRO
            </h1>
            <p className="text-xs" style={{ color: T.faint }}>Property calculators & visual guide — photo → diagnosis → costed verdict</p>
          </div>
          {/* Persistent mini-verdict so the answer follows you across tabs */}
          <button onClick={() => setTab("decision")}
                  className="ml-auto hidden sm:block rounded px-3 py-1.5 text-xs font-bold uppercase"
                  style={{ background: verdict.diyWins ? T.diy : verdict.color, color: "white",
                           fontFamily: "'Archivo', sans-serif", letterSpacing: "0.05em" }}>
            {verdict.diyWins ? `DIY saves ${money(saving)}` : safetyForced ? "Pro required" : `Pro saves ${money(saving)}`}
          </button>
          {access?.configured && access?.is_admin && (
            <button onClick={() => setShowAdminPanel(true)}
                    className="rounded px-3 py-1.5 text-xs font-bold uppercase" style={{ background: T.amberSoft, color: T.amber }}>
              ★ Admin
            </button>
          )}
          {access?.configured && !access.is_admin && !access.unlocked && (
            <button onClick={() => setShowUnlock(true)}
                    className="rounded px-3 py-1.5 text-xs font-bold uppercase"
                    style={{ background: T.pro, color: "white", fontFamily: "'Archivo', sans-serif", letterSpacing: "0.05em" }}>
              {num(access.trial_uses_remaining) > 0
                ? `${access.trial_uses_remaining} free ${access.trial_uses_remaining === 1 ? "use" : "uses"} left`
                : "Unlock full access"}
            </button>
          )}
          {access?.configured && !access.is_admin && access?.unlocked && (
            <span className="rounded px-3 py-1.5 text-xs font-bold uppercase" style={{ background: T.diySoft, color: T.diy }}>
              ✓ Unlocked
            </span>
          )}
          <button onClick={() => setShowDonate(true)}
                  className="rounded px-3 py-1.5 text-xs font-bold uppercase border"
                  style={{ borderColor: "rgba(255,255,255,0.18)", color: "white", fontFamily: "'Archivo', sans-serif", letterSpacing: "0.05em" }}>
            ☕ Support
          </button>
        </div>
        {/* Tab bar */}
        <nav className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap gap-3"
             style={{ borderTop: `1px solid ${T.line}`, background: "rgba(11,13,16,0.6)" }}>
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-5 py-2.5 text-xs font-bold uppercase rounded-xl transition-all shadow-md hover:brightness-110 active:scale-95"
                style={{
                  fontFamily: "'Archivo', sans-serif", letterSpacing: "0.06em",
                  background: isActive ? `linear-gradient(to right, ${T.pro}, ${T.amber})` : T.inputBg,
                  color: isActive ? "#ffffff" : T.faint,
                  border: isActive ? "none" : `1px solid ${T.line}`,
                  boxShadow: isActive ? `0 4px 14px ${T.pro}33` : "none",
                }}>
                {t.label.replace("·", "•")}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        {donationBanner && (
          <div className="mb-4 rounded-lg p-3 text-sm font-semibold flex items-center justify-between"
               style={{ background: donationBanner === "success" ? T.diySoft : T.proSoft,
                        color: donationBanner === "success" ? T.diy : T.pro }}>
            <span>
              {donationBanner === "success"
                ? "Thank you — your support genuinely helps keep this tool running! ☕"
                : "Donation cancelled — no charge was made."}
            </span>
            <button onClick={() => setDonationBanner(null)} aria-label="Dismiss">✕</button>
          </div>
        )}
        {unlockBanner && (
          <div className="mb-4 rounded-lg p-3 text-sm font-semibold flex items-center justify-between"
               style={{ background: unlockBanner === "success" ? T.diySoft : T.proSoft,
                        color: unlockBanner === "success" ? T.diy : T.pro }}>
            <span>
              {unlockBanner === "success"
                ? "Unlocked! Thanks for your purchase — enjoy unlimited access. 🎉"
                : "Purchase cancelled — no charge was made."}
            </span>
            <button onClick={() => setUnlockBanner(null)} aria-label="Dismiss">✕</button>
          </div>
        )}
        {archUnlockBanner && (
          <div className="mb-4 rounded-lg p-3 text-sm font-semibold flex items-center justify-between"
               style={{ background: archUnlockBanner === "success" ? T.diySoft : T.proSoft,
                        color: archUnlockBanner === "success" ? T.diy : T.pro }}>
            <span>
              {archUnlockBanner === "success"
                ? "Design Studio unlocked! Head to tab 7 to generate a concept. 🎉"
                : "Purchase cancelled — no charge was made."}
            </span>
            <button onClick={() => setArchUnlockBanner(null)} aria-label="Dismiss">✕</button>
          </div>
        )}
        {tab === "assess" && (
          <VisualAssessor
            deviceId={deviceId} onPaywall={handlePaywall} onAccessChange={() => refreshAccess(deviceId)}
            onAnalysis={(a) => {
              setAnalysis(a);
              // Auto-configure labour from the surveyor's report
              const t = TRADES.find((x) => x.name === a.trade);
              setLabour((l) => ({ ...l, tradeId: t ? t.id : l.tradeId, dayRate: t ? t.rate : l.dayRate, days: num(a.estimatedDays) || l.days }));
              if (a.diyHours) setDiyHours(num(a.diyHours));
            }}
            onMaterials={(rows) => { if (rows.length) setMaterials(rows); setTab("materials"); }}
          />
        )}
        {tab === "materials" && (
          <MaterialEngine materials={materials} setMaterials={setMaterials}
                          tier={tier} setTier={setTier}
                          travel={travel} setTravel={setTravel} travelCost={travelCost} />
        )}
        {tab === "labour" && (
          <LabourEstimator labour={labour} setLabour={setLabour} region={region} proLabour={proLabourEstimate} />
        )}
        {tab === "decision" && (
          <DecisionMatrix diy={diy} pro={pro} verdict={verdict}
                          timeValue={timeValue} setTimeValue={setTimeValue}
                          diyHours={diyHours} setDiyHours={setDiyHours} />
        )}
        {tab === "guide" && (
          <StepByStepGuide analysis={analysis} materials={materials} trade={trade}
                            region={region} labour={labour}
                            roomDims={roomDims} setRoomDims={setRoomDims}
                            deviceId={deviceId} onPaywall={handlePaywall} onAccessChange={() => refreshAccess(deviceId)} />
        )}
        {tab === "shopping" && (
          <MaterialsToolsGuide materials={materials} tier={tier} analysis={analysis} trade={trade}
                                deviceId={deviceId} onPaywall={handlePaywall} onAccessChange={() => refreshAccess(deviceId)} />
        )}
        {tab === "design" && (
          <DesignStudio deviceId={deviceId} onPaywall={handlePaywall} onAccessChange={() => refreshAccess(deviceId)}
                        unlocked={!!(access?.architecture_unlocked || access?.is_admin)}
                        onUnlock={handleUnlockArchitecture} unlockBusy={archUnlockBusy} unlockError={archUnlockError} />
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-6 text-xs flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: T.faint }}>
        <span>Estimates only — always confirm regulated work (gas, consumer units, structural) with certified trades.</span>
        <button onClick={() => setShowFeedback(true)} className="font-semibold underline flex items-center gap-1 shrink-0" style={{ color: T.blue }}>
          <MessageSquare size={12} /> Give feedback
        </button>
        <button onClick={copyDeviceId} className="font-semibold underline flex items-center gap-1 shrink-0" style={{ color: T.blue }}>
          <Copy size={12} /> {deviceIdCopied ? "Copied!" : "Copy device ID"}
        </button>
      </footer>

      {/* Donation modal — flexible one-off "support this tool" payment via Stripe Checkout */}
      {showDonate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,33,46,0.55)" }}
             onClick={() => !donateBusy && setShowDonate(false)}>
          <div className="rounded-lg w-full max-w-sm p-5" style={{ background: T.panel }} onClick={(e) => e.stopPropagation()}>
            <Eyebrow>Support DIY vs PRO</Eyebrow>
            <p className="mt-1 text-sm" style={{ color: T.ink }}>
              This tool is free to use. If it saved you money or hassle, a small one-off donation helps cover the
              AI/photo costs and keeps it maintained.
            </p>
            <div className="mt-3 flex gap-2">
              {[3, 5, 10].map((amt) => (
                <button key={amt} onClick={() => setDonateAmount(amt)}
                        className="flex-1 rounded py-2 text-sm font-bold border"
                        style={{ borderColor: donateAmount === amt ? T.blue : T.line,
                                 background: donateAmount === amt ? "rgba(96,165,250,0.12)" : T.inputBg, color: T.ink }}>
                  {money(amt)}
                </button>
              ))}
            </div>
            <label className="block mt-3">
              <span className="block text-xs mb-1" style={{ color: T.faint }}>Or enter a custom amount</span>
              <div className="flex items-center rounded border overflow-hidden" style={{ borderColor: T.line, background: T.inputBg }}>
                <span className="px-2 text-sm" style={{ color: T.faint }}>£</span>
                <input type="number" min="1" step="1" value={donateAmount}
                       onChange={(e) => setDonateAmount(Math.max(1, num(e.target.value)))}
                       className="w-full px-2 py-1.5 text-sm outline-none" style={{ fontFamily: "'IBM Plex Mono', monospace", background: "transparent", color: T.ink }} />
              </div>
            </label>
            {donateError && <p className="mt-2 text-xs" style={{ color: T.danger }}>{donateError}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowDonate(false)} disabled={donateBusy}
                      className="flex-1 rounded py-2.5 text-sm font-bold" style={{ color: T.faint, background: T.paper }}>
                Cancel
              </button>
              <button onClick={handleDonate} disabled={donateBusy}
                      className="flex-1 rounded py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                      style={{ background: T.pro, fontFamily: "'Archivo', sans-serif" }}>
                {donateBusy ? <Loader2 size={16} className="animate-spin" /> : "☕"} Donate {money(donateAmount)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock modal — free trial exhausted, one-time payment for unlimited access */}
      {showUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,33,46,0.55)" }}
             onClick={() => !unlockBusy && setShowUnlock(false)}>
          <div className="rounded-lg w-full max-w-sm p-5" style={{ background: T.panel }} onClick={(e) => e.stopPropagation()}>
            <Eyebrow color={T.pro}>Free trial used up</Eyebrow>
            <p className="mt-1 text-sm" style={{ color: T.ink }}>
              You've used your {FREE_TRIAL_USES_DISPLAY} free AI look-ups (photo analysis, guides, and material
              lookups). Unlock unlimited access with a one-time payment — no subscription, no recurring charge.
            </p>
            <div className="mt-3 rounded-lg border p-3 flex items-center justify-between" style={{ borderColor: T.line, background: T.paper }}>
              <span className="text-sm font-semibold" style={{ color: T.ink }}>Unlock unlimited access</span>
              <span className="text-lg font-black" style={{ color: T.pro, fontFamily: "'Archivo', sans-serif" }}>
                {money(UNLOCK_PRICE_DISPLAY)}
              </span>
            </div>
            {unlockError && <p className="mt-2 text-xs" style={{ color: T.danger }}>{unlockError}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowUnlock(false)} disabled={unlockBusy}
                      className="flex-1 rounded py-2.5 text-sm font-bold" style={{ color: T.faint, background: T.paper }}>
                Not now
              </button>
              <button onClick={handleUnlock} disabled={unlockBusy}
                      className="flex-1 rounded py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                      style={{ background: T.pro, fontFamily: "'Archivo', sans-serif" }}>
                {unlockBusy ? <Loader2 size={16} className="animate-spin" /> : "🔓"} Unlock {money(UNLOCK_PRICE_DISPLAY)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin panel — look up any device's access state, grant/revoke admin,
          main-unlock, or Design Studio unlock. Only reachable via the header
          badge, which only renders for devices that are already admins. */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,33,46,0.55)" }}
             onClick={() => !adminBusy && setShowAdminPanel(false)}>
          <div className="rounded-lg w-full max-w-md p-5" style={{ background: T.panel }} onClick={(e) => e.stopPropagation()}>
            <Eyebrow color={T.amber}>Admin panel</Eyebrow>
            <p className="mt-1 text-xs" style={{ color: T.faint }}>
              Your device ID: <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.ink }}>{deviceId}</span>
            </p>

            <label className="block mt-3">
              <span className="block text-xs mb-1" style={{ color: T.faint }}>Target device ID</span>
              <input value={adminTargetId} onChange={(e) => setAdminTargetId(e.target.value)}
                     placeholder="paste a device's diyvspro_device_id"
                     className="w-full rounded border px-2 py-1.5 text-sm outline-none"
                     style={{ borderColor: T.line, background: T.inputBg, color: T.ink, fontFamily: "'IBM Plex Mono', monospace" }} />
            </label>

            <button onClick={() => adminAction("lookup")} disabled={adminBusy}
                    className="mt-2 rounded py-1.5 px-3 text-xs font-bold disabled:opacity-40"
                    style={{ background: T.inputBg, color: T.ink, border: `1px solid ${T.line}` }}>
              Look up
            </button>

            {adminLookup && (
              <div className="mt-3 rounded-lg border p-3 text-xs space-y-1" style={{ borderColor: T.line, background: T.paper, color: T.ink }}>
                <p>Trial uses remaining: <b>{adminLookup.trial_uses_remaining ?? "—"}</b></p>
                <p>Main unlock: <b style={{ color: adminLookup.unlocked ? T.diy : T.faint }}>{adminLookup.unlocked ? "unlocked" : "not unlocked"}</b></p>
                <p>Design Studio: <b style={{ color: adminLookup.architecture_unlocked ? T.diy : T.faint }}>{adminLookup.architecture_unlocked ? "unlocked" : "not unlocked"}</b></p>
                <p>Admin: <b style={{ color: adminLookup.is_admin ? T.amber : T.faint }}>{adminLookup.is_admin ? "yes" : "no"}</b></p>
              </div>
            )}

            {adminError && <p className="mt-2 text-xs" style={{ color: T.danger }}>{adminError}</p>}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => adminAction("grantUnlock")} disabled={adminBusy}
                      className="rounded py-2 text-xs font-bold disabled:opacity-40" style={{ background: T.diySoft, color: T.diy }}>
                Grant unlock
              </button>
              <button onClick={() => adminAction("revokeUnlock")} disabled={adminBusy}
                      className="rounded py-2 text-xs font-bold disabled:opacity-40" style={{ background: T.inputBg, color: T.faint }}>
                Revoke unlock
              </button>
              <button onClick={() => adminAction("grantArchitecture")} disabled={adminBusy}
                      className="rounded py-2 text-xs font-bold disabled:opacity-40" style={{ background: T.diySoft, color: T.diy }}>
                Grant Design Studio
              </button>
              <button onClick={() => adminAction("revokeArchitecture")} disabled={adminBusy}
                      className="rounded py-2 text-xs font-bold disabled:opacity-40" style={{ background: T.inputBg, color: T.faint }}>
                Revoke Design Studio
              </button>
              <button onClick={() => adminAction("grantAdmin")} disabled={adminBusy}
                      className="rounded py-2 text-xs font-bold disabled:opacity-40" style={{ background: T.amberSoft, color: T.amber }}>
                Grant admin
              </button>
              <button onClick={() => adminAction("revokeAdmin")} disabled={adminBusy}
                      className="rounded py-2 text-xs font-bold disabled:opacity-40" style={{ background: T.dangerSoft, color: T.danger }}>
                Revoke admin
              </button>
            </div>

            <button onClick={() => setShowAdminPanel(false)} disabled={adminBusy}
                    className="mt-4 w-full rounded py-2.5 text-sm font-bold" style={{ color: T.faint, background: T.paper }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Feedback modal — ease-of-use rating + free-text improvements/comments, stored in Postgres */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,33,46,0.55)" }}
             onClick={() => !feedbackBusy && closeFeedback()}>
          <div className="rounded-lg w-full max-w-sm p-5" style={{ background: T.panel }} onClick={(e) => e.stopPropagation()}>
            {feedbackSent ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} style={{ color: T.diy }} />
                  <Eyebrow color={T.diy}>Thank you!</Eyebrow>
                </div>
                <p className="mt-2 text-sm" style={{ color: T.ink }}>Your feedback helps make this tool better for the next person.</p>
                <button onClick={closeFeedback} className="mt-4 w-full rounded py-2.5 text-sm font-bold text-white"
                        style={{ background: T.blue, fontFamily: "'Archivo', sans-serif" }}>
                  Close
                </button>
              </>
            ) : (
              <>
                <Eyebrow>Give feedback</Eyebrow>
                <p className="mt-1 text-sm" style={{ color: T.ink }}>How did using DIY vs PRO go?</p>

                <p className="block text-xs mt-3 mb-1" style={{ color: T.faint }}>How easy was it to use?</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setFeedbackEase(n)} aria-label={`${n} out of 5`}>
                      <Star size={26} fill={n <= feedbackEase ? T.pro : "none"} style={{ color: T.pro }} />
                    </button>
                  ))}
                </div>

                <label className="block mt-3">
                  <span className="block text-xs mb-1" style={{ color: T.faint }}>What could we improve?</span>
                  <textarea value={feedbackImprovements} onChange={(e) => setFeedbackImprovements(e.target.value)}
                            rows={2} className="w-full rounded border px-2 py-1.5 text-sm outline-none" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }} />
                </label>

                <label className="block mt-3">
                  <span className="block text-xs mb-1" style={{ color: T.faint }}>Additional comments</span>
                  <textarea value={feedbackComments} onChange={(e) => setFeedbackComments(e.target.value)}
                            rows={2} className="w-full rounded border px-2 py-1.5 text-sm outline-none" style={{ borderColor: T.line, background: T.inputBg, color: T.ink }} />
                </label>

                {feedbackError && <p className="mt-2 text-xs" style={{ color: T.danger }}>{feedbackError}</p>}

                <div className="mt-4 flex gap-2">
                  <button onClick={closeFeedback} disabled={feedbackBusy}
                          className="flex-1 rounded py-2.5 text-sm font-bold" style={{ color: T.faint, background: T.paper }}>
                    Cancel
                  </button>
                  <button onClick={handleFeedback} disabled={feedbackBusy}
                          className="flex-1 rounded py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                          style={{ background: T.blue, fontFamily: "'Archivo', sans-serif" }}>
                    {feedbackBusy ? <Loader2 size={16} className="animate-spin" /> : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

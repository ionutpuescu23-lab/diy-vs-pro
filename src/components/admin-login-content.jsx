"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

// Matches the hex values used by the dashboard's dark theme and the other
// standalone pages — kept self-contained per this codebase's existing
// convention of not sharing style tokens across standalone pages.
const C = {
  bg: "#0B0D10",
  ink: "#F1F5F9",
  faint: "#94A3B8",
  line: "rgba(255,255,255,0.09)",
  blue: "#60A5FA",
  diy: "#34D399",
  diySoft: "rgba(52,211,153,0.14)",
  panel: "rgba(24,26,32,0.78)",
  inputBg: "#1C2027",
  danger: "#F87171",
};

// Grants admin on THIS browser's device without needing to manually copy the
// device ID and curl /api/admin/grant with the secret header — reads the
// same localStorage key the main app uses, so once granted here the app's
// existing "★ Admin" badge / admin panel just work.
export default function AdminLoginContent() {
  const [deviceId, setDeviceId] = useState(null);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let id = window.localStorage.getItem("diyvspro_device_id");
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem("diyvspro_device_id", id); }
    setDeviceId(id);
  }, []);

  const submit = async () => {
    if (!secret.trim() || !deviceId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret.trim() },
        body: JSON.stringify({ deviceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Incorrect admin password." : (data.error || "Login failed"));
      setDone(true);
      setTimeout(() => { window.location.href = "/"; }, 1200);
    } catch (e) {
      setError(e.message || "Login failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ background: C.bg, color: C.ink, minHeight: "100vh" }}
          className="px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border p-5" style={{ borderColor: C.line, background: C.panel }}>
        <h1 className="text-lg font-black uppercase tracking-wide">Admin login</h1>
        <p className="text-xs mt-1 mb-4" style={{ color: C.faint }}>
          Grants admin on this browser only — no device ID copying needed.
        </p>

        {done ? (
          <p className="text-sm" style={{ color: C.diy }}>✓ Admin granted — redirecting…</p>
        ) : (
          <>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Admin password"
              autoFocus
              className="w-full rounded border px-2 py-1.5 text-sm outline-none"
              style={{ borderColor: C.line, background: C.inputBg, color: C.ink }}
            />
            {error && <p className="mt-2 text-xs" style={{ color: C.danger }}>{error}</p>}
            <button onClick={submit} disabled={busy || !secret.trim() || !deviceId}
                    className="mt-3 w-full rounded py-2.5 text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: C.blue }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? "Checking…" : "Log in"}
            </button>
          </>
        )}

        <a href="/" className="block mt-4 text-xs underline text-center" style={{ color: C.faint }}>← Back to DIY vs PRO</a>
      </div>
    </main>
  );
}

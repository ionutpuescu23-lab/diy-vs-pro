"use client";

import { useEffect, useState } from "react";

// Self-contained styling (not the dashboard's T tokens) — same convention
// as the other standalone pieces (refund/terms/privacy/pricing) since this
// renders from the root layout, outside the dashboard component.
const C = {
  panel: "rgba(24,26,32,0.96)",
  ink: "#F1F5F9",
  faint: "#94A3B8",
  line: "rgba(255,255,255,0.09)",
  blue: "#60A5FA",
};

const DISMISS_KEY = "diyvspro_install_dismissed_at";
const DISMISS_DAYS = 14; // re-offer after this long rather than nagging every visit forever

// Captures the browser's `beforeinstallprompt` event (Chrome/Edge/Android)
// and surfaces a custom "Install" banner, since modern Chrome no longer
// shows its own install UI automatically — you have to call .prompt()
// yourself in response to a user gesture. iOS Safari has no such event at
// all (Add to Home Screen is manual-only there), so it gets instructions
// instead of an Install button.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    const dismissedRecently = dismissedAt && (Date.now() - dismissedAt) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    if (dismissedRecently) return;

    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isStandalone) return; // already installed/running as an app

    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

    if (iOS && isSafari) {
      setIsIOS(true);
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }

    const handlePrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setVisible(true), 1000);
    };
    const handleInstalled = () => { setVisible(false); setDeferredPrompt(null); };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4" style={{ pointerEvents: "none" }}>
      <div className="w-full max-w-sm rounded-xl border shadow-xl p-4"
           style={{ background: C.panel, borderColor: C.line, pointerEvents: "auto" }}>
        <p className="text-sm font-bold" style={{ color: C.ink }}>Install DIY vs PRO</p>
        {isIOS ? (
          <p className="text-xs mt-1" style={{ color: C.faint }}>
            Tap <b>Share</b>, then <b>Add to Home Screen</b>, for the full-screen app experience.
          </p>
        ) : (
          <p className="text-xs mt-1" style={{ color: C.faint }}>
            Add it to your home screen for quick, full-screen access — no app store needed.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {!isIOS && (
            <button onClick={install}
                    className="rounded px-3 py-1.5 text-xs font-bold text-white"
                    style={{ background: C.blue }}>
              Install
            </button>
          )}
          <button onClick={dismiss}
                  className="rounded px-3 py-1.5 text-xs font-bold"
                  style={{ color: C.faint, background: "transparent" }}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

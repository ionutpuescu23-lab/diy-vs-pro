"use client";

import { useEffect } from "react";

// Registers the PWA service worker. Fails silently (e.g. in dev over http
// on a non-localhost host, or unsupported browsers) since it's purely
// progressive enhancement — the app works fully without it.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

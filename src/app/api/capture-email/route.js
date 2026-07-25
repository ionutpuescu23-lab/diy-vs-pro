// src/app/api/capture-email/route.js
// Optional lead-gen step — a device that provides an email gets the FREE
// tier's monthly cap raised from 1 to 5. Not an account: no password, no
// login, no verification email (no email-sending infrastructure exists in
// this app). Format-validated only.
import { captureEmail, getAccessState } from "@/lib/access";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    const { deviceId, email } = await request.json();
    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
    }
    if (!EMAIL_RE.test((email || "").trim())) {
      return Response.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const result = await captureEmail(deviceId, email.trim());
    if (!result.ok) {
      return Response.json({ error: "Couldn't save that right now — try again" }, { status: 500 });
    }

    const state = await getAccessState(deviceId);
    return Response.json(state);
  } catch (err) {
    console.error("Capture-email route failed:", err);
    return Response.json({ error: "Couldn't save that right now — try again" }, { status: 500 });
  }
}

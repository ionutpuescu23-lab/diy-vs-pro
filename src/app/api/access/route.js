// src/app/api/access/route.js
// Read-only check: does this device still have free trial uses, or is it unlocked?
// Does not consume a use — the AI routes themselves call consumeAccess().
import { getAccessState } from "@/lib/access";

export async function GET(request) {
  const deviceId = new URL(request.url).searchParams.get("deviceId");
  if (!deviceId) return Response.json({ error: "Missing deviceId" }, { status: 400 });

  const state = await getAccessState(deviceId);
  return Response.json(state);
}

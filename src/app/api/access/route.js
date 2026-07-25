// src/app/api/access/route.js
// Read-only check: what tier is this device on, and how many free monthly
// diagnoses does it have left? Never mutates — the estimate route itself
// calls checkEstimateGate()/recordEstimateUse().
import { getAccessState } from "@/lib/access";

export async function GET(request) {
  const deviceId = new URL(request.url).searchParams.get("deviceId");
  if (!deviceId) return Response.json({ error: "Missing deviceId" }, { status: 400 });

  const state = await getAccessState(deviceId);
  return Response.json(state);
}

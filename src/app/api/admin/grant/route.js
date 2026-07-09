// src/app/api/admin/grant/route.js
// Sets/clears the is_admin flag on a device_access row. There's no login
// system in this app, so this is the only way to grant admin — gated on a
// server-only secret (ADMIN_SECRET) that must never be exposed client-side.
// Intended for one-off use by the site owner (e.g. via curl), not a UI flow.
import { setAdminFlag } from "@/lib/access";

export async function POST(request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ error: "Admin granting isn't configured (missing ADMIN_SECRET)" }, { status: 500 });
  }

  const providedSecret = request.headers.get("x-admin-secret");
  if (providedSecret !== adminSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deviceId, isAdmin = true } = await request.json();
  if (!deviceId) {
    return Response.json({ error: "Missing deviceId" }, { status: 400 });
  }

  const result = await setAdminFlag(deviceId, !!isAdmin);
  if (!result.ok) {
    return Response.json({ error: "Admin storage isn't configured yet" }, { status: 500 });
  }
  return Response.json(result.state);
}

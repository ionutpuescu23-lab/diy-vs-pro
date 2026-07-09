// src/app/api/admin/manage/route.js
// Powers the in-app admin panel: look up any device's access state, or
// grant/revoke admin, main-unlock, or Design Studio access for it.
//
// Authorization is NOT a secret header (that's /api/admin/grant's job, used
// once to bootstrap the first admin) — it's a fresh server-side check that
// the CALLING device is currently is_admin in the DB. This is safe to call
// from the browser because the check can't be spoofed client-side: we look
// up callerDeviceId ourselves rather than trusting any flag the client sends.
import { isDeviceAdmin, getAccessState, setAdminFlag, setUnlockedFlag, setArchitectureFlag } from "@/lib/access";

const ACTIONS = {
  grantAdmin: (id) => setAdminFlag(id, true),
  revokeAdmin: (id) => setAdminFlag(id, false),
  grantUnlock: (id) => setUnlockedFlag(id, true),
  revokeUnlock: (id) => setUnlockedFlag(id, false),
  grantArchitecture: (id) => setArchitectureFlag(id, true),
  revokeArchitecture: (id) => setArchitectureFlag(id, false),
};

export async function POST(request) {
  try {
    const { callerDeviceId, targetDeviceId, action } = await request.json();
    if (!callerDeviceId || !targetDeviceId || !action) {
      return Response.json({ error: "Missing callerDeviceId, targetDeviceId, or action" }, { status: 400 });
    }

    const callerIsAdmin = await isDeviceAdmin(callerDeviceId);
    if (!callerIsAdmin) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (action === "lookup") {
      const state = await getAccessState(targetDeviceId);
      return Response.json(state);
    }

    const handler = ACTIONS[action];
    if (!handler) {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    const result = await handler(targetDeviceId);
    if (!result.ok) {
      return Response.json({ error: "Admin storage isn't configured yet" }, { status: 500 });
    }
    return Response.json(result.state);
  } catch (err) {
    console.error("Admin manage route failed:", err);
    return Response.json({ error: "Admin action failed", detail: String(err.message || err) }, { status: 500 });
  }
}

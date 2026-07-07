// src/app/api/design-mockup/route.js
// Generates a "what it could look like fixed" mockup by editing the user's
// own uploaded photo via OpenAI's image-edit endpoint (gpt-image-1). Costs
// real money per call (unlike Claude's per-token pricing), so this defaults
// to "low" quality to keep per-generation cost down — it's a bonus visual,
// not a core feature.
import { consumeAccess } from "@/lib/access";

export async function POST(request) {
  try {
    const { imageData, mediaType, issue, rootCause, deviceId } = await request.json();

    if (!imageData) {
      return Response.json({ error: "No photo provided" }, { status: 400 });
    }

    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
    }
    const access = await consumeAccess(deviceId);
    if (!access.allowed) {
      return Response.json({ error: "Free trial used up", paywall: true, state: access.state }, { status: 402 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Design mockup isn't configured yet (missing OPENAI_API_KEY)" }, { status: 500 });
    }

    const prompt = `Photorealistic edit of this UK home photo: show the exact same room/wall/area after the following issue has been professionally repaired and finished: "${issue || "the visible damage"}"${rootCause ? ` (root cause: ${rootCause})` : ""}. Keep the same camera angle, framing, lighting, and room layout — only change what's needed to show it fully repaired, clean, and freshly finished (e.g. replastered and repainted, resealed, re-pointed). Do not add furniture, people, or decor that weren't in the original photo.`;

    const buffer = Buffer.from(imageData, "base64");
    const blob = new Blob([buffer], { type: mediaType || "image/png" });

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("image", blob, "photo.png");
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("quality", "low");

    const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!openaiRes.ok) {
      const detail = await openaiRes.text();
      return Response.json({ error: `OpenAI API error ${openaiRes.status}`, detail }, { status: 502 });
    }

    const data = await openaiRes.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      return Response.json({ error: "No image returned from OpenAI" }, { status: 502 });
    }

    return Response.json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("Design mockup route failed:", err);
    return Response.json(
      { error: "Mockup generation failed", detail: String(err.message || err) },
      { status: 500 }
    );
  }
}

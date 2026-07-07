// src/app/api/measure-room/route.js
// Estimates room/wall dimensions from a photo containing a common reference
// object of known real-world size (A4 sheet or a credit/debit card). This is
// a rough estimate (perspective, camera angle, and framing all affect
// accuracy) — not a substitute for a tape measure — so the response always
// carries a confidence level and caveats for the UI to surface honestly.
import { consumeAccess } from "@/lib/access";

const REFERENCE_SIZES = {
  a4: "an A4 sheet of paper (210mm x 297mm)",
  card: "a credit/debit card (85.6mm x 54mm, ISO ID-1 size)",
};

export async function POST(request) {
  try {
    const { imageData, mediaType, referenceObject, deviceId } = await request.json();

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

    const refDesc = REFERENCE_SIZES[referenceObject] || REFERENCE_SIZES.a4;

    const prompt = `You are helping a DIYer estimate room dimensions from a single photo for material-quantity planning (not precision building work).

The photo contains ${refDesc} held or placed flat against a wall/floor, visible in frame. Using the known real-world size of that reference object and its apparent size/perspective in the photo, estimate the width and height in metres of the wall (or floor area) shown.

Respond with ONLY a raw JSON object (no markdown, no backticks):
{
 "widthM": number (estimated width in metres),
 "heightM": number (estimated height in metres),
 "confidence": "low" | "medium" | "high",
 "notes": "1-2 sentences: how you derived it, and any caveats (e.g. angle, partial reference object, distance distortion)"
}

Be honest about confidence — if the reference object is small in frame, at an angle, or partially obscured, say so and mark confidence "low". This is for rough material-quantity estimation, not exact measurement.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageData } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      return Response.json({ error: `Anthropic API error ${anthropicRes.status}`, detail }, { status: 502 });
    }

    const data = await anthropicRes.json();
    const text = (data.content || []).map((b) => b.text || "").join("\n");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return Response.json(parsed);
  } catch (err) {
    console.error("Measure-room route failed:", err);
    return Response.json(
      { error: "Room measurement failed", detail: String(err.message || err) },
      { status: 500 }
    );
  }
}

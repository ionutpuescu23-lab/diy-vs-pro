// src/app/api/estimate/route.js
// App Router rule: folder = URL, file MUST be named route.js,
// and the export MUST be named after the HTTP method (POST).
import { consumeAccess } from "@/lib/access";

// Claude vision analysis can run long — extend past the platform default timeout.
export const maxDuration = 60;

export async function POST(request) {
  try {
    // Frontend sends: { imageData?: <base64 string>, mediaType?: "image/jpeg", description?: string, deviceId }
    // At least one of imageData / description must be present.
    const { imageData, mediaType, description, deviceId } = await request.json();

    if (!imageData && !(description || "").trim()) {
      return Response.json({ error: "Provide a photo, a description, or both" }, { status: 400 });
    }

    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
    }
    const access = await consumeAccess(deviceId);
    if (!access.allowed) {
      return Response.json({ error: "Free trial used up", paywall: true, state: access.state }, { status: 402 });
    }

    const instructions = imageData && description
      ? `You are a UK building surveyor. Analyse this photo of a property/garden issue, using the homeowner's own description below for extra context (symptoms, timing, what they've already noticed).\n\nHomeowner's description: "${description}"`
      : imageData
      ? `You are a UK building surveyor. Analyse this photo of a property/garden issue.`
      : `You are a UK building surveyor. A homeowner has described a property/garden issue but has not provided a photo. Diagnose it as best you can from the description alone, and be appropriately more cautious/conservative given the lack of visual confirmation.\n\nHomeowner's description: "${description}"`;

    const content = [];
    if (imageData) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageData },
      });
    }
    content.push({
      type: "text",
      text: `${instructions}
Respond with ONLY a raw JSON object (no markdown, no backticks) with exactly these keys:
{
 "issue": "short name of the physical problem",
 "rootCause": "1-2 sentence likely root cause",
 "severity": "low" | "medium" | "high",
 "regulated": true if this needs a certified trade (gas, consumer-unit electrics, structural) else false,
 "trade": one of ["General Builder","Bricklayer","Plasterer","Groundworker","Landscaper","Roofer","Damp Specialist","Electrician (Part P)","Gas Engineer (Gas Safe)"],
 "estimatedDays": number,
 "diyHours": number,
 "steps": ["5-8 concise DIY fixing steps"],
 "materials": [{"name": "...", "qty": number, "unit": "bag|tub|roll|m2|litre|each", "budget": number, "high": number}]
}`,
    });

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY, // server-side only, no NEXT_PUBLIC_
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        messages: [{ role: "user", content }],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      return Response.json(
        { error: `Anthropic API error ${anthropicRes.status}`, detail },
        { status: 502 }
      );
    }

    const data = await anthropicRes.json();
    const text = (data.content || [])
      .map((block) => block.text || "")
      .join("\n");

    // Strip accidental markdown fences, then parse the surveyor JSON
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return Response.json(parsed); // 200, clean JSON back to the browser
  } catch (err) {
    console.error("Estimate route failed:", err);
    return Response.json(
      { error: "Analysis failed", detail: String(err.message || err) },
      { status: 500 }
    );
  }
}

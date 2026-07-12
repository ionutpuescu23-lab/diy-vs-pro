// src/app/api/design-engine/route.js
// Design Studio: takes a photo of the user's own room or garden and returns
// both an early-concept redesign spec (Claude) and an edited "what it could
// look like" render of that same photo (OpenAI images/edits — grounded in
// the real space, not a from-scratch generation).
import { checkArchitectureAccess } from "@/lib/access";

// Chains a Claude call and an OpenAI image-edit call — comfortably past most
// platform default timeouts, hence the explicit bump.
export const maxDuration = 60;

const STYLE_BRIEFS = {
  modern: "contemporary minimalist style: clean lines, neutral palette (white/grey/charcoal), natural light, uncluttered surfaces, exposed timber or steel accents",
  futuristic: "futuristic style: sweeping curved forms, dark metallic and glass finishes, integrated ambient lighting, minimal visible ornamentation",
  classic: "classic traditional British style: warm natural materials (brick, stone, painted timber), symmetrical proportions, period-appropriate detailing",
  oriental: "East Asian-influenced style: natural timber and stone, low clean lines, layered planting, a sense of calm and balance",
};

const SCOPE_BRIEFS = {
  room: {
    subject: "interior room",
    editInstruction: "redesign it — new surfaces, fixtures, furniture, lighting and finishes — while keeping the same camera angle, room dimensions, and window/door positions. Do not add or remove structural openings.",
    specSubject: "an interior room redesign",
  },
  landscape: {
    subject: "garden or outdoor space",
    editInstruction: "redesign the planting, hardscaping (patio/decking/paths) and outdoor features, while keeping the same camera angle and boundary lines.",
    specSubject: "a garden/outdoor space redesign",
  },
};

export async function POST(request) {
  try {
    const { scope, imageData, mediaType, style, notes, deviceId } = await request.json();

    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
    }
    if (!imageData) {
      return Response.json({ error: "Please upload a photo of the room or garden" }, { status: 400 });
    }
    const access = await checkArchitectureAccess(deviceId);
    if (!access.allowed) {
      return Response.json({ error: "Design Studio isn't unlocked yet", paywall: true, architecturePaywall: true, state: access.state }, { status: 402 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!anthropicKey || !openaiKey) {
      return Response.json({ error: "Design Studio isn't configured yet (missing ANTHROPIC_API_KEY or OPENAI_API_KEY)" }, { status: 500 });
    }

    const scopeBrief = SCOPE_BRIEFS[scope] || SCOPE_BRIEFS.room;
    const styleBrief = STYLE_BRIEFS[style] || STYLE_BRIEFS.modern;

    const specPrompt = `You are a UK chartered designer producing an early-concept redesign brief (concept level — not construction drawings) for ${scopeBrief.specSubject}, based on a photo the client uploaded.

Style direction: ${styleBrief}
Additional client notes: ${notes || "none"}

Respond with ONLY a raw JSON object (no markdown, no backticks) matching EXACTLY this schema:
{
 "overview": "2-3 sentence summary of the redesign concept, referencing what's visible in the photo",
 "keyChanges": ["short bullet describing a specific proposed change", "..."],
 "structuralNotes": ["any structural/construction considerations this redesign would involve — e.g. load-bearing wall if removing a wall, decking foundation depth, drainage/damp-proofing for planting beds near the house. Empty array if none."],
 "materials": {"primary": "main material(s) for surfaces/hard landscaping", "secondary": "secondary material(s)", "features": "key fixtures/features (e.g. lighting, planting, furniture)"},
 "regulatoryNotes": [{"reference": "e.g. Building Regulations Part A (Structure), Permitted Development limits, Party Wall Act", "why": "why it applies here, at a high level"}],
 "estimatedCostGBP": {"low": number, "high": number, "basis": "1 sentence on what UK cost range this is based on"}
}

Ground estimates in realistic current UK costs for this style/scope. Keep everything concise and concept-level. If nothing structural is involved, return an empty structuralNotes array rather than inventing concerns.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageData } },
            { type: "text", text: specPrompt },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      return Response.json({ error: `Anthropic API error ${anthropicRes.status}`, detail }, { status: 502 });
    }

    const anthropicData = await anthropicRes.json();
    const text = (anthropicData.content || []).map((b) => b.text || "").join("\n");
    const spec = JSON.parse(text.replace(/```json|```/g, "").trim());

    const imagePrompt = `Photorealistic edit of this ${scopeBrief.subject} photo: ${scopeBrief.editInstruction} Style: ${styleBrief}. ${notes ? `Additional detail: ${notes}.` : ""} Keep it looking like a realistic photo of the same real space, not a stylised illustration. No people, no text, no watermarks.`;

    const buffer = Buffer.from(imageData, "base64");
    const blob = new Blob([buffer], { type: mediaType || "image/png" });

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("image", blob, "photo.png");
    form.append("prompt", imagePrompt);
    form.append("size", "1536x1024");
    form.append("quality", "medium");

    const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });

    if (!openaiRes.ok) {
      const detail = await openaiRes.text();
      return Response.json({ error: `OpenAI API error ${openaiRes.status}`, detail, spec }, { status: 502 });
    }

    const openaiData = await openaiRes.json();
    const b64 = openaiData.data?.[0]?.b64_json;
    if (!b64) {
      return Response.json({ error: "No image returned from OpenAI", spec }, { status: 502 });
    }

    return Response.json({ spec, image: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("Design engine route failed:", err);
    return Response.json(
      { error: "Design generation failed", detail: String(err.message || err) },
      { status: 500 }
    );
  }
}

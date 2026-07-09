// src/app/api/design-engine/route.js
// Architecture Design Engine: takes a house shape/size/style brief and returns
// both a structural text spec (Claude) and a generated concept render (OpenAI
// images/generations — there's no source photo here, so this is a from-scratch
// generation, not an edit).
import { checkArchitectureAccess } from "@/lib/access";

// This route chains a Claude call and an OpenAI image-generation call —
// comfortably past most platform default timeouts, hence the explicit bump.
export const maxDuration = 60;

const STYLE_BRIEFS = {
  modern: "contemporary minimalist architecture: clean flat/low-pitched rooflines, large glazed openings, rendered or fibre-cement cladding, neutral palette (white/grey/charcoal), exposed structural steel or timber accents",
  futuristic: "futuristic parametric architecture: sweeping curved forms, cantilevered volumes, floor-to-ceiling glass, dark metallic and glass cladding, integrated photovoltaic surfaces, minimal visible ornamentation",
  classic: "classic traditional British architecture: pitched slate or tile roof, brick or natural stone facade, sash windows, symmetrical proportions, painted timber trim, a covered entrance porch",
  oriental: "East Asian-influenced architecture: layered low-pitched roofs with upturned eaves, dark timber post-and-beam framing, deep covered verandas, natural stone and wood materials, a landscaped courtyard",
};

const SHAPE_BRIEFS = {
  rectangular: "a simple rectangular single-block footprint",
  "l-shape": "an L-shaped footprint wrapping around a side garden or courtyard",
  "u-shape": "a U-shaped footprint enclosing a central courtyard",
  split_level: "a split-level footprint stepping with the site's slope",
};

export async function POST(request) {
  try {
    const { shape, sizeM2, storeys, style, notes, deviceId } = await request.json();

    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
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

    const shapeBrief = SHAPE_BRIEFS[shape] || SHAPE_BRIEFS.rectangular;
    const styleBrief = STYLE_BRIEFS[style] || STYLE_BRIEFS.modern;
    const floorArea = parseFloat(sizeM2) || 120;
    const numStoreys = parseInt(storeys, 10) || 1;

    const specPrompt = `You are a UK chartered architect producing an early-concept design brief (RIBA Stage 1 level — not construction drawings).

Produce a structural/architectural concept spec for a new house with:
- Footprint shape: ${shapeBrief}
- Total floor area: approximately ${floorArea} m²
- Storeys: ${numStoreys}
- Style direction: ${styleBrief}
- Additional client notes: ${notes || "none"}

Respond with ONLY a raw JSON object (no markdown, no backticks) matching EXACTLY this schema:
{
 "overview": "2-3 sentence summary of the design concept",
 "footprint": {"shape": "name", "approxDimensions": "e.g. 14m x 9m", "orientation": "suggested orientation and why"},
 "storeys": [
   {"level": "e.g. Ground Floor", "approxAreaM2": number, "rooms": ["room name", "..."]}
 ],
 "structure": {
   "foundationType": "suitable foundation type and why",
   "primaryStructure": "e.g. masonry cavity wall / timber frame / steel frame, and why it suits this style and size",
   "roofType": "roof form and covering material"
 },
 "materials": {
   "facade": "primary external material(s)",
   "roof": "roof material",
   "glazing": "glazing approach"
 },
 "sustainability": ["1-2 sentence sustainability/efficiency features suited to this design"],
 "regulatoryNotes": ["UK Building Regulations parts likely engaged (e.g. Part A structure, Part L efficiency, Part Q security) and why, at a high level — not exhaustive"],
 "estimatedBuildCostGBP": {"low": number, "high": number, "basis": "1 sentence on what UK self-build cost/m² range this is based on"}
}

Ground estimates in realistic current UK self-build costs per m² for this style/spec tier. Keep everything concise and concept-level.`;

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
        messages: [{ role: "user", content: specPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      return Response.json({ error: `Anthropic API error ${anthropicRes.status}`, detail }, { status: 502 });
    }

    const anthropicData = await anthropicRes.json();
    const text = (anthropicData.content || []).map((b) => b.text || "").join("\n");
    const spec = JSON.parse(text.replace(/```json|```/g, "").trim());

    const imagePrompt = `Photorealistic architectural exterior render of a new-build house, ${shapeBrief}, ${numStoreys} storey${numStoreys > 1 ? "s" : ""}, approximately ${floorArea} m² total floor area. Style: ${styleBrief}. Daytime, clear sky, professional architectural visualisation, wide exterior three-quarter view, landscaped surroundings. ${notes ? `Additional detail: ${notes}.` : ""} No people, no text, no watermarks.`;

    const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: imagePrompt,
        size: "1536x1024",
        quality: "medium",
      }),
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

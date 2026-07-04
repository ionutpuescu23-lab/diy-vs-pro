// src/app/api/estimate/route.js
// App Router rule: folder = URL, file MUST be named route.js,
// and the export MUST be named after the HTTP method (POST).

export async function POST(request) {
  try {
    // Frontend sends: { imageData: <base64 string>, mediaType: "image/jpeg" }
    const { imageData, mediaType } = await request.json();

    if (!imageData) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

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
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageData,
                },
              },
              {
                type: "text",
                text: `You are a UK building surveyor. Analyse this photo of a property/garden issue.
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
              },
            ],
          },
        ],
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

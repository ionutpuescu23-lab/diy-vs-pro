// src/app/api/shopping-guide/route.js
// Generates: (1) a plain-English quality note per material explaining what the
// retail-vs-trade price gap actually buys, and (2) a tools-needed list with a
// buy-vs-rent recommendation. No product photos or business names are involved
// here — just pricing/quality guidance, so it's safe for Claude to generate directly.
import { consumeAccess } from "@/lib/access";

export async function POST(request) {
  try {
    const { issue, trade, materials, deviceId } = await request.json();

    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
    }
    const access = await consumeAccess(deviceId);
    if (!access.allowed) {
      return Response.json({ error: "Free trial used up", paywall: true, state: access.state }, { status: 402 });
    }

    const materialList = (materials || [])
      .map((m) => `${m.name} (qty ${m.qty} ${m.unit}, trade £${m.budget} / retail £${m.high})`)
      .join("; ") || "none listed";

    const prompt = `You are a UK builders' merchant advisor helping a complete DIY beginner shop smart for a repair job. Assume they may not know what a tool even looks like or does — keep every explanation plain and jargon-free.

For the job and materials below, produce:
1. A quality-comparison note for EACH material listed, explaining what the retail price premium actually buys (or doesn't), PLUS a separate one-sentence "when to use which" rule of thumb (e.g. "use the cheaper trade option for a quick dry patch; pay for the retail one if humidity in the room is high").
2. A practical list of tools needed to complete this job (max 6), each with: a realistic UK budget-buy price + a typical budget retailer name, a pro-grade buy price + a typical trade merchant name, a one-sentence explanation of why the price difference matters (what you actually get for the extra money), a typical tool-hire price per day (or null if it isn't normally hired), and a buy-vs-rent recommendation with a one-sentence reason.

Respond with ONLY a raw JSON object (no markdown, no backticks) matching EXACTLY this schema:
{
 "materialNotes": [ { "name": "must exactly match one of the material names given", "qualityNote": "1-2 sentences comparing trade vs retail quality", "whenToUse": "1 sentence rule of thumb for picking budget vs retail", "budgetSupplier": "typical UK trade counter, e.g. Selco/Jewson/Screwfix Trade", "highSupplier": "typical UK DIY retailer, e.g. B&Q/Wickes/Travis Perkins" } ],
 "tools": [ { "name": "...", "budgetPrice": number, "budgetSupplier": "e.g. B&Q", "proPrice": number, "proSupplier": "e.g. Jewson", "whyItMatters": "1 sentence on what the extra spend actually gets you", "rentPerDay": number or null, "recommendation": "buy" or "rent", "rentReason": "1 sentence reason for the buy/rent call" } ]
}

Job: ${issue || "general property repair"}
Trade: ${trade || "General Builder"}
Materials: ${materialList}

Use realistic current UK retail/trade/hire pricing (Toolstation, Screwfix, Wickes, B&Q, Jewson, Selco, HSS Hire ballpark — these are illustrative typical prices, not live quotes). One note per material listed — don't invent extra materials.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2560,
        messages: [{ role: "user", content: prompt }],
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
    const text = (data.content || []).map((b) => b.text || "").join("\n");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return Response.json(parsed);
  } catch (err) {
    console.error("Shopping guide route failed:", err);
    return Response.json(
      { error: "Guide generation failed", detail: String(err.message || err) },
      { status: 500 }
    );
  }
}

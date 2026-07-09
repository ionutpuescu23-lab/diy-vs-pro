// src/app/api/guide/route.js
// Generates a detailed DIY step-by-step remediation plan via Claude.
// "Find a professional" contact info is NOT left to the model — it would have to
// invent business names/phone numbers for a given postcode, which is a hallucination
// risk. Instead we return the official UK regulator/trade-body directories (real,
// stable URLs) and tell the user to search them by their own postcode.
import { consumeAccess } from "@/lib/access";

// Claude's phased-plan generation can take longer than the platform default
// timeout, especially under load — extend it explicitly rather than risk a
// truncated response on slower requests.
export const maxDuration = 60;

const TRADE_DIRECTORIES = {
  "Gas Engineer (Gas Safe)": [
    { body: "Gas Safe Register", url: "https://www.gassaferegister.co.uk/find-an-engineer/", notes: "The legally required register for anyone working on gas in the UK. Search by postcode." },
  ],
  "Electrician (Part P)": [
    { body: "NICEIC", url: "https://www.niceic.com/find-a-contractor", notes: "Search by postcode for Part P registered electricians." },
    { body: "NAPIT", url: "https://www.napit.org.uk/find-an-installer", notes: "Alternative competent-person scheme register, searchable by postcode." },
  ],
  "Damp Specialist": [
    { body: "Property Care Association (PCA)", url: "https://www.property-care.org/find-a-member/", notes: "Trade body for damp, timber and structural waterproofing specialists — search members by area." },
    { body: "TrustMark", url: "https://www.trustmark.org.uk/find-a-tradesperson", notes: "Government-endorsed register, filter by trade and postcode." },
  ],
  DEFAULT: [
    { body: "TrustMark", url: "https://www.trustmark.org.uk/find-a-tradesperson", notes: "Government-endorsed quality scheme — filter by trade and postcode." },
    { body: "Federation of Master Builders", url: "https://www.findabuilder.fmb.org.uk/", notes: "Vetted builder directory, searchable by postcode." },
    { body: "Checkatrade", url: "https://www.checkatrade.com/", notes: "Reviewed tradespeople directory, searchable by postcode." },
  ],
};

function findAPro(trade, regulated) {
  const list = TRADE_DIRECTORIES[trade] || TRADE_DIRECTORIES.DEFAULT;
  // Regulated work always also gets the relevant statutory register even if the
  // selected trade string didn't match exactly.
  if (regulated && trade !== "Gas Engineer (Gas Safe)" && /gas/i.test(trade || "")) {
    return TRADE_DIRECTORIES["Gas Engineer (Gas Safe)"];
  }
  if (regulated && trade !== "Electrician (Part P)" && /electric/i.test(trade || "")) {
    return TRADE_DIRECTORIES["Electrician (Part P)"];
  }
  return list;
}

export async function POST(request) {
  try {
    const {
      issue, rootCause, severity, trade, regulated,
      roomLength, roomWidth, materials, postcode, regionArea, deviceId,
    } = await request.json();

    if (!deviceId) {
      return Response.json({ error: "Missing device ID" }, { status: 400 });
    }
    const access = await consumeAccess(deviceId);
    if (!access.allowed) {
      return Response.json({ error: "Free trial used up", paywall: true, state: access.state }, { status: 402 });
    }

    const roomArea = (parseFloat(roomLength) || 0) * (parseFloat(roomWidth) || 0);
    const materialList = (materials || [])
      .map((m) => `${m.qty ?? ""} ${m.unit ?? ""} ${m.name}`.trim())
      .join(", ") || "none selected yet";

    const prompt = `You are a UK chartered building surveyor and health & safety advisor specialising in moisture/damp remediation and general property repairs.

Produce a detailed, practical DIY step-by-step remediation plan for the job below, written for a complete beginner who may never have done DIY before. Respond with ONLY a raw JSON object (no markdown, no backticks) matching EXACTLY this schema:
{
 "overview": "2-3 sentence summary of the approach",
 "totalEstimatedTime": "e.g. '2 working days plus 48-72h drying/curing time'",
 "difficulty": {
   "rating": number from 1 (trivial) to 10 (expert-only),
   "summary": "1 reassuring sentence explaining why it's rated this, written for a nervous first-timer"
 },
 "confidenceBooster": "1 sentence comparing part of this job to an everyday skill most people already have, to make it feel approachable",
 "phases": [
   {
     "name": "phase name, e.g. Diagnosis & Prep",
     "duration": "e.g. 2-3 hours",
     "steps": ["clear imperative instruction", "..."],
     "safetyWarnings": ["specific hazard for this phase"],
     "commonMistakes": ["a mistake beginners typically make in this phase and how to avoid it"]
   }
 ],
 "buildingRegs": [
   {"reference": "e.g. Building Regulations Approved Document C", "why": "why it applies to this specific job"}
 ],
 "ppeRequired": ["personal protective equipment items"],
 "professionalRequired": {
   "mustCallPro": true or false,
   "reason": "why, referencing regulation/severity/complexity"
 }
}

Job details:
- Issue: ${issue || "unspecified property issue"}
- Likely root cause: ${rootCause || "unknown"}
- Damage severity: ${severity || "medium"}
- Room dimensions: ${roomLength || "?"}m x ${roomWidth || "?"}m (${roomArea ? roomArea.toFixed(1) : "?"} m²)
- Trade normally used for this job: ${trade || "General Builder"}
- Regulated work flagged: ${regulated ? "yes" : "no"}
- Materials already selected: ${materialList}
- Property location: UK postcode area ${postcode || "unspecified"} (region: ${regionArea || "unspecified"})

Keep it focused: 3-5 phases, each with 3-6 concise one-sentence steps and at most 2 common mistakes. Ground the plan in real UK Building Regulations — particularly Approved Document C (site preparation and resistance to contaminants and moisture) and BS 5250 (control of condensation) where relevant to damp/moisture work — and in real drying/curing times for the materials listed. If severity is "high", or the job involves structural work, gas, or electrics, set professionalRequired.mustCallPro to true regardless of DIY feasibility. Do not include any tradesperson names, company names, or phone numbers — that is handled separately.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4608,
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
    const plan = JSON.parse(text.replace(/```json|```/g, "").trim());

    // Safety net: regulated jobs always require a professional, no matter what the model said.
    if (regulated) {
      plan.professionalRequired = {
        mustCallPro: true,
        reason: plan.professionalRequired?.reason
          || "Regulated work (gas, consumer-unit electrics, or structural) must legally be carried out by a certified professional.",
      };
    }

    plan.findAProfessional = findAPro(trade, regulated);

    return Response.json(plan);
  } catch (err) {
    console.error("Guide route failed:", err);
    return Response.json(
      { error: "Guide generation failed", detail: String(err.message || err) },
      { status: 500 }
    );
  }
}

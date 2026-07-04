// src/app/api/image-search/route.js
// Thin server-side proxy to the Pexels API so the key never reaches the client
// and every card can show a real "what does this actually look like" photo.
// Fails soft: any missing key / network error / no-result just returns { url: null },
// and the UI falls back to its icon illustration.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const orientation = searchParams.get("orientation") || "square";
  if (!q) return Response.json({ url: null });

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return Response.json({ url: null, reason: "missing_api_key" });

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=1&orientation=${orientation}`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return Response.json({ url: null, reason: `pexels_${res.status}` });

    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return Response.json({ url: null });

    return Response.json({
      url: orientation === "landscape" ? (photo.src.large2x || photo.src.large) : photo.src.medium,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      pexelsUrl: photo.url,
    });
  } catch (err) {
    return Response.json({ url: null, reason: "fetch_failed" });
  }
}

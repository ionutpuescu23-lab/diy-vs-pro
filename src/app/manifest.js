// Next.js metadata-route convention: automatically served at /manifest.webmanifest
// and linked into <head> — no manual <link rel="manifest"> needed.
export default function manifest() {
  return {
    name: "DIY vs PRO — Property Calculators & Visual Guide",
    short_name: "DIY vs PRO",
    description: "Photo → diagnosis → costed DIY vs professional verdict for UK property repairs.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F7FA",
    theme_color: "#16212E",
    orientation: "portrait-primary",
    // Same 512x512 photo used for every purpose, for full visual
    // consistency — it's a full-bleed crop with no safe-zone padding, so an
    // OS applying its own adaptive-icon mask may clip the strap tip/corner
    // when using the maskable entry. Accepted deliberately.
    icons: [
      { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

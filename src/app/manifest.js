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
    icons: [
      { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Kept from the earlier hand-generated set — it's properly padded to
      // a safe zone on the brand background, unlike the full-bleed favicon-
      // generator export above, which would get its edges clipped when an
      // OS applies its own adaptive-icon mask.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

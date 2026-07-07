import "./globals.css";
import ServiceWorkerRegister from "@/components/service-worker-register";

export const metadata = {
  title: "DIY vs PRO",
  description: "Property calculators & visual guide — photo → diagnosis → costed verdict",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DIY vs PRO",
  },
};

export const viewport = {
  themeColor: "#16212E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

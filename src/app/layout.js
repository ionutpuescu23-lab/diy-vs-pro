import "./globals.css";
import ServiceWorkerRegister from "@/components/service-worker-register";
import InstallPrompt from "@/components/install-prompt";

export const metadata = {
  title: "DIY vs PRO",
  description: "Property calculators & visual guide — photo → diagnosis → costed verdict",
  // No manual `icons` field here on purpose — favicon.ico, icon0.svg,
  // icon1.png, and apple-icon.png live directly in src/app/ and are
  // auto-detected by Next's file-convention metadata, which generates the
  // <link> tags itself. Declaring `icons` here too would duplicate them.
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
        <InstallPrompt />
      </body>
    </html>
  );
}

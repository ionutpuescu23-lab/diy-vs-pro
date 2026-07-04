import "./globals.css";

export const metadata = {
  title: "DIY vs PRO",
  description: "Property calculators & visual guide — photo → diagnosis → costed verdict",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
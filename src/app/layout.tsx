import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Duuka POS", template: "%s · Duuka POS" },
  description: "Web-based point of sale, inventory and reporting system",
  applicationName: "Duuka POS",
  appleWebApp: { capable: true, title: "Duuka POS", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0f172a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}<ServiceWorkerRegister /></body>
    </html>
  );
}

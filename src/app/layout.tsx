import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Duuka POS", template: "%s · Duuka POS" },
  description: "Web-based point of sale, inventory and reporting system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}

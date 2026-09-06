import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICON Vitrin Ekranı",
  description: "ICON Emlak TV vitrin ekranı",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}

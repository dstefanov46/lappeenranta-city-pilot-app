import type { Metadata } from "next";
import "@fontsource/cinzel/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAPPEENRANTA",
  description: "Public district heating observation report form for Lappeenranta."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

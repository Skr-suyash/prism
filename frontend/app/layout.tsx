import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GridLock — Operational Priority Dashboard",
  description: "Severity-weighted traffic congestion index with dual heatmap visualization for Bengaluru parking enforcement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-950 text-zinc-100 font-[family-name:var(--font-inter)]">
        {children}
      </body>
    </html>
  );
}

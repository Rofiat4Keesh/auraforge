import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { company, siteUrl } from "@/lib/store-config";

/**
 * Root layout: only the <html>/<body> shell, fonts and site-wide metadata.
 * The shop's header, footer and cart live in app/(store)/layout.tsx;
 * the admin portal has its own layout in app/admin/layout.tsx.
 */

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${company.brandName} — Computers, Components & Gadgets in Nigeria`,
    template: `%s · ${company.brandName}`,
  },
  description:
    "Shop laptops, smartphones, computer parts, peripherals, audio, accessories and software from AuraForge Wide Technologies Ltd. Secure Naira payments with Paystack and nationwide delivery.",
  openGraph: {
    type: "website",
    siteName: company.brandName,
    locale: "en_NG",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${display.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}

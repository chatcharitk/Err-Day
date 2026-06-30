import type { Metadata, Viewport } from "next";
import { Prompt, Cormorant_Garamond } from "next/font/google";
import { LanguageProvider } from "@/components/LanguageProvider";
import { LiffProvider } from "@/components/LiffProvider";
import "./globals.css";

const prompt = Prompt({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin", "thai"],
  variable: "--font-prompt",
  display: "swap",
});

// Logo font — matches the brand's high-contrast serif logotype
const cormorant = Cormorant_Garamond({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "err.day — นัดหมายออนไลน์",
  description: "จองคิวนัดหมายที่ err.day salon ได้ง่ายๆ ออนไลน์",
  // PWA: installable to the Home Screen (required for iOS Web Push).
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "err.day", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#8B1D24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${prompt.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-prompt)]">
        <LiffProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </LiffProvider>
      </body>
    </html>
  );
}

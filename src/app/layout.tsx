import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

const prompt = Prompt({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin", "thai"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "err.day — นัดหมายออนไลน์",
  description: "จองคิวนัดหมายที่ err.day salon ได้ง่ายๆ ออนไลน์",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${prompt.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-prompt)]">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

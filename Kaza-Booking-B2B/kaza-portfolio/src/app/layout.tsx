import type { Metadata } from "next";
import { Playfair_Display, Alexandria } from "next/font/google";
import "./globals.css";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import { LanguageProvider } from "@/context/LanguageContext";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const alexandria = Alexandria({
  variable: "--font-alexandria",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "KAZA | B2B Portfolio",
  description: "Turn Your Property into a Professionally Managed Hospitality Asset",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${alexandria.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <LanguageProvider>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/lib/providers/query-provider";
import SmoothScrollProvider from "@/lib/providers/smooth-scroll-provider";
import { GsapProvider } from "@/lib/providers/gsap-provider";
import { ViewTransitionsProvider } from "@/lib/providers/view-transitions-provider";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Rental Platform",
  description: "Discover luxury rental properties on the Egyptian coast.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitionsProvider>
      <html lang="en">
        <body className="bg-background font-sans text-foreground">
          <QueryProvider>
            <SmoothScrollProvider>
              <GsapProvider>{children}</GsapProvider>
            </SmoothScrollProvider>
          </QueryProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              className: "rounded-lg",
            }}
          />
        </body>
      </html>
    </ViewTransitionsProvider>
  );
}

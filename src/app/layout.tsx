import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Ethiopic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-noto-ethiopic",
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Adwa Cyber — Compliance Platform",
  description:
    "Phase 1 compliance-automation platform: 47 rules of the Ethiopian Personal Data Protection Proclamation No. 1321/2024, engine-scored with Amharic interface.",
  keywords: ["Adwa Cyber", "Ethiopia", "Proclamation 1321/2024", "compliance", "data protection"],
  authors: [{ name: "Adwa Cyber Research Lab" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoEthiopic.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "var(--font-geist-sans), var(--font-noto-ethiopic), sans-serif" }}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          {/* Two toast systems coexist by migration history: radix (useToast)
              and sonner (toast.success/error). Both portals are mounted so
              every component's notifications actually render. */}
          <Toaster />
          <SonnerToaster position="bottom-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit, Inter, Geist_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { CriticalSiteLock } from "@/components/CriticalSiteLock";
import { ChatProvider, FloatingButton, SlideOutPanel } from "@/components/Chat";
import { GoogleAnalytics } from "@/components/Analytics";
import { Analytics } from "@vercel/analytics/react";
import { getSiteSettings } from "@/sanity/queries";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Aditya More | Applied AI Engineer",
    template: "%s | Aditya More"
  },
  description:
    "Applied AI Engineer building reliable GenAI, RAG, Computer Vision, OCR, and Python backend systems for real-world applications.",
  openGraph: {
    title: "Aditya More | Applied AI Engineer",
    description:
      "Reliable GenAI, RAG, Computer Vision, OCR, and Python backend systems for practical applications.",
    url: siteUrl,
    siteName: "Aditya More Portfolio",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: "/favicon.svg"
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const siteSettings = await getSiteSettings();
  const showAiChat = siteSettings?.showAiChat ?? true;

  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable} ${geistMono.variable}`}>
      <body>
        <RootProvider search={{ enabled: false }} theme={{ enabled: false }}>
          {showAiChat ? (
            <ChatProvider>
              <MaintenanceBanner
                enabled={siteSettings?.maintenanceEnabled ?? false}
                message={siteSettings?.maintenanceMessage ?? ''}
              />
              {children}
              <FloatingButton />
              <SlideOutPanel />
              <CriticalSiteLock
                criticalLock={siteSettings?.criticalLock ?? false}
                email={siteSettings?.email}
                linkedinUrl={siteSettings?.linkedinUrl}
                githubUrl={siteSettings?.githubUrl}
              />
            </ChatProvider>
          ) : (
            <>
              <MaintenanceBanner
                enabled={siteSettings?.maintenanceEnabled ?? false}
                message={siteSettings?.maintenanceMessage ?? ''}
              />
              {children}
              <CriticalSiteLock
                criticalLock={siteSettings?.criticalLock ?? false}
                email={siteSettings?.email}
                linkedinUrl={siteSettings?.linkedinUrl}
                githubUrl={siteSettings?.githubUrl}
              />
            </>
          )}
        </RootProvider>
        <Analytics />
        <GoogleAnalytics />
      </body>
    </html>
  );
}

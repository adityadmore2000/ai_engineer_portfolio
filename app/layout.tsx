import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import "./globals.css";

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

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RootProvider search={{ enabled: false }} theme={{ enabled: false }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHARE_IMAGE,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/seo";
import OfflineStatus from "@/components/OfflineStatus";
import "../public/replova-design.css";
import "./globals.css";
import "./pilot.css";
import "./tap-home.css";
import "./site-roles.css";

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: "Replova | %s",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  keywords: [
    "Replova",
    "customer feedback", "NFC feedback", "QR feedback", "business playbooks",
  ],
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    images: [SITE_SHARE_IMAGE],
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    images: [SITE_SHARE_IMAGE],
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: "@Replova",
    site: "@Replova",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className="replova-type"
    >
      <head><link rel="preload" href="/fonts/montserrat.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head>
      <body data-theme="light" data-density="comfortable">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <OfflineStatus />
        {children}
      </body>
      {process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}

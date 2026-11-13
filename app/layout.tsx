import type { Metadata } from "next";
import { Geist_Mono, Onest } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Replova | AI Google Review Management",
    template: "Replova | %s",
  },
  description:
    "Replova monitors Google reviews, drafts on-brand replies, publishes approved responses, and turns customer feedback into practical business intelligence for any local business.",
  keywords: [
    "Replova",
    "AI review replies",
    "business reputation management",
    "Google review management software",
    "AI Google review replies",
    "Google review management",
    "customer sentiment analysis",
    "local competitor tracking",
    "AI reply generator",
    "reputation management SaaS",
  ],
  metadataBase: new URL("https://replova.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://replova.app",
    siteName: "Replova",
    title: "Replova | AI Google Review Management",
    description:
      "AI-drafted Google review replies, sentiment analysis, competitor tracking, and weekly reputation insights for local businesses.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Replova | AI Review Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Replova | AI Google Review Management",
    description:
      "AI-drafted Google review replies, sentiment analysis, and competitor tracking for local businesses.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/replova-mark.svg", type: "image/svg+xml" }],
    shortcut: "/replova-mark.svg",
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
      className={`${onest.variable} ${geistMono.variable}`}
    >
      <body data-theme="light" data-density="comfortable">
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
      </body>
      {process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}

import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI Review Management for Med Spas & Aesthetic Clinics | Replova",
    template: "%s | Replova",
  },
  description:
    "Replova is AI-powered reputation management for med spas, aesthetic clinics, salons, and dental offices. Get AI-drafted Google review replies, sentiment analysis, competitor tracking, and weekly digest emails.",
  keywords: [
    "Replova",
    "AI review replies",
    "med spa reputation management",
    "reputation management software for med spas",
    "aesthetic clinic reviews",
    "Google review management",
    "salon review software",
    "dental office reviews",
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
    title: "AI Review Management for Med Spas & Aesthetic Clinics | Replova",
    description:
      "AI-drafted Google review replies, sentiment analysis, competitor tracking, and weekly digests for med spas, aesthetic clinics, and salons.",
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
    title: "AI Review Management for Med Spas & Aesthetic Clinics | Replova",
    description:
      "AI-drafted Google review replies, sentiment analysis, and competitor tracking for aesthetic businesses.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: "/favicon.ico",
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
      className={notoSans.variable}
    >
      <body data-theme="light" data-density="comfortable">
        {children}
      </body>
      {process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}

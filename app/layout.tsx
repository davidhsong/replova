import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body data-theme="light" data-density="comfortable">
        {children}
      </body>
      {process.env.NODE_ENV === "production" && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
      )}
    </html>
  );
}

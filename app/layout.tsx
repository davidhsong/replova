import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// Runs before paint to set the theme attribute from saved preference or system,
// avoiding a light/dark flash on load. Must stay inline (not an external asset).
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('replova-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

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
      suppressHydrationWarning
      className={`${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body data-density="comfortable">
        {children}
      </body>
      {process.env.NODE_ENV === "production" && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
      )}
    </html>
  );
}

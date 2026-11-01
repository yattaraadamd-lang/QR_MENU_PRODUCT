import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import SkipLink from "@/components/SkipLink";
import WebVitalsLoader from "@/components/WebVitalsLoader";
import { SITE_URL } from "@/lib/site-url";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

// Editoryal başlık: tek ağırlık (400) + italik vurgu
const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

// Veri dili (fiyat, saat, masa no, etiket); ilk ekranın LCP'si değil, ön yüklenmez
const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "QR Menü Platformu",
    template: "%s | QR Menü Platformu",
  },
  description: "QR kod tabanlı dijital menü, sipariş ve hizmet yönetim platformu",
  // "./" her sayfada kendi yoluna çözülür (self-canonical); sorgu parametreleri atılır.
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "QR Menü Platformu",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F0D0B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <SkipLink />
        <WebVitalsLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

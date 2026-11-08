import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import SkipLink from "@/components/SkipLink";
import WebVitalsLoader from "@/components/WebVitalsLoader";
import { SITE_NAME, siteTitle } from "@/lib/site";
import { SITE_URL } from "@/lib/site-url";

// Gövde: geniş açıklıklı, küçük boyda da okunaklı (değişken ağırlık)
const sans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

// Başlık: kalın, karakterli grotesk (değişken ağırlık + optik boyut)
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

// Yalnız logo kelime işareti (ilk tasarımın logosu): tek ağırlık, "QRMenü" latin
// alt kümesinde. LCP metni değil; ön yüklenmez, ilk boyamayla yarışmaz.
const logo = Fraunces({
  weight: "600",
  subsets: ["latin"],
  variable: "--font-logo",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: siteTitle("%s"),
  },
  description: "QR kod tabanlı dijital menü, sipariş ve hizmet yönetim platformu",
  // "./" her sayfada kendi yoluna çözülür (self-canonical); sorgu parametreleri atılır.
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: SITE_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#FFF9F2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${sans.variable} ${display.variable} ${logo.variable}`}>
      <body>
        <SkipLink />
        <WebVitalsLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

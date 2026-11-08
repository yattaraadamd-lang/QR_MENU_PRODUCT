import type { Metadata } from "next";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import { siteTitle } from "@/lib/site";

// Düz metin başlık alt sayfaların kök şablonunu siler; şablon burada yeniden verilir
export const metadata: Metadata = {
  title: { template: siteTitle("%s"), default: siteTitle("Hesap") },
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthSessionProvider>{children}</AuthSessionProvider>;
}

import type { Metadata } from "next";
import Link from "next/link";
import PixelMark from "@/components/brand/PixelMark";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main id="main-content" className="landing-theme flex min-h-dvh items-center justify-center p-6">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
        <PixelMark size={44} />
        <p className="eyebrow">404</p>
        <h1 className="font-display text-5xl">Sayfa bulunamadı</h1>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir. Masadaysanız QR kodu yeniden okutun.
        </p>
        <Link href="/" className="btn btn-primary">
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}

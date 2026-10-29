import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main id="main-content" className="landing-theme flex min-h-dvh items-center justify-center p-6">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
        <div aria-hidden="true" style={{ fontSize: 48 }}>🍽️</div>
        <h1 className="font-display text-3xl font-semibold">Sayfa bulunamadı</h1>
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

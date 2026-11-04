"use client";

/* eslint-disable no-restricted-syntax -- bu ekran globals.css'e güvenemez (aşağıda) */
import type { RouteErrorProps } from "@/components/RouteErrorView";

// Kök layout da çökerse: kendi <html>'ini taşır; globals.css yüklenmemiş olabilir, stiller satır içi
export default function GlobalError({ reset }: RouteErrorProps) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#FFF9F2", color: "#2A2420" }}>
        <main style={{ maxWidth: 360, margin: "20vh auto 0", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Uygulama yüklenemedi</h1>
          <p style={{ marginBottom: 20, lineHeight: 1.6, color: "#5A4F47" }}>
            Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", borderRadius: 999, border: 0, background: "#D13C27", color: "#FFFFFF", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}

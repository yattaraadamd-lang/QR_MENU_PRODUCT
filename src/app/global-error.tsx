"use client";

import type { RouteErrorProps } from "@/components/RouteErrorView";

// Kök layout da çökerse: kendi <html>'ini taşır; globals.css yüklenmemiş olabilir, stiller satır içi
export default function GlobalError({ reset }: RouteErrorProps) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#FFF8F1", color: "#2A1A12" }}>
        <main style={{ maxWidth: 360, margin: "20vh auto 0", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Uygulama yüklenemedi</h1>
          <p style={{ marginBottom: 20, lineHeight: 1.6, color: "#6E4F3F" }}>
            Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#B23415", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}

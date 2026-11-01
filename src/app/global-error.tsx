"use client";

import type { RouteErrorProps } from "@/components/RouteErrorView";

// Kök layout da çökerse: kendi <html>'ini taşır; globals.css yüklenmemiş olabilir, stiller satır içi
export default function GlobalError({ reset }: RouteErrorProps) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0F0D0B", color: "#F5EEE6" }}>
        <main style={{ maxWidth: 360, margin: "20vh auto 0", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Uygulama yüklenemedi</h1>
          <p style={{ marginBottom: 20, lineHeight: 1.6, color: "#BCAFA2" }}>
            Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", borderRadius: 999, border: 0, background: "#FF5A1F", color: "#0F0D0B", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}

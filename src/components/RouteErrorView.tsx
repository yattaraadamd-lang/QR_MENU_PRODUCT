"use client";

import { useEffect } from "react";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

interface RouteErrorViewProps extends RouteErrorProps {
  /** Açık tema sınıfı ve yükseklik (ör. "customer-theme min-h-dvh"); verilmezse panelin koyu teması */
  className?: string;
  title?: string;
  message?: string;
}

/**
 * error.tsx sınırlarının ortak görünümü. Teknik ayrıntı gösterilmez; digest
 * sunucu loguyla eşleştirmek için yeterli. Panel sınırları layout'un içinde
 * çizildiği için kenar çubuğu ve üst çubuk yerinde kalır.
 */
export default function RouteErrorView({
  error,
  reset,
  className = "min-h-[60dvh]",
  title = "Bir şeyler ters gitti",
  message = "Sayfa yüklenirken beklenmedik bir sorun oluştu. Bilgileriniz kaybolmadı; tekrar deneyebilirsiniz.",
}: RouteErrorViewProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className={`${className} flex items-center justify-center p-6`}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
        <div aria-hidden="true" style={{ fontSize: 48 }}>⚠️</div>
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{message}</p>
        {error.digest && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Hata kodu: {error.digest}
          </p>
        )}
        {/* autoFocus yok (jsx-a11y no-autofocus); role="alert" metni zaten duyurur */}
        <button type="button" className="btn btn-primary" onClick={reset}>
          Tekrar dene
        </button>
      </div>
    </div>
  );
}

"use client";

import { use } from "react";
import BrandMark from "@/components/brand/BrandMark";
import { useQrRedirect } from "@/components/customer-menu/useQrRedirect";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";

export default function QRTokenPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = use(params);
  const { error, retry } = useQrRedirect(qrToken);

  return (
    <main id="main-content" className="customer-theme min-h-viewport flex items-center justify-center p-4">
      {error ? (
        <div className="max-w-sm text-center">
          <BrandMark size={48} className="mx-auto mb-5" />
          <p className="eyebrow">QR kod</p>
          <h1 className="font-display mb-2 mt-2 text-4xl">Kod geçersiz</h1>
          <p className="mb-6 text-fg-secondary">{error}</p>
          <Button onClick={retry}>Tekrar dene</Button>
        </div>
      ) : (
        <Loader label="Menü hazırlanıyor" />
      )}
    </main>
  );
}

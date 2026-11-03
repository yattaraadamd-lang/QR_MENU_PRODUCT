"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { useCopyText } from "@/hooks/useCopyText";
import Button from "@/components/ui/Button";
import { INVITE_QR_SIZE, whatsappShareUrl } from "./staffModel";
import type { NewInvite } from "./types";

const DATE = new Intl.DateTimeFormat("tr-TR");
/** Ekranda gösterilen QR boyutu (indirilen dosya INVITE_QR_SIZE) */
const QR_PREVIEW_SIZE = 160;

interface NewInviteCardProps {
  invite: NewInvite;
  businessName: string | null | undefined;
}

/** Yeni davet: QR, link, kopyala / WhatsApp / QR indir. Link yalnız şimdi gösterilir. */
export default function NewInviteCard({ invite, businessName }: NewInviteCardProps) {
  const urlRef = useRef<HTMLParagraphElement>(null);
  const { copied, copy } = useCopyText();

  const handleCopy = async () => {
    const outcome = await copy(invite.url, urlRef.current);
    if (outcome === "selected") toast.info("Link seçildi; kopyalamak için Ctrl+C (mobilde uzun basın).");
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-md border border-line p-4">
      {/* data: URL — next/image'ın optimize edeceği bir kaynak yok; QR her temada beyaz zeminde */}
      <img
        src={invite.qrDataUrl}
        alt="Davet QR kodu"
        width={QR_PREVIEW_SIZE}
        height={QR_PREVIEW_SIZE}
        className="shrink-0 rounded-sm bg-white"
      />
      <div className="min-w-[13.75rem] flex-1">
        <p className="mb-1.5 text-sm font-bold text-fg">Davet linki hazır</p>
        <p ref={urlRef} className="mb-2.5 break-all rounded-sm bg-surface-hover px-2.5 py-2 font-mono text-xs text-fg">
          {invite.url}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleCopy}>
            {copied ? "✅ Kopyalandı" : "📋 Linki Kopyala"}
          </Button>
          <a
            href={whatsappShareUrl(businessName, invite.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            💬 WhatsApp&apos;ta Gönder
          </a>
          <a href={invite.qrDataUrl} download="garson-davet-qr.png" className="btn btn-ghost btn-sm">
            ⬇️ QR&apos;ı İndir<span className="sr-only"> ({INVITE_QR_SIZE} piksel PNG)</span>
          </a>
        </div>
        <p className="mt-2.5 text-2xs text-fg-secondary">
          ⚠️ Güvenlik nedeniyle link sadece şimdi gösterilir. Kaybolursa yeni bir link oluşturun.
          {invite.expiresAt && ` Son geçerlilik: ${DATE.format(new Date(invite.expiresAt))}.`}
        </p>
      </div>
    </div>
  );
}

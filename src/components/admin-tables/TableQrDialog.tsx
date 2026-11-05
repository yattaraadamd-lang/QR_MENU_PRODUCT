"use client";

import { useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { tableDisplayName } from "@/components/tables/tableModel";
import { adminTablesApi, type TableQrDTO } from "./adminTables.api";

/** QR kodu boyutu (px): yazdırılınca da okunur */
const QR_SIZE = 220;

export default function TableQrDialog({ qr: initialQr, onClose }: { qr: TableQrDTO; onClose: () => void }) {
  const [qr, setQr] = useState(initialQr);
  const [confirming, setConfirming] = useState(false);
  const [rotated, setRotated] = useState(false);
  const rotate = useApiMutation(adminTablesApi.rotateQr);
  const name = tableDisplayName(qr);

  const handleRotate = async () => {
    const result = await rotate.run(qr.tableId);
    if (!result.ok) return;
    setQr(result.data);
    setConfirming(false);
    setRotated(true);
  };

  return (
    <Modal
      onClose={onClose}
      title={name}
      description="QR kodu yazdırın veya indirin"
      footer={
        confirming ? (
          <>
            <Button variant="ghost" className="flex-1" disabled={rotate.pending} onClick={() => setConfirming(false)}>
              Vazgeç
            </Button>
            <Button variant="danger" className="flex-1" loading={rotate.pending} onClick={handleRotate}>
              {rotate.pending ? "Yenileniyor..." : "Evet, yenile"}
            </Button>
          </>
        ) : (
          <>
            <a href={qr.qrImageData} download={`qr_${name}.png`} className="btn btn-primary flex-1">
              📥 İndir
            </a>
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              🔄 Yenile
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Kapat
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        {confirming && (
          <Alert tone="danger">
            ⚠️ Masadaki basılı QR çalışmaz olur; yenisini yazdırıp masaya koymanız gerekir. Henüz onaylanmamış
            cihazların oturumları kapanır, masadaki onaylı müşteri etkilenmez.
          </Alert>
        )}
        {rotated && (
          <Alert tone="success" role="status">
            ✅ QR yenilendi. Eski kod artık çalışmıyor; yenisini indirip masaya koyun.
          </Alert>
        )}
        <FormError message={rotate.error} />
        {/* QR her temada beyaz zeminde kalmalı: koyu zeminde okuyucular zorlanır */}
        <div className="rounded-lg bg-white p-4">
          {/* data: URL — next/image'ın optimize edeceği bir kaynak yok */}
          <img src={qr.qrImageData} alt={`${name} QR kodu`} width={QR_SIZE} height={QR_SIZE} className="block" />
        </div>
        <p className="break-all px-2 text-2xs text-fg-secondary">{qr.qrUrl}</p>
      </div>
    </Modal>
  );
}

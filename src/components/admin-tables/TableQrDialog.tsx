"use client";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { tableDisplayName } from "@/components/tables/tableModel";
import type { TableQrDTO } from "./adminTables.api";

/** QR kodu boyutu (px): yazdırılınca da okunur */
const QR_SIZE = 220;

export default function TableQrDialog({ qr, onClose }: { qr: TableQrDTO; onClose: () => void }) {
  const name = tableDisplayName(qr);

  return (
    <Modal
      onClose={onClose}
      title={name}
      description="QR kodu yazdırın veya indirin"
      footer={
        <>
          <a href={qr.qrImageData} download={`qr_${name}.png`} className="btn btn-primary flex-1">
            📥 İndir
          </a>
          <Button variant="ghost" onClick={onClose}>
            Kapat
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
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

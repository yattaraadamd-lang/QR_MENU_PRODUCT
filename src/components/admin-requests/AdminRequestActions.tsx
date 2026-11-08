import Button from "@/components/ui/Button";
import type { RequestStatus, ServiceRequestDTO } from "@/components/requests/types";
import type { AdminServiceRequestDTO } from "./types";

interface AdminRequestActionsProps {
  request: AdminServiceRequestDTO;
  /** Ekran okuyucu bağlamı: aynı adlı düğmeler kartlar arasında ayırt edilsin */
  context: string;
  busy: boolean;
  onStatus: (request: ServiceRequestDTO, status: RequestStatus) => void;
  onOpenTable: (request: ServiceRequestDTO, code: string) => void;
  onRejectOrder: (request: ServiceRequestDTO) => void;
}

/**
 * Açık talebin eylemleri. Sipariş talebi: bekliyorsa kod + masayı aç / reddet, görüldüyse yalnız
 * reddet (uç PENDING/SEEN kabul eder). Diğer türler: tamamla / iptal.
 */
export default function AdminRequestActions({ request, context, busy, onStatus, onOpenTable, onRejectOrder }: AdminRequestActionsProps) {
  const sr = <span className="sr-only"> — {context}</span>;

  if (request.requestType !== "ORDER_REQUEST") {
    return (
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button variant="success" size="sm" className="flex-1" loading={busy} onClick={() => onStatus(request, "COMPLETED")}>
          <span aria-hidden="true">✓</span> Tamamla{sr}
        </Button>
        <Button variant="danger-ghost" size="sm" disabled={busy} onClick={() => onStatus(request, "CANCELLED")}>
          <span aria-hidden="true">✕</span> İptal{sr}
        </Button>
      </div>
    );
  }

  const reject = (
    <Button variant="danger-ghost" size="sm" disabled={busy} onClick={() => onRejectOrder(request)}>
      <span aria-hidden="true">✕</span> Reddet{sr}
    </Button>
  );

  if (request.status === "SEEN") return <div className="mt-2.5 flex">{reject}</div>;
  if (request.status !== "PENDING") return null;

  const code = request.verificationCode;
  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {code && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-sm bg-warning/10 px-3 py-2">
          <p className="text-2xs font-bold text-warning-fg">
            Doğrulama kodu (müşteriye gösteriliyor) — masayı açınca müşteri yetkilendirilir
          </p>
          <p className="font-mono text-xl font-black tracking-widest text-primary-light">{code}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {/* Kod yoksa uç "Doğrulama kodu gerekli" der: düğme baştan kapalı */}
        <Button
          variant="success"
          size="sm"
          className="flex-1"
          loading={busy}
          disabled={!code}
          onClick={() => code && onOpenTable(request, code)}
        >
          {busy ? "Açılıyor..." : <><span aria-hidden="true">🔓</span> Masayı Aç{sr}</>}
        </Button>
        {reject}
      </div>
    </div>
  );
}

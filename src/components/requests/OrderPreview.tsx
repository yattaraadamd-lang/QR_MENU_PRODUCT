import { formatTRY } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import type { OrderPreviewDTO } from "./types";

/**
 * Masa açma isteğinin sepet özeti. Ayrı dosya: admin kartı kod girişi formunu (CodeInput)
 * paketine çekmesin (istemci chunk'ında kullanılmayan export elenmiyor).
 */
export default function OrderPreview({ preview }: { preview: OrderPreviewDTO }) {
  return (
    <Alert tone="warning" size="sm" className="mt-2">
      <p className="mb-1.5 font-bold text-fg">📋 Ürün Özeti</p>
      <ul className="flex flex-col gap-1 text-fg">
        {preview.items?.map((item, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>
              <strong>{item.quantity}×</strong> {item.name}
              {item.note && <span className="ml-1 text-fg-muted">({item.note})</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatTRY(Number(item.unitPrice || 0) * Number(item.quantity || 1))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex justify-between gap-2 border-t border-dashed border-warning/40 pt-1.5 text-sm font-extrabold text-fg">
        <span>Tahmini Toplam</span>
        <span className="tabular-nums text-primary-light">{formatTRY(preview.total ?? 0)}</span>
      </p>
      {preview.orderNote && <p className="mt-1 italic text-fg-secondary">Not: {preview.orderNote}</p>}
    </Alert>
  );
}

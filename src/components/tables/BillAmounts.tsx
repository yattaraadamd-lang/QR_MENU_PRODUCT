import { cn } from "@/lib/cn";
import { formatTRY } from "@/lib/format";
import type { TableBillDTO } from "./types";

interface BillAmountsProps {
  bill: TableBillDTO;
  /** "card": kart içi özet (yalnız dolu satırlar), "detail": tüm satırlar */
  variant?: "card" | "detail";
  className?: string;
}

/** Toplam / ödenen / kalan (dl). Kalan borç kırmızı, kapanmış hesap yeşil. */
export default function BillAmounts({ bill, variant = "card", className }: BillAmountsProps) {
  const paid = Number(bill.paidAmount);
  const remaining = Number(bill.remainingAmount);
  const isDetail = variant === "detail";

  return (
    <dl className={cn("flex flex-col", isDetail ? "gap-1.5 text-sm" : "gap-0.5 text-2xs", className)}>
      <AmountRow label="Toplam" value={formatTRY(bill.totalAmount)} valueClass="font-semibold text-fg" />
      {(isDetail || paid > 0) && (
        <AmountRow label="Ödenen" value={formatTRY(bill.paidAmount)} valueClass="font-semibold text-success-fg" />
      )}
      {(isDetail || remaining > 0) && (
        <AmountRow
          label="Kalan"
          value={formatTRY(bill.remainingAmount)}
          valueClass={cn("font-bold", remaining > 0 ? "text-danger-fg" : "text-success-fg")}
        />
      )}
    </dl>
  );
}

function AmountRow({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-fg-secondary">{label}</dt>
      <dd className={cn("tabular-nums", valueClass)}>{value}</dd>
    </div>
  );
}

import { formatTRY } from "@/lib/format";
import type { Money } from "@/lib/format";

interface PaymentTargetSummaryProps {
  tableName: string;
  /** Tutarın etiketi: "Kalan Hesap", "Adisyon / Kalan Borç"… */
  amountLabel: string;
  amount: Money;
}

/** Ödeme penceresinin üstündeki "hangi masa, ne kadar borç" özeti */
export default function PaymentTargetSummary({ tableName, amountLabel, amount }: PaymentTargetSummaryProps) {
  return (
    <dl className="flex flex-col gap-2 rounded-md bg-surface-hover p-4 text-sm">
      <div className="flex justify-between gap-2">
        <dt className="text-fg-secondary">Masa</dt>
        <dd className="font-bold text-fg">{tableName}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-fg-secondary">{amountLabel}</dt>
        <dd className="text-lg font-extrabold tabular-nums text-primary-light">{formatTRY(amount)}</dd>
      </div>
    </dl>
  );
}

import { formatTRY } from "@/lib/format";
import { tableDisplayName } from "@/components/tables/tableModel";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { OpenBillDTO } from "./types";

interface OpenBillCardProps {
  bill: OpenBillDTO;
  onPay: (bill: OpenBillDTO) => void;
}

/** Açık adisyon: toplam, ödenen, kalan ve doğrudan tahsilat */
export default function OpenBillCard({ bill, onPay }: OpenBillCardProps) {
  const name = tableDisplayName(bill.table);

  return (
    <li className="card flex flex-col justify-between gap-6 p-5">
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold text-fg">{name}</h3>
          <Badge tone="warning" className="shrink-0">
            Açık Adisyon
          </Badge>
        </div>

        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-fg-secondary">Toplam Hesap</dt>
            <dd className="font-semibold tabular-nums text-fg">{formatTRY(bill.totalAmount)}</dd>
          </div>
          {Number(bill.paidAmount) > 0 && (
            <div className="flex justify-between gap-2">
              <dt className="text-fg-secondary">Ödenen</dt>
              <dd className="font-semibold tabular-nums text-success-fg">-{formatTRY(bill.paidAmount)}</dd>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-line-subtle pt-2">
            <dt className="text-base font-bold text-fg">Kalan Tutar</dt>
            <dd className="text-lg font-extrabold tabular-nums text-primary-light">{formatTRY(bill.remainingAmount)}</dd>
          </div>
        </dl>
      </div>

      <Button className="w-full" aria-label={`${name} için ödeme al`} onClick={() => onPay(bill)}>
        Ödeme Al
      </Button>
    </li>
  );
}

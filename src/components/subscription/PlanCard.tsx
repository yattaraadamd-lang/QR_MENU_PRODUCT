import { cn } from "@/lib/cn";
import Button from "@/components/ui/Button";
import { formatLimit } from "./subscriptionModel";
import type { PlanDTO } from "./types";

const PRICE = new Intl.NumberFormat("tr-TR");

interface PlanCardProps {
  plan: PlanDTO;
  selected: boolean;
  action: { label: string; disabled: boolean };
  onSelect: (plan: PlanDTO) => void;
}

/** Plan kartı: ad, aylık ücret, sınırlar, özellikler, seçim düğmesi */
export default function PlanCard({ plan, selected, action, onSelect }: PlanCardProps) {
  return (
    // .card çerçevesini ezmeden seçili vurgusu: outline
    <li className={cn("card flex flex-col p-4", selected && "outline outline-2 -outline-offset-1 outline-primary")}>
      <h3 className="text-base font-extrabold text-fg">{plan.name}</h3>
      {plan.description && <p className="mt-0.5 text-xs text-fg-secondary">{plan.description}</p>}
      <p className="my-3 text-2xl font-extrabold tabular-nums text-fg">
        {PRICE.format(plan.monthlyPrice)} ₺<span className="text-sm font-medium text-fg-secondary"> /ay</span>
      </p>
      <ul className="mb-3.5 grid gap-1 text-sm text-fg-secondary">
        <li>🪑 {formatLimit(plan.maxTables)} masa</li>
        <li>👥 {formatLimit(plan.maxWaiters)} garson</li>
        <li>🍽️ {formatLimit(plan.maxProducts)} ürün</li>
        {plan.hasReports && <li>📊 Raporlar</li>}
        {plan.hasPayments && <li>💳 Ödeme takibi</li>}
      </ul>
      <Button
        size="sm"
        className="mt-auto w-full"
        disabled={action.disabled}
        aria-pressed={selected}
        onClick={() => onSelect(plan)}
      >
        {action.label}
        {!action.disabled && <span className="sr-only">: {plan.name}</span>}
      </Button>
    </li>
  );
}

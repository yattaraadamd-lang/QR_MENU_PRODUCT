import { cn } from "@/lib/cn";
import { formatTRY } from "@/lib/format";
import Card from "@/components/ui/Card";
import { TONE_TEXT, TONE_TINT } from "@/components/ui/tone";
import type { Kpi } from "./dashboardModel";

/** Ciro TL biçiminde; gizliyse görsel maske, ekran okuyucuya "Gizli" */
function KpiValue({ kpi, revenueHidden }: { kpi: Kpi; revenueHidden: boolean }) {
  if (!kpi.money) return <>{kpi.value}</>;
  if (!revenueHidden) return <>{formatTRY(kpi.value)}</>;
  return (
    <>
      <span aria-hidden="true">••••</span>
      <span className="sr-only">Gizli</span>
    </>
  );
}

/** KPI kartları (markalı .stat-card: üst kenarda adisyon fişi çizgisi) */
export default function KpiGrid({ kpis, revenueHidden }: { kpis: readonly Kpi[]; revenueHidden: boolean }) {
  return (
    <ul aria-label="Özet" className="stagger mb-8 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
      {kpis.map((kpi) => (
        <Card key={kpi.label} as="li" variant="stat" padding="none">
          <span
            aria-hidden="true"
            className={cn("mb-2.5 flex size-9 items-center justify-center rounded-[10px]", TONE_TINT[kpi.tone], TONE_TEXT[kpi.tone])}
          >
            <kpi.Icon className="size-5" />
          </span>
          <p className="stat-label">{kpi.label}</p>
          <p className="stat-value">
            <KpiValue kpi={kpi} revenueHidden={revenueHidden} />
          </p>
        </Card>
      ))}
    </ul>
  );
}

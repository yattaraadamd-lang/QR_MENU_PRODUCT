import { useId, type ReactNode } from "react";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

const SKELETON_COUNT = 3;
/** Telefonda tek sütun (min ile 320px ekranda taşmaz), geniş ekranda yan yana */
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-4";

interface PaymentSectionProps {
  title: ReactNode;
  icon?: ReactNode;
  query: { isLoading: boolean; error: string | null; refresh: () => void };
  count: number;
  empty: { icon: string; title: string };
  children: ReactNode;
}

/** Başlık + sorgu durumu (yükleniyor, hata, boş) + kart ızgarası */
export default function PaymentSection({ title, icon, query, count, empty, children }: PaymentSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h2 id={headingId} className="mb-4 flex items-center gap-2 text-lg font-bold text-fg">
        {icon}
        {title}
      </h2>
      <QueryError message={query.error} onRetry={query.refresh} />
      {query.isLoading && (
        <div role="status" aria-label="Yükleniyor" className={GRID}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}
      {!query.isLoading && count === 0 && !query.error && <EmptyState variant="card" icon={empty.icon} title={empty.title} />}
      {count > 0 && <ul className={`stagger ${GRID}`}>{children}</ul>}
    </section>
  );
}

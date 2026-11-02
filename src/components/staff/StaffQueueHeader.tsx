import FilterTabs from "@/components/ui/FilterTabs";

export type QueueFilter = "active" | "completed";

interface StaffQueueHeaderProps {
  title: string;
  filter: QueueFilter;
  onFilterChange: (filter: QueueFilter) => void;
  /** Bekleyen kayıt sayısı: aktif sekmede "N yeni" + sekme sayacı */
  pendingCount: number;
  /** Filtre grubunun ekran okuyucu adı */
  filterLabel: string;
}

/** Garson iş kuyruğu başlığı (siparişler, talepler): başlık, yeni sayacı, Aktif/Geçmiş */
export default function StaffQueueHeader({ title, filter, onFilterChange, pendingCount, filterLabel }: StaffQueueHeaderProps) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h1 className="page-title page-title-sm">{title}</h1>
        {pendingCount > 0 && filter === "active" && (
          <span className="animate-pulse-glow rounded-full bg-danger px-2 py-0.5 text-2xs font-extrabold text-white">
            {pendingCount} yeni
          </span>
        )}
      </div>
      <FilterTabs<QueueFilter>
        label={filterLabel}
        value={filter}
        onChange={onFilterChange}
        tabs={[
          { value: "active", label: "Aktif", count: pendingCount, tone: "danger" },
          { value: "completed", label: "Geçmiş" },
        ]}
      />
    </header>
  );
}

import Button from "./Button";

interface PagerProps {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}

/** Sayfalama: önceki/sonraki + "Sayfa 2 / 5 (93 kayıt)". Tek sayfada çizilmez. */
export default function Pager({ page, totalPages, total, onChange }: PagerProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Sayfalama" className="mt-5 flex flex-wrap items-center justify-center gap-3">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Önceki
      </Button>
      <p className="text-sm text-fg-secondary" aria-live="polite">
        Sayfa {page} / {totalPages} ({total} kayıt)
      </p>
      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Sonraki →
      </Button>
    </nav>
  );
}

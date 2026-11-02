import { cn } from "@/lib/cn";
import Button from "./Button";
import type { Tone } from "./tone";

export interface FilterTab<T extends string> {
  readonly value: T;
  readonly label: string;
  /** 0 ya da verilmezse sayaç gösterilmez */
  readonly count?: number;
  /** Seçili değilken sayacın rengi (tema rozet çifti) */
  readonly tone?: Tone;
}

interface FilterTabsProps<T extends string> {
  /** Grubun ekran okuyucu adı */
  label: string;
  tabs: readonly FilterTab<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Liste filtresi: düğme grubu, seçili olan aria-pressed. Sayaç seçili sekmede düğme yazısının
 * rengini alır (kontrast düğmeyle aynı), diğerlerinde ton rozeti.
 */
export default function FilterTabs<T extends string>({ label, tabs, value, onChange }: FilterTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Button
            key={tab.value}
            size="sm"
            variant={selected ? "primary" : "ghost"}
            aria-pressed={selected}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {Boolean(tab.count) && (
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-extrabold",
                  selected && "border border-current",
                  !selected && (tab.tone ? `badge-${tab.tone}` : "bg-surface-hover text-fg-secondary"),
                )}
              >
                <span className="sr-only">: </span>
                {tab.count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

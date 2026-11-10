import { useId } from "react";
import type { DateRange } from "./types";

interface DateRangeFieldsProps {
  range: DateRange;
  /** Bitişin üst sınırı (bugün) */
  max: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
}

/** Başlangıç–bitiş tarihi. Telefonda tam genişlik, iki alan yan yana esner; genişte sabit. */
export default function DateRangeFields({ range, max, onStart, onEnd }: DateRangeFieldsProps) {
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
      <span id={labelId} className="w-full text-sm font-semibold text-fg-secondary sm:w-auto">
        Tarih Aralığı:
      </span>
      <input
        type="date"
        aria-label="Başlangıç tarihi"
        className="input min-w-0 flex-1 sm:w-40 sm:flex-none"
        value={range.start}
        max={range.end}
        onChange={(e) => onStart(e.target.value)}
      />
      <span aria-hidden="true" className="text-fg-secondary">
        –
      </span>
      <input
        type="date"
        aria-label="Bitiş tarihi"
        className="input min-w-0 flex-1 sm:w-40 sm:flex-none"
        value={range.end}
        min={range.start}
        max={max}
        onChange={(e) => onEnd(e.target.value)}
      />
    </div>
  );
}

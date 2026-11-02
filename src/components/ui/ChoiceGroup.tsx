"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { eyebrowClass } from "./tone";

export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: ReactNode;
}

interface ChoiceGroupProps<T extends string> {
  legend: ReactNode;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** "grid": iki sütun (kısa seçenekler), "stack": alt alta */
  layout?: "grid" | "stack";
  className?: string;
}

/**
 * Kart görünümlü tekli seçim: yerel radyo düğmeleri (fieldset + legend), yön tuşlarıyla
 * gezilir. Seçili olan renkten bağımsız olarak ✓ ile de belli olur.
 */
export default function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  layout = "grid",
  className,
}: ChoiceGroupProps<T>) {
  const name = useId();

  return (
    <fieldset className={className}>
      <legend className={cn("mb-2", eyebrowClass)}>{legend}</legend>
      <div className={layout === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-1.5"}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label key={option.value} className="relative block cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-md border-2 px-3 py-2 text-sm font-semibold transition-colors",
                  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                  checked
                    ? "border-primary bg-primary/10 text-primary-light"
                    : "border-line text-fg-secondary hover:border-primary/40",
                )}
              >
                {checked && <Check aria-hidden="true" className="size-4 shrink-0" />}
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

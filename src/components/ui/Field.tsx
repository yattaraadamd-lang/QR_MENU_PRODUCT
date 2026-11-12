import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { eyebrowClass } from "./tone";

interface FieldProps {
  label: ReactNode;
  /** Etiketin bağlandığı alanın id'si */
  htmlFor: string;
  children: ReactNode;
  className?: string;
  /** Alanın altında gösterilen hata; alan buna `invalidProps` ile bağlanır */
  error?: string;
}

/**
 * Alanı altındaki hata metnine bağlayan öznitelikler; hata yokken hiçbir şey eklemez:
 * `<input id={id} {...invalidProps(error, id)} />`. Kırmızı çerçeve aria-invalid'den gelir (globals).
 */
export function invalidProps(error: string | undefined, inputId: string) {
  return error ? ({ "aria-invalid": true, "aria-describedby": `${inputId}-error` } as const) : undefined;
}

/** Etiket + alan (+ hata). Etiket her zaman `htmlFor` ile bağlıdır. */
export default function Field({ label, htmlFor, children, className, error }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={cn("mb-1.5 block", eyebrowClass)}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs font-medium text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

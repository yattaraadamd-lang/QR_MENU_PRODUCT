import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { eyebrowClass } from "./tone";

interface FieldProps {
  label: ReactNode;
  /** Etiketin bağlandığı alanın id'si */
  htmlFor: string;
  children: ReactNode;
  className?: string;
}

/** Etiket + alan. Etiket her zaman `htmlFor` ile bağlıdır. */
export default function Field({ label, htmlFor, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={cn("mb-1.5 block", eyebrowClass)}>
        {label}
      </label>
      {children}
    </div>
  );
}

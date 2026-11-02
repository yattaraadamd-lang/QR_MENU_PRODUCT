import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./AmountInput.module.css";

type AmountInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode">;

/** Para tutarı alanı: ondalık klavye (mobil), kuruş adımı, iri rakamlar. */
export default function AmountInput({ className, step = "0.01", min = "0.01", ...props }: AmountInputProps) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      className={cn("input", styles.amount, className)}
      {...props}
    />
  );
}

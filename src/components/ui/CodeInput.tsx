import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./CodeInput.module.css";

interface CodeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  /** Yalnız rakamlar, `length` ile sınırlı */
  onChange: (value: string) => void;
  length: number;
}

/** Tek kullanımlık sayısal kod (doğrulama kodu): sayısal klavye, rakam dışını atar, iri aralıklı rakamlar */
export default function CodeInput({ value, onChange, length, className, ...props }: CodeInputProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern={`\\d{${length}}`}
      maxLength={length}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
      className={cn("input", styles.code, className)}
      {...props}
    />
  );
}

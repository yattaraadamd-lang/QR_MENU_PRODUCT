import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Button.module.css";

type ThemeVariant = "primary" | "accent" | "success" | "danger" | "warning" | "ghost" | "subtle";
type ButtonVariant = ThemeVariant | "danger-ghost";

/** Temada `.btn-<ad>` olarak tanımlı olmayan varyantlar */
const MODULE_VARIANT: Partial<Record<ButtonVariant, string>> = {
  "danger-ghost": styles.dangerGhost,
};
type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** İstek sürerken: döner ikon + tıklanamaz */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/** Tema düğmesi (`.btn-*`). Varsayılan type="button": form içinde yanlışlıkla gönderim yapmaz. */
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  type = "button",
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn("btn", MODULE_VARIANT[variant] ?? `btn-${variant}`, size !== "md" && `btn-${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        // Saf CSS halka: ikon kütüphanesini her sayfanın ilk yük paketine sokmaz
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : (
        leftIcon && <span aria-hidden="true" className="inline-flex shrink-0">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span aria-hidden="true" className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
}

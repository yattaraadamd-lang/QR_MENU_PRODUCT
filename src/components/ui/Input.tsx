"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./Input.module.css";

/** Alanın içinde dikey ortalı simge/düğme */
const ADORNMENT = "absolute top-1/2 flex -translate-y-1/2 items-center text-fg-muted";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  showPasswordToggle?: boolean;
  /** Öne çıkan alan (giriş formu): 48px yükseklik */
  large?: boolean;
}

export default function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  showPasswordToggle = false,
  large = false,
  type,
  className,
  id,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const passwordType = showPassword ? "text" : "password";
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-semibold text-fg-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && <span className={cn(ADORNMENT, "left-3")}>{leftIcon}</span>}
        <input
          id={inputId}
          type={showPasswordToggle ? passwordType : type}
          className={cn(
            "input",
            Boolean(leftIcon) && styles.withLeftIcon,
            (Boolean(rightIcon) || showPasswordToggle) && styles.withRightIcon,
            large && styles.large,
            className,
          )}
          // Kırmızı çerçeve aria-invalid'den gelir (globals.css)
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={showPassword}
            className={cn(ADORNMENT, "right-3 p-1 hover:text-fg")}
          >
            {showPassword ? <EyeOff aria-hidden="true" className="size-[18px]" /> : <Eye aria-hidden="true" className="size-[18px]" />}
          </button>
        )}
        {rightIcon && !showPasswordToggle && <span className={cn(ADORNMENT, "right-3")}>{rightIcon}</span>}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

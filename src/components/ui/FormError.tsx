import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

interface FormErrorProps {
  message: string | null | undefined;
  className?: string;
  /** @deprecated Boşluk için className ver (ör. "mt-3"); eski ekranlar taşınana kadar duruyor */
  style?: CSSProperties;
}

/**
 * Form/modal içi hata satırı. Açık bir <dialog> varken toast kullanılmaz:
 * modal üst katmanda (top layer) çizildiği için toast örtünün arkasında kalır.
 * role="alert" ile belirdiği an ekran okuyucuya duyurulur.
 */
export default function FormError({ message, className, style }: FormErrorProps) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-sm font-semibold leading-normal text-danger-fg", className)} style={style}>
      ⚠️ {message}
    </p>
  );
}

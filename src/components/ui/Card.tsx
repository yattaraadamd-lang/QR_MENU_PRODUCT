import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "flat" | "stat" | "glass";
type CardPadding = "none" | "sm" | "md" | "lg";
type CardElement = "div" | "section" | "article" | "li";

interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  /** Anlamsal öğe: liste içindeki kart için "li" */
  as?: CardElement;
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: "card",
  flat: "card-flat",
  stat: "stat-card",
  glass: "glass",
};

const PADDING_CLASS: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export default function Card({ variant = "default", padding = "md", as: Element = "div", className, ...props }: CardProps) {
  return <Element className={cn(VARIANT_CLASS[variant], PADDING_CLASS[padding], className)} {...props} />;
}

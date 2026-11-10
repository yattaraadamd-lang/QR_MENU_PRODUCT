import { cn } from "@/lib/cn";
import type { Tone } from "./tone";

const TONE_BG: Record<Tone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  purple: "bg-purple",
  neutral: "bg-fg-muted",
};

/**
 * Kartın sol kenarında durum rengi: köşelere değmeyen iç çubuk. Ebeveyn position:relative
 * olmalı. Ayrı öğe olduğu için kartın kendi çerçevesine dokunmaz.
 */
export default function ToneStripe({ tone }: { tone: Tone }) {
  return <span aria-hidden="true" className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", TONE_BG[tone])} />;
}

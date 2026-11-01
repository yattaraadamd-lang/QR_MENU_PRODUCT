import { cn } from "@/lib/cn";

/**
 * Yükleniyor yer tutucusu (ışıltı animasyonu temada). Boyutu sınıfla verilir (ör. "h-36");
 * dekoratiftir: kapsayıcı role="status" + aria-label ile "yükleniyor" der.
 */
export default function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

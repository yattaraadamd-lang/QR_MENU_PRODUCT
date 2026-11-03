import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SectionCardProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Gövde dolgusu: liste/tablo kenara dayanır ("none"), form/metin "md" */
  padding?: "none" | "md";
  className?: string;
}

/** Başlıklı kart bölümü (section + aria-labelledby): ayar ve liste ekranları */
export default function SectionCard({ title, description, children, padding = "none", className }: SectionCardProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn("card", className)}>
      <div className="border-b border-line px-5 py-4">
        <h2 id={headingId} className="text-base font-bold text-fg">
          {title}
        </h2>
        {description && <p className="mt-1 text-xs leading-normal text-fg-secondary">{description}</p>}
      </div>
      <div className={padding === "md" ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

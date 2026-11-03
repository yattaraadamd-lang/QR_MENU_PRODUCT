import Link from "next/link";
import { cn } from "@/lib/cn";
import { TONE_TEXT } from "@/components/ui/tone";
import { QUICK_LINKS } from "./dashboardModel";

/** Sık kullanılan ekranlara kısayollar (geniş ekranda 2 sütun, sağda) */
export default function QuickLinks() {
  return (
    <nav aria-label="Hızlı erişim">
      <ul className="stagger grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-2.5 lg:min-w-[220px] lg:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 py-[18px] transition-colors hover:border-primary/35 hover:bg-surface-hover"
            >
              <link.Icon aria-hidden="true" className={cn("size-6", TONE_TEXT[link.tone])} />
              <span className="text-xs font-semibold text-fg-secondary">{link.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

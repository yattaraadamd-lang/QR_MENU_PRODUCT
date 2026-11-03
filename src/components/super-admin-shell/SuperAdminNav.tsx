"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { SUPER_ADMIN_NAV, type SuperAdminNavVariant } from "./navConfig";

interface SuperAdminNavProps {
  variant: SuperAdminNavVariant;
  onNavigate?: () => void;
}

/** Platform menüsü: masaüstü kenar çubuğu ve telefon menüsü aynı listeyi ve etkin sayfa işaretini kullanır */
export default function SuperAdminNav({ variant, onNavigate }: SuperAdminNavProps) {
  const pathname = usePathname();
  const sheet = variant === "sheet";

  return (
    <nav aria-label="Platform menüsü" className={sheet ? undefined : "flex-1 px-3 py-5"}>
      <ul className={cn("flex flex-col", sheet ? "gap-2" : "gap-1")}>
        {SUPER_ADMIN_NAV.map((link) => {
          // Alt sayfalar (ör. /super-admin/businesses/[id]) da menüde etkin görünsün
          const active = pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md transition-colors",
                  sheet ? "p-4 text-base" : "px-4 py-3",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "font-medium text-fg-secondary hover:bg-surface-hover hover:text-fg",
                )}
              >
                <span aria-hidden="true" className={cn("leading-none", sheet ? "text-xl" : "text-lg")}>
                  {link.icon}
                </span>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** .btn ortalar (globals Tailwind'den sonra gelir): menü linkleriyle aynı sola dayalı görünüm için düz düğme */
export function SuperAdminSignOut({ variant }: { variant: SuperAdminNavVariant }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
      className={cn(
        "flex w-full items-center gap-2 rounded-md font-semibold text-danger-fg transition-colors hover:bg-surface-hover",
        variant === "sheet" ? "mt-auto p-4 text-base" : "px-4 py-3 text-sm",
      )}
    >
      <LogOut aria-hidden="true" className="size-4" />
      Çıkış yap
    </button>
  );
}

export interface SuperAdminNavItem {
  readonly href: string;
  readonly label: string;
  /** Dekoratif (aria-hidden): erişilebilir ad link metninden gelir */
  readonly icon: string;
}

export const SUPER_ADMIN_NAV: readonly SuperAdminNavItem[] = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/super-admin/businesses", label: "İşletmeler", icon: "🏪" },
  { href: "/super-admin/users", label: "Kullanıcılar", icon: "👥" },
  { href: "/super-admin/subscriptions", label: "Abonelikler", icon: "💎" },
  { href: "/super-admin/payments", label: "Platform Ödemeleri", icon: "💳" },
  { href: "/super-admin/settings", label: "Ayarlar", icon: "⚙️" },
];

/** sidebar: masaüstü kenar çubuğu; sheet: telefonda tam ekran menü (daha iri dokunma alanı) */
export type SuperAdminNavVariant = "sidebar" | "sheet";

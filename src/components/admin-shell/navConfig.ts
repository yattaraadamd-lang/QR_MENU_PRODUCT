import {
  Ban,
  Bell,
  ClipboardList,
  Clock,
  CreditCard,
  FolderOpen,
  Gem,
  LayoutDashboard,
  Package,
  Settings,
  Table2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { BadgeCounts } from "@/hooks/useBadgeCounts";

type NavGroup = "main" | "ops" | "menu" | "venue" | "system";

export interface AdminNavItem {
  readonly href: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly group: NavGroup;
  /** Menüde sayaç gösterilecek alan */
  readonly badge?: keyof Omit<BadgeCounts, "total">;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, group: "main" },
  { href: "/admin/orders", label: "Siparişler", Icon: ClipboardList, group: "ops", badge: "orders" },
  { href: "/admin/requests", label: "Talepler", Icon: Bell, group: "ops", badge: "requests" },
  { href: "/admin/pending-payments", label: "Bekleyen Ödemeler", Icon: Clock, group: "ops", badge: "payments" },
  { href: "/admin/payments", label: "Geçmiş Ödemeler", Icon: CreditCard, group: "ops" },
  { href: "/admin/products", label: "Ürünler", Icon: Package, group: "menu" },
  { href: "/admin/categories", label: "Kategoriler", Icon: FolderOpen, group: "menu" },
  { href: "/admin/tables", label: "Masalar & QR", Icon: Table2, group: "venue", badge: "payments" },
  { href: "/admin/staff", label: "Personel", Icon: Users, group: "venue" },
  { href: "/admin/blocked-devices", label: "Engelli Cihazlar", Icon: Ban, group: "system" },
  { href: "/admin/subscription", label: "Abonelik", Icon: Gem, group: "system" },
  { href: "/admin/settings", label: "Ayarlar", Icon: Settings, group: "system" },
];

/** Menü grupları sırasıyla; "main" başlıksız */
export const NAV_GROUPS: readonly { readonly key: NavGroup; readonly label: string }[] = [
  { key: "main", label: "" },
  { key: "ops", label: "Operasyon" },
  { key: "menu", label: "Menü" },
  { key: "venue", label: "İşletme" },
  { key: "system", label: "Sistem" },
];

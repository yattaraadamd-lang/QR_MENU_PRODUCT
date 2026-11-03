import {
  BarChart3,
  Bell,
  ClipboardList,
  Clock,
  CreditCard,
  Package,
  Table2,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/ui/tone";
import type { DashboardSummaryDTO } from "./types";

export interface Kpi {
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly tone: Tone;
  readonly value: number | string;
  /** Ciro: "Ciroyu Gizle" ile maskelenir */
  readonly money?: boolean;
}

export function dashboardKpis(s: DashboardSummaryDTO): Kpi[] {
  return [
    { label: "Bugünkü Ciro", Icon: TrendingUp, tone: "success", value: s.todayRevenue, money: true },
    { label: "Aylık Ciro", Icon: BarChart3, tone: "purple", value: s.monthlyRevenue, money: true },
    { label: "Bugün Sipariş", Icon: ClipboardList, tone: "info", value: s.todayOrderCount },
    { label: "Bekleyen", Icon: Clock, tone: "warning", value: s.pendingOrderCount },
    { label: "Aktif Talep", Icon: Bell, tone: "danger", value: s.activeRequestCount },
    { label: "Ödeme Talebi", Icon: CreditCard, tone: "purple", value: s.paymentRequestCount },
    { label: "Dolu Masa", Icon: Table2, tone: "primary", value: `${s.occupiedTableCount}/${s.totalTableCount}` },
  ];
}

export interface QuickLink {
  readonly href: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly tone: Tone;
}

export const QUICK_LINKS: readonly QuickLink[] = [
  { href: "/admin/orders", label: "Siparişler", Icon: ClipboardList, tone: "info" },
  { href: "/admin/products", label: "Ürünler", Icon: Package, tone: "purple" },
  { href: "/admin/tables", label: "Masalar", Icon: Table2, tone: "success" },
  { href: "/admin/requests", label: "Talepler", Icon: Bell, tone: "warning" },
  { href: "/admin/payments", label: "Ödemeler", Icon: CreditCard, tone: "purple" },
  { href: "/admin/staff", label: "Personel", Icon: Users, tone: "danger" },
];

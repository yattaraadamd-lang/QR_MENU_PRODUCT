import type { Metadata } from "next";
import AdminDashboardScreen from "@/components/admin-dashboard/AdminDashboardScreen";
import { areaTitle } from "@/lib/site";

// Layout ile aynı segmentte: bölge şablonu uygulanmadığı için tam başlık
export const metadata: Metadata = { title: { absolute: areaTitle("Dashboard", "Yönetim") } };

export default function AdminDashboardPage() {
  return <AdminDashboardScreen />;
}

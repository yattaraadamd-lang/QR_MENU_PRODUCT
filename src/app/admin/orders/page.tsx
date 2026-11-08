import type { Metadata } from "next";
import AdminOrdersScreen from "@/components/admin-orders/AdminOrdersScreen";

export const metadata: Metadata = { title: "Sipariş Yönetimi" };

export default function AdminOrdersPage() {
  return <AdminOrdersScreen />;
}

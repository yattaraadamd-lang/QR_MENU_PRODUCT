import type { Metadata } from "next";
import AdminTablesScreen from "@/components/admin-tables/AdminTablesScreen";

export const metadata: Metadata = { title: "Masa & QR Yönetimi" };

export default function AdminTablesPage() {
  return <AdminTablesScreen />;
}

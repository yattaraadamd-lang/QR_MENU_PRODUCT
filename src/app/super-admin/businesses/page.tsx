import type { Metadata } from "next";
import SuperAdminBusinessesScreen from "@/components/super-admin-businesses/SuperAdminBusinessesScreen";

export const metadata: Metadata = { title: "İşletme Yönetimi" };

export default function SuperAdminBusinessesPage() {
  return <SuperAdminBusinessesScreen />;
}

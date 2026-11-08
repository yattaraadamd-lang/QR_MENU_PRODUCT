import type { Metadata } from "next";
import AdminSettingsScreen from "@/components/admin-settings/AdminSettingsScreen";

export const metadata: Metadata = { title: "İşletme Ayarları" };

export default function AdminSettingsPage() {
  return <AdminSettingsScreen />;
}

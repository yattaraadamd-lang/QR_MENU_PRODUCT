import type { Metadata } from "next";
import AdminStaffScreen from "@/components/admin-staff/AdminStaffScreen";

export const metadata: Metadata = { title: "Personel & Davetler" };

export default function AdminStaffPage() {
  return <AdminStaffScreen />;
}

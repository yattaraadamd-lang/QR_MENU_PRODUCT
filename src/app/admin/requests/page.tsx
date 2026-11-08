import type { Metadata } from "next";
import AdminRequestsScreen from "@/components/admin-requests/AdminRequestsScreen";

export const metadata: Metadata = { title: "Müşteri Talepleri" };

export default function AdminRequestsPage() {
  return <AdminRequestsScreen />;
}

import type { Metadata } from "next";
import AdminPaymentsScreen from "@/components/admin-payments/AdminPaymentsScreen";

export const metadata: Metadata = { title: "Ödemeler" };

export default function AdminPaymentsPage() {
  return <AdminPaymentsScreen />;
}

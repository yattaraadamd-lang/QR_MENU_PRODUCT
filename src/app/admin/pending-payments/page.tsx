import type { Metadata } from "next";
import PendingPaymentsScreen from "@/components/pending-payments/PendingPaymentsScreen";

export const metadata: Metadata = { title: "Admin Ödeme Onayları & Bekleyen Adisyonlar" };

export default function PendingPaymentsPage() {
  return <PendingPaymentsScreen />;
}

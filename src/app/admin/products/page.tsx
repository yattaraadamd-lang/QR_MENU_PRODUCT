import type { Metadata } from "next";
import AdminProductsScreen from "@/components/admin-products/AdminProductsScreen";

export const metadata: Metadata = { title: "Ürün Yönetimi" };

export default function AdminProductsPage() {
  return <AdminProductsScreen />;
}

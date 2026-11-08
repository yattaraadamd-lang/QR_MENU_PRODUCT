import type { Metadata } from "next";
import AdminCategoriesScreen from "@/components/admin-categories/AdminCategoriesScreen";

export const metadata: Metadata = { title: "Kategori Yönetimi" };

export default function AdminCategoriesPage() {
  return <AdminCategoriesScreen />;
}

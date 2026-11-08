import type { Metadata } from "next";
import SuperAdminUsersScreen from "@/components/super-admin-platform/SuperAdminUsersScreen";

export const metadata: Metadata = { title: "Kullanıcı Yönetimi" };

export default function SuperAdminUsersPage() {
  return <SuperAdminUsersScreen />;
}

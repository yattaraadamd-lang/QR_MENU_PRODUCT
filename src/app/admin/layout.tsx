import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminRoot from "@/components/admin-shell/AdminRoot";
import { areaTitle, siteTitle } from "@/lib/site";

// Şablon yalnız alt segmentlere uygulanır; /admin sayfası başlığını `absolute` ile verir
export const metadata: Metadata = {
  title: { template: areaTitle("%s", "Yönetim"), default: siteTitle("Yönetim") },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { readonly children: ReactNode }) {
  return <AdminRoot>{children}</AdminRoot>;
}

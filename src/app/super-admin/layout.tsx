import type { Metadata } from "next";
import type { ReactNode } from "react";
import SuperAdminRoot from "@/components/super-admin-shell/SuperAdminRoot";
import { areaTitle, siteTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: { template: areaTitle("%s", "Platform"), default: siteTitle("Platform") },
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({ children }: { readonly children: ReactNode }) {
  return <SuperAdminRoot>{children}</SuperAdminRoot>;
}

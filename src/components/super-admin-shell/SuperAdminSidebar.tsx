import BrandLogo from "@/components/brand/BrandLogo";
import SuperAdminNav, { SuperAdminSignOut } from "./SuperAdminNav";

/** Masaüstü kenar çubuğu (md ve üstü); telefonda SuperAdminMobileBar menüsü devralır */
export default function SuperAdminSidebar() {
  return (
    <aside className="h-viewport sticky top-0 hidden w-[260px] shrink-0 flex-col border-r border-line bg-surface-page md:flex">
      <div className="border-b border-line px-5 py-6">
        <div className="panel-brand">
          <BrandLogo size="sm" />
          <p className="panel-brand-sub">Platform yönetimi</p>
        </div>
      </div>
      <SuperAdminNav variant="sidebar" />
      <div className="border-t border-line p-5">
        <SuperAdminSignOut variant="sidebar" />
      </div>
    </aside>
  );
}

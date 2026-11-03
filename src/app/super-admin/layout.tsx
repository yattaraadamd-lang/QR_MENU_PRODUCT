"use client";

import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import AccessDenied from "@/components/staff/AccessDenied";
import { useMobileSidebar } from "@/components/staff/useMobileSidebar";
import SuperAdminMobileBar from "@/components/super-admin-shell/SuperAdminMobileBar";
import SuperAdminSidebar from "@/components/super-admin-shell/SuperAdminSidebar";
import Loader from "@/components/ui/Loader";

const MOBILE_MENU_ID = "super-admin-menu";
/** Tailwind md kırılımı: kenar çubuğu görünür, telefon menüsü kapanır */
const DESKTOP_QUERY = "(min-width: 768px)";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthSessionProvider>
      <SuperAdminGate>{children}</SuperAdminGate>
    </AuthSessionProvider>
  );
}

function SuperAdminGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  // Oturum okunurken kilit ekranı çizilirse yetkili kullanıcı her yenilemede "Erişim Engellendi" görür
  if (status === "loading") return <Loader fullScreen label="Panel yükleniyor" />;
  if (session?.user.role !== "SUPER_ADMIN") return <AccessDenied message="Bu alana sadece Super Admin erişebilir." />;

  return <SuperAdminShell>{children}</SuperAdminShell>;
}

function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const menu = useMobileSidebar(MOBILE_MENU_ID, DESKTOP_QUERY);

  return (
    <div className="min-h-viewport flex bg-surface-muted" data-height-vars>
      <SuperAdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <SuperAdminMobileBar
          menuId={MOBILE_MENU_ID}
          open={menu.open}
          menuButtonRef={menu.menuButtonRef}
          onToggle={menu.toggle}
          onNavigate={menu.closeOnNavigate}
        />
        {/* Telefon menüsü açıkken içerik etkisiz: Tab menüden arkaya kaçmasın */}
        <main
          id="main-content"
          key={pathname}
          inert={menu.open}
          className="page-enter flex-1 overflow-y-auto px-4 py-6 sm:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

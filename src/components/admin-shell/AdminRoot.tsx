"use client";

import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { NotificationSoundProvider } from "@/components/notifications";
import AdminSidebar from "@/components/admin-shell/AdminSidebar";
import AdminTopBar from "@/components/admin-shell/AdminTopBar";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import AccessDenied from "@/components/staff/AccessDenied";
import { useMobileSidebar } from "@/components/staff/useMobileSidebar";
import Loader from "@/components/ui/Loader";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";

const SIDEBAR_ID = "admin-sidebar";

export default function AdminRoot({ children }: { children: ReactNode }) {
  return (
    <AuthSessionProvider>
      <AdminGate>{children}</AdminGate>
    </AuthSessionProvider>
  );
}

function AdminGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  // Oturum okunurken kilit ekranı çizilirse yetkili admin her yenilemede "Erişim Engellendi" görür
  if (status === "loading") return <Loader fullScreen label="Panel yükleniyor" />;
  if (session?.user.role !== "ADMIN") return <AccessDenied message="Bu sayfaya erişim için admin yetkisi gerekli." />;

  return (
    <NotificationSoundProvider mode="admin">
      <AdminShell>{children}</AdminShell>
    </NotificationSoundProvider>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const sidebar = useMobileSidebar(SIDEBAR_ID);
  const { counts } = useBadgeCounts();

  return (
    <div className="min-h-viewport flex">
      {sidebar.open && (
        <div aria-hidden="true" onClick={sidebar.dismiss} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
      )}

      <AdminSidebar
        id={SIDEBAR_ID}
        open={sidebar.open}
        businessName={session?.user.businessName}
        userName={session?.user.name}
        counts={counts}
        onNavigate={sidebar.closeOnNavigate}
      />

      {/* Mobil menü açıkken içerik etkisiz: Tab kenar çubuğundan arkaya kaçmasın */}
      <div className="admin-main min-w-0 flex-1" inert={sidebar.open}>
        <AdminTopBar
          sidebarId={SIDEBAR_ID}
          sidebarOpen={sidebar.open}
          menuButtonRef={sidebar.menuButtonRef}
          onOpenMenu={sidebar.openSidebar}
        />
        <main id="main-content" key={pathname} className="page-enter mx-auto max-w-screen-xl px-5 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

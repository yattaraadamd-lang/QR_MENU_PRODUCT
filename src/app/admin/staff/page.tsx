"use client";

import { useNow } from "@/hooks/useNow";
import InviteHistory from "@/components/admin-staff/InviteHistory";
import NewInviteCard from "@/components/admin-staff/NewInviteCard";
import StaffTable from "@/components/admin-staff/StaffTable";
import { useAdminStaffPage } from "@/components/admin-staff/useAdminStaffPage";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import QueryError from "@/components/ui/QueryError";
import SectionCard from "@/components/ui/SectionCard";

/** Davetlerin "süresi doldu" durumu dakikalık hassasiyetle yeter */
const CLOCK_TICK_MS = 60_000;

export default function AdminStaffPage() {
  const page = useAdminStaffPage();
  const { staff, invites } = page;
  const staffList = staff.data ?? [];
  const inviteList = invites.data ?? [];
  const now = useNow(CLOCK_TICK_MS);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Personel & Davetler</h1>

      <SectionCard title="Personel Listesi">
        {staff.error && (
          <div className="px-5 pt-4">
            <QueryError message={staff.error} onRetry={staff.refresh} />
          </div>
        )}
        {staff.isLoading && <Loader label="Personel yükleniyor" />}
        {!staff.isLoading && staffList.length === 0 && !staff.error && (
          <p className="p-8 text-center text-fg-secondary">
            Henüz personel yok. Aşağıdan bir davet linki oluşturup garsonlarınıza gönderin.
          </p>
        )}
        {staffList.length > 0 && <StaffTable staff={staffList} />}
      </SectionCard>

      <SectionCard
        title="Garson Davet Et"
        padding="md"
        description={
          <>
            Bir davet linki oluşturun ve garsonunuza WhatsApp&apos;tan gönderin ya da QR kodu telefonuna okutun. Garson
            linki açıp kendi hesabını oluşturur; kod yazmasına gerek kalmaz. Her link <strong>tek kullanımlık</strong> ve{" "}
            <strong>7 gün</strong> geçerlidir.
          </>
        }
      >
        <Button className="w-full" loading={page.creating} onClick={page.createInvite}>
          {page.creating ? "Oluşturuluyor..." : "➕ Yeni Davet Linki Oluştur"}
        </Button>
        {page.newInvite && <NewInviteCard invite={page.newInvite} businessName={page.businessName} />}
      </SectionCard>

      <SectionCard
        title="Davet Geçmişi"
        description="Güvenlik nedeniyle linkler tekrar gösterilmez; yalnızca oluşturulduğu anda görüntülenir."
      >
        {invites.error && (
          <div className="px-5 pt-4">
            <QueryError message={invites.error} onRetry={invites.refresh} />
          </div>
        )}
        {invites.isLoading && <Loader label="Davetler yükleniyor" />}
        {!invites.isLoading && inviteList.length === 0 && !invites.error && (
          <p className="p-8 text-center text-fg-secondary">Henüz davet oluşturulmadı</p>
        )}
        {inviteList.length > 0 && <InviteHistory invites={inviteList} now={now} onDelete={page.deleteInvite} />}
      </SectionCard>

      {page.confirmDialog}
    </div>
  );
}

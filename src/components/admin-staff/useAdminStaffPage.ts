"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useConfirm } from "@/components/ui/useConfirm";
import { adminStaffApi, INVITES_URL, selectInvites, selectStaff, STAFF_URL } from "./adminStaff.api";
import { INVITE_QR_SIZE } from "./staffModel";
import type { InviteDTO, NewInvite } from "./types";

/** Personel listesi + garson davetleri: oluştur (link + QR), iptal et */
export function useAdminStaffPage() {
  const { data: session } = useSession();
  const ready = Boolean(session?.user.businessId);
  const staff = useApiQuery(ready ? STAFF_URL : null, { select: selectStaff });
  const invites = useApiQuery(ready ? INVITES_URL : null, { select: selectInvites });

  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState<NewInvite | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const createInvite = async () => {
    setCreating(true);
    try {
      const result = await adminStaffApi.createInvite();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const invite = result.data.invite;
      const url = invite?.inviteUrl ?? `${window.location.origin}/auth/join/${invite?.inviteCode ?? ""}`;
      // qrcode yalnız davet oluşturulurken iner (sayfa paketinde değil)
      const { default: QRCode } = await import("qrcode");
      const qrDataUrl = await QRCode.toDataURL(url, { width: INVITE_QR_SIZE, margin: 2 });
      setNewInvite({ url, qrDataUrl, expiresAt: invite?.expiresAt ?? null });
      void invites.refresh();
    } catch (e) {
      console.error("[staff] davet QR'ı üretilemedi", e);
      toast.error("Davet linki oluşturulurken bir hata oluştu.");
    } finally {
      setCreating(false);
    }
  };

  const deleteInvite = async (invite: InviteDTO) => {
    const ok = await confirm({
      title: "Davet iptal edilsin mi?",
      description: "Link artık çalışmayacak.",
      confirmText: "Daveti iptal et",
    });
    if (!ok) return;
    const result = await adminStaffApi.deleteInvite(invite.id);
    if (result.ok) {
      toast.success("Davet iptal edildi");
      void invites.refresh();
    } else if (!result.aborted) {
      toast.error(result.error);
    }
  };

  return {
    staff,
    invites,
    businessName: session?.user?.businessName,
    creating,
    newInvite,
    createInvite,
    deleteInvite,
    confirmDialog,
  };
}

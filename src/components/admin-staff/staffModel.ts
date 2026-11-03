import type { Tone } from "@/components/ui/tone";
import type { InviteDTO } from "./types";

const ROLE: Readonly<Record<string, { label: string; tone: Tone }>> = {
  ADMIN: { label: "Admin", tone: "primary" },
  WAITER: { label: "Garson", tone: "info" },
};

export function roleMeta(role: string) {
  return ROLE[role] ?? { label: role, tone: "neutral" as Tone };
}

/** Davet durumu: kullanıldı / süresi doldu / bekliyor */
export function inviteStatus(invite: InviteDTO, now: number): { label: string; tone: Tone; open: boolean } {
  if (invite.isUsed) return { label: "✅ Kullanıldı", tone: "success", open: false };
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < now) {
    return { label: "⌛ Süresi doldu", tone: "danger", open: true };
  }
  return { label: "⏳ Bekliyor", tone: "warning", open: true };
}

/** Davet QR boyutu (px): telefon kamerası rahat okusun */
export const INVITE_QR_SIZE = 320;

/** WhatsApp paylaşım bağlantısı (metin + link) */
export function whatsappShareUrl(businessName: string | null | undefined, inviteUrl: string): string {
  const text = `${businessName ?? "İşletmemize"} garson olarak katılmak için bu linke tıklayın: ${inviteUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

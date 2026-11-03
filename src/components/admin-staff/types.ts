/** Personel ve garson davetleri sözleşmesi. Kaynak: /api/admin/staff, /api/admin/waiter-invites */

export type StaffRole = "ADMIN" | "WAITER";

export interface StaffMemberDTO {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: StaffRole | string;
  readonly isActive: boolean;
}

/** Davet kaydı: link yalnız oluşturulurken bir kez gösterilir, burada yok */
export interface InviteDTO {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly usedAt: string | null;
  readonly isUsed: boolean;
}

/** Yeni oluşturulan davet: link + QR (yalnız bu oturumda bellekte) */
export interface NewInvite {
  readonly url: string;
  readonly qrDataUrl: string;
  readonly expiresAt: string | null;
}

import { apiRequest, isRecord } from "@/lib/api-client";

/** Hesap uçları: ekranlar fetch yerine bu tipli fonksiyonları çağırır (FE-ARCH-2.1) */

const REGISTER_ERROR = "Kayıt sırasında bir hata oluştu";

export interface StaffRegistration {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly phone: string | null;
  readonly inviteCode: string;
}

export interface BusinessSignup {
  readonly businessName: string;
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly phone: string;
  readonly planCode: string | null;
}

export const registerStaff = (input: StaffRegistration) =>
  apiRequest<unknown>("/api/auth/register", { method: "POST", body: input, fallbackError: REGISTER_ERROR });

export const signupBusiness = (input: BusinessSignup) =>
  apiRequest<unknown>("/api/auth/signup", { method: "POST", body: input, fallbackError: REGISTER_ERROR });

export interface CurrentUserDTO {
  readonly user?: { readonly role?: string };
}

export const getCurrentUser = () => apiRequest<CurrentUserDTO | null>("/api/auth/me");

export type InviteInvalidReason = "INVALID" | "USED" | "EXPIRED" | "ERROR";

export type InviteCheck =
  | { readonly valid: true; readonly businessName: string; readonly expiresAt: string }
  | { readonly valid: false; readonly reason: InviteInvalidReason };

const SERVER_REASONS: readonly string[] = ["INVALID", "USED", "EXPIRED"] satisfies readonly InviteInvalidReason[];
const isServerReason = (value: unknown): value is InviteInvalidReason =>
  typeof value === "string" && SERVER_REASONS.includes(value);

/** Davet kodunu doğrular; yanıt okunamazsa (ağ hatası, boş ya da HTML yanıt) "ERROR" */
export async function verifyInvite(code: string): Promise<InviteCheck> {
  const result = await apiRequest<unknown>("/api/auth/invite/verify", { method: "POST", body: { code } });
  const payload = result.ok ? result.data : result.body;
  if (!isRecord(payload)) return { valid: false, reason: "ERROR" };
  if (payload.valid === true && typeof payload.businessName === "string" && typeof payload.expiresAt === "string") {
    return { valid: true, businessName: payload.businessName, expiresAt: payload.expiresAt };
  }
  return { valid: false, reason: isServerReason(payload.reason) ? payload.reason : "INVALID" };
}

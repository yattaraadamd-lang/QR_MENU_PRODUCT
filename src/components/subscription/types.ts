/** Abonelik ekranı sözleşmesi. Kaynak: /api/admin/subscription, /api/admin/billing/* */

export interface UsageDTO {
  readonly current: number;
  /** null: sınırsız */
  readonly limit: number | null;
}

export interface PlanDTO {
  readonly id: string;
  readonly code: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly monthlyPrice: number;
  readonly maxTables: number | null;
  readonly maxWaiters: number | null;
  readonly maxProducts: number | null;
  readonly hasReports: boolean;
  readonly hasPayments: boolean;
  /** Online ödemesi tanımlı mı */
  readonly canPurchase: boolean;
}

export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";

export interface SubscriptionDTO {
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: string | null;
  readonly endsAt: string | null;
  /** false: yeni masa/ürün/garson eklenemez */
  readonly isValid: boolean;
  readonly plan: { readonly code: string | null; readonly name: string; readonly monthlyPrice: number } | null;
}

export interface SubscriptionData {
  readonly subscription: SubscriptionDTO | null;
  readonly usage: { readonly tables: UsageDTO; readonly waiters: UsageDTO; readonly products: UsageDTO };
  readonly plans: readonly PlanDTO[];
}

/** iyzico fatura bilgisi (kart bilgisi iyzico sayfasında alınır, bize gelmez) */
export interface BillingCustomer {
  readonly name: string;
  readonly surname: string;
  readonly gsmNumber: string;
  readonly identityNumber: string;
  readonly city: string;
  readonly address: string;
}

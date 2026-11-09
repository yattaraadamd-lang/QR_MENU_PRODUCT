import type * as Db from "@prisma/client";
import type { CustomerAuthorizationStatus } from "@/contracts/customer-session";
import type { CancelReasonCode, OrderPaymentStatus, OrderStatus } from "@/contracts/orders";
import type { PaymentMethod } from "@/contracts/payments";
import type { StockStatus } from "@/contracts/products";
import type { RequestStatus, ServiceRequestType } from "@/contracts/requests";
import type { SubscriptionStatus } from "@/contracts/subscription";
import type { BillPaymentStatus, TableStatus } from "@/contracts/tables";
import type { UserRole } from "@/contracts/users";

/** İki birleşim aynı değerleri taşıyorsa true */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type InSync<T extends true> = T;

/**
 * Sözleşmedeki enum'lar Prisma şemasıyla aynı kalır (FE-ARCH-3.1). Şemaya değer eklenir ya da
 * çıkarılırsa tsc ilgili satırda "Type 'false' does not satisfy the constraint 'true'" der:
 * src/contracts'taki birleşimi ve ekrandaki etiket tablosunu (ör. TABLE_STATUS) güncelleyin.
 * Yalnız tip; çalışma anında kodu yoktur.
 */
export interface ContractEnumsInSync {
  readonly TableStatus: InSync<Same<TableStatus, Db.TableStatus>>;
  readonly BillPaymentStatus: InSync<Same<BillPaymentStatus, Db.BillPaymentStatus>>;
  readonly OrderStatus: InSync<Same<OrderStatus, Db.OrderStatus>>;
  readonly OrderPaymentStatus: InSync<Same<OrderPaymentStatus, Db.OrderPaymentStatus>>;
  readonly OrderCancelReasonCode: InSync<Same<CancelReasonCode, Db.OrderCancelReasonCode>>;
  readonly RequestStatus: InSync<Same<RequestStatus, Db.RequestStatus>>;
  readonly ServiceRequestType: InSync<Same<ServiceRequestType, Db.ServiceRequestType>>;
  readonly PaymentMethod: InSync<Same<PaymentMethod, Db.PaymentMethod>>;
  readonly StockStatus: InSync<Same<StockStatus, Db.StockStatus>>;
  readonly SubscriptionStatus: InSync<Same<SubscriptionStatus, Db.SubscriptionStatus>>;
  readonly UserRole: InSync<Same<UserRole, Db.UserRole>>;
  readonly CustomerAuthorizationStatus: InSync<Same<CustomerAuthorizationStatus, Db.CustomerAuthorizationStatus>>;
}

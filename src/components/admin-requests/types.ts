/** Admin talepleri sözleşmesi. Kaynak: /api/service-requests (tüm durumlar, ödeme talepleri hariç) */

import type { ServiceRequestDTO } from "@/components/waiter-requests/types";

export interface AdminServiceRequestDTO extends ServiceRequestDTO {
  /** Müşterinin ekranındaki masa açma kodu: admin kodu yazmadan onaylar */
  readonly verificationCode: string | null;
  readonly completedAt: string | null;
}

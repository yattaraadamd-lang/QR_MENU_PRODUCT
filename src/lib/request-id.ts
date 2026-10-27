import { headers as incomingHeaders } from "next/headers";

/**
 * Middleware'in isteğe yazdığı x-request-id. İsteğe doğrudan erişimi olmayan servisler
 * (ödeme, iptal, audit log, logger) kimliği buradan alır; istek kapsamı dışında (betikler) null.
 */
export async function currentRequestId(): Promise<string | null> {
  try {
    return (await incomingHeaders()).get("x-request-id");
  } catch {
    return null;
  }
}

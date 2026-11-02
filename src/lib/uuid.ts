const UUID_BYTES = 16;

/**
 * RFC 4122 v4 kimlik (idempotency anahtarı). crypto.randomUUID yalnız güvenli bağlamda
 * (https/localhost) var; panel yerel ağ IP'sinden açılırsa getRandomValues'a düşer.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTES));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // sürüm 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 varyantı
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

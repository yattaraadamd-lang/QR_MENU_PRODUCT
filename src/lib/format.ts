const TRY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const CLOCK = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

/** "14:05" — ISO metni ya da Date */
export function formatClock(value: string | Date): string {
  return CLOCK.format(typeof value === "string" ? new Date(value) : value);
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** Yakın geçmiş: "40sn önce", "12dk önce"; bir saatten eskiyse saat ("14:05") */
export function formatTimeAgo(since: string | Date, now: number): string {
  const date = typeof since === "string" ? new Date(since) : since;
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}sn önce`;
  if (seconds < SECONDS_PER_HOUR) return `${Math.floor(seconds / SECONDS_PER_MINUTE)}dk önce`;
  return formatClock(date);
}

/** İki an arası süre: "45 dk", "1 sa 20 dk" */
export function formatElapsed(since: string | Date, now: number): string {
  const start = (typeof since === "string" ? new Date(since) : since).getTime();
  const minutes = Math.max(0, Math.floor((now - start) / MS_PER_MINUTE));
  if (minutes < MINUTES_PER_HOUR) return `${minutes} dk`;
  return `${Math.floor(minutes / MINUTES_PER_HOUR)} sa ${minutes % MINUTES_PER_HOUR} dk`;
}

/** "₺1.250,50" — sayı, Prisma Decimal ya da string kabul eder; geçersizse ₺0,00 */
export function formatTRY(value: number | string | { toString(): string } | null | undefined): string {
  const n = Number(value ?? 0);
  return TRY.format(Number.isFinite(n) ? n : 0);
}

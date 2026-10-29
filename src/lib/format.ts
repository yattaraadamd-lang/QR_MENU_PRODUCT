const TRY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });

/** "₺1.250,50" — sayı, Prisma Decimal ya da string kabul eder; geçersizse ₺0,00 */
export function formatTRY(value: number | string | { toString(): string } | null | undefined): string {
  const n = Number(value ?? 0);
  return TRY.format(Number.isFinite(n) ? n : 0);
}

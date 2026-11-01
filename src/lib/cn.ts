/** Sınıf adlarını birleştirir; false/null/undefined/"" parçaları atlar. */
export function cn(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

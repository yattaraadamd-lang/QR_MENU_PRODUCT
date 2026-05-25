/** Haversine — iki koordinat arası mesafe (metre). */
export function getDistanceFromLatLonInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export type BusinessLocationFields = {
  latitude: number | null;
  longitude: number | null;
  allowedRadiusMeters?: number | null;
};

/** SaaS varsayılanı: konum kilidi kapalı. Sadece ENABLE_LOCATION_LOCK=true ise açılır. */
export function isLocationLockEnabled(): boolean {
  return process.env.ENABLE_LOCATION_LOCK === "true";
}

export function businessHasLocationConfigured(business: BusinessLocationFields): boolean {
  return business.latitude != null && business.longitude != null;
}

/**
 * Konum kilidi açıksa ve işletme koordinatı tanımlıysa mesafeyi doğrular.
 * Varsayılan: engelleme yok (null = izin verildi).
 */
export function validateCustomerLocation(
  business: BusinessLocationFields,
  customerLat?: number | null,
  customerLng?: number | null
): { allowed: true } | { allowed: false; error: string } {
  if (!isLocationLockEnabled() || !businessHasLocationConfigured(business)) {
    return { allowed: true };
  }

  const radius = business.allowedRadiusMeters ?? 100;

  if (customerLat == null || customerLng == null) {
    return {
      allowed: false,
      error:
        "Konum kilidi açık. Sipariş için konum erişimine izin verin veya işletme ayarlarından konum kilidini kapatın.",
    };
  }

  const distance = getDistanceFromLatLonInMeters(
    business.latitude!,
    business.longitude!,
    customerLat,
    customerLng
  );

  if (distance > radius) {
    return {
      allowed: false,
      error: `İşletme alanı dışındasınız (yaklaşık ${Math.round(distance)} m). Lütfen restoran içinden tekrar deneyin.`,
    };
  }

  return { allowed: true };
}

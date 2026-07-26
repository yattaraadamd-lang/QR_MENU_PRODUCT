/**
 * Konum Kontrol Utilities
 * 
 * İşletme konumu ile müşteri konumu arasındaki mesafeyi hesaplar
 * ve izin verilen yarıçap içinde olup olmadığını kontrol eder.
 */

/**
 * İki GPS koordinatı arasındaki mesafeyi hesaplar (Haversine formülü)
 * @param lat1 Birinci nokta latitude
 * @param lon1 Birinci nokta longitude
 * @param lat2 İkinci nokta latitude
 * @param lon2 İkinci nokta longitude
 * @returns Mesafe (metre cinsinden)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Dünya yarıçapı (metre)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Metre cinsinden mesafe
}

/**
 * Müşteri konumunun işletme yarıçapı içinde olup olmadığını kontrol eder
 * @param businessLat İşletme latitude
 * @param businessLon İşletme longitude
 * @param customerLat Müşteri latitude
 * @param customerLon Müşteri longitude
 * @param allowedRadiusMeters İzin verilen yarıçap (metre)
 * @returns { withinRadius: boolean, distance: number }
 */
export function isWithinBusinessRadius(
  businessLat: number,
  businessLon: number,
  customerLat: number,
  customerLon: number,
  allowedRadiusMeters: number
): { withinRadius: boolean; distance: number } {
  const distance = calculateDistance(
    businessLat,
    businessLon,
    customerLat,
    customerLon
  );

  return {
    withinRadius: distance <= allowedRadiusMeters,
    distance: Math.round(distance),
  };
}

/**
 * Request'ten konum bilgisini çıkarır
 * @param request NextRequest
 * @returns { latitude: number, longitude: number } | null
 */
export function extractLocationFromRequest(
  latitude?: string | null,
  longitude?: string | null
): { latitude: number; longitude: number } | null {
  if (!latitude || !longitude) return null;

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return { latitude: lat, longitude: lon };
}

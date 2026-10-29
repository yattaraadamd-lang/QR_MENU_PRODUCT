import CustomerMenu from "@/components/customer-menu/CustomerMenu";
import { MenuAccessError } from "@/components/customer-menu/MenuStatusScreens";
import type { MenuResponse } from "@/components/customer-menu/types";
import { getRequestLogger } from "@/lib/logger";
import { getPublicMenu } from "@/lib/services/public-menu.service";

// Menü (stok, fiyat, masa durumu) her istekte güncel okunur; sayfa önbelleğe alınmaz
export const dynamic = "force-dynamic";

/**
 * Müşteri menüsü sunucuda çizilir: ürünler ilk HTML'de gelir, JS beklemeden okunur
 * (eskiden HTML → JS → /api/menu sırasıyla yükleniyor göstergesinde kalıyordu).
 * Oturum, sepet ve canlı güncellemeler istemci bileşeninde (CustomerMenu).
 */
export default async function MenuPage({ params }: { params: Promise<{ businessId: string; tableNumber: string }> }) {
  const { businessId, tableNumber } = await params;

  let result: Awaited<ReturnType<typeof getPublicMenu>>;
  try {
    result = await getPublicMenu(businessId, tableNumber);
  } catch (error) {
    const log = await getRequestLogger({ route: "menu-page" });
    log.error({ err: error, businessId }, "Menü sayfası sunucuda yüklenemedi");
    return <MenuAccessError message="Menü yüklenirken bir hata oluştu." />;
  }
  if (!result.ok) return <MenuAccessError message={result.error} />;

  const data = JSON.parse(result.body) as MenuResponse;
  // key: istemci içinde başka masaya geçilince bileşen (sepet, oturum) yeniden kurulur
  return (
    <CustomerMenu
      key={`${businessId}/${tableNumber}`}
      businessId={businessId}
      tableNumber={tableNumber}
      initialMenu={{ data: { ...data, categories: data.categories || [] }, etag: result.etag }}
    />
  );
}

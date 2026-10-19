import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Tek bir varsayılan grup: arama motorları ve yapay zekâ botları aynı kuralları görür.
// /api/ ve /qr/ kapalı: QR sayfası açılışta müşteri oturumu oluşturur, JS çalıştıran
// botların veritabanına yazmasını istemiyoruz. /menu/ ve /auth/ taranabilir ama noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/qr/", "/admin", "/waiter", "/super-admin", "/dashboard"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

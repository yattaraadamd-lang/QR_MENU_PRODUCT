import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Yalnızca dizine eklenmesi istenen sayfalar. Giriş/kayıt, müşteri menüsü ve panel
// sayfaları noindex olduğu için burada yer almaz.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: "weekly", priority: 1 }];
}

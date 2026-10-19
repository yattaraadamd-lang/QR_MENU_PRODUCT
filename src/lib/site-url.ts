// Canonical, robots.txt ve sitemap için kök URL. Sonunda "/" olmaz.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://qr-menu-product.onrender.com"
).replace(/\/+$/, "");

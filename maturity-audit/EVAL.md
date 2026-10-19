# Ajan davranış değerlendirmeleri (E) ve MCP (C)

**Durum: UYGULANAMAZ.**

Gerekçe (kanıt): Repoda MCP sunucusu, araç (tool) tanımı ya da OpenAPI şeması yok. `modelcontextprotocol|mcp` araması `src/`, `server.js` ve `package.json` içinde sonuç vermedi; yalnızca lockfile'daki bir integrity hash'i eşleşti. Ürün, LLM istemcilerine araç sunmuyor.

Dolayısıyla şu testler yapılmadı:
- C: initialize / tools/list / tools/call, şema geçerliliği, Claude/OpenAI/Gemini format dönüşümü
- D (araç kısmı): araç argümanlarının fuzz testi
- E: 50+ senaryo × 3 model × 5 tekrar, pass^k

## Bir MCP sunucusu eklenirse
Doğal ilk araçlar ve beklenen kurallar:

| Araç | Tür | Not |
|---|---|---|
| `get_menu(businessSlug)` | salt-okunur, idempotent | Herkese açık kategori ve ürünler; `/api/public/[businessSlug]/categories` ile aynı ID ve fiyatlar |
| `get_business_info(slug)` | salt-okunur | `/api/business/[slug]` |
| `create_order_request(...)` | **yazma** | Kullanıcıdan açık onay, müşteri oturum token'ı ve idempotency anahtarı gerekir. Mevcut doğrulama kodu akışı korunmalı. |

Bu noktada E kategorisi senaryoları (Türkçe: "menüde vegan ne var", "2 latte sipariş et", "siparişi iptal et", "hesabı iste") yazılmalı ve bu dosya ölçümlerle güncellenmeli.

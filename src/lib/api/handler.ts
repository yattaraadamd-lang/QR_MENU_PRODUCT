/**
 * Route handler'lar için ortak gövde doğrulaması ve hata yanıtı
 *
 * Bozuk JSON, null gövde ya da yanlış tipte alan route içinde patlayıp 500 dönmesin diye
 * gövde parseJson ile okunur; hata ApiError olarak withApiHandler'a çıkar ve 400 olur.
 *
 * Yanıt zarfı geriye uyumludur: `error` metin olarak kalır (istemci `data.error` okuyor),
 * yanına makine tarafından okunabilir `code` ve log'la eşleştirmek için `requestId` eklenir.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Çıktı tipi T; girdi serbest (z.preprocess'li şemalar da kabul edilir)
type Schema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;
import { logger } from "@/lib/logger";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Zod'un İngilizce varsayılan mesajlarının yerine geçer; şemada verilen mesajlar önceliklidir
const turkishErrorMap: z.ZodErrorMap = (issue) => ({
  message: issue.path.length > 0 ? `Geçersiz alan: ${issue.path.join(".")}` : "Geçersiz istek gövdesi.",
});

/**
 * İsteğin JSON gövdesini okur ve şemayla doğrular; başarısızlıkta 400 ApiError fırlatır.
 * `optional`: gövdesiz istek ({} olarak doğrulanır) geçerlidir — gövdeyi bilerek isteğe bağlı
 * tutan uçlar için (ör. not alanı olan iptal/onay işlemleri). Bozuk JSON yine 400'dür.
 */
export async function parseJson<T>(
  request: Request,
  schema: Schema<T>,
  options: { optional?: boolean } = {}
): Promise<T> {
  let body: unknown;
  try {
    const text = await request.text();
    body = options.optional && text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Geçersiz istek gövdesi.");
  }

  return validate(schema, body);
}

/** NUL ya da eşi olmayan surrogate içeriyor mu — Postgres bunları yazamıyor/sorgulayamıyor (500) */
export function hasUnstorableChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0) return true;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return true;
    }
    if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

/**
 * Gövdedeki tüm metinleri (anahtarlar dahil) tarar. Her şemadaki her metin alanına ayrı kural
 * yazmak yerine tek yerde: NUL / eşsiz surrogate içeren bir değer Prisma'ya hiç ulaşmaz.
 */
function findUnstorableString(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      if (hasUnstorableChars(current)) return true;
    } else if (Array.isArray(current)) {
      for (const item of current) stack.push(item); // spread çok büyük dizide argüman sınırını aşar
    } else if (current !== null && typeof current === "object") {
      for (const [key, item] of Object.entries(current)) {
        if (hasUnstorableChars(key)) return true;
        stack.push(item);
      }
    }
  }
  return false;
}

/**
 * Sorgu parametrelerini şemayla doğrular; başarısızlıkta 400 ApiError fırlatır.
 * Tekrarlanan anahtarda ilk değer alınır (searchParams.get ile aynı).
 */
export function parseQuery<T>(request: NextRequest, schema: Schema<T>): T {
  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    if (!(key in query)) query[key] = value;
  });
  return validate(schema, query);
}

function validate<T>(schema: Schema<T>, data: unknown): T {
  if (findUnstorableString(data)) {
    throw new ApiError(400, "INVALID_CHARACTERS", "İstek geçersiz karakter içeriyor.");
  }
  const result = schema.safeParse(data, { errorMap: turkishErrorMap });
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", result.error.issues[0]?.message ?? "Geçersiz istek.");
  }
  return result.data;
}

const SLOW_REQUEST_MS = 1000;

/**
 * Route handler'ı sarar: ApiError kendi durum koduyla, beklenmeyen hata 500 ile döner.
 * 500 yanıtında iç ayrıntı (stack, Prisma mesajı) yer almaz; log requestId ile aranır.
 *
 * Her istek için tek log satırı (method, path, status, durationMs): 5xx error, yavaş (≥1 sn)
 * warn, 4xx info, diğerleri debug — müşteri ekranları sürekli yokladığı için başarılı istekler
 * production'da varsayılan olarak yazılmaz (LOG_LEVEL=debug ile açılır).
 *
 * İki imza: parametresiz route'lar `(request)`, [id] route'ları `(request, context)` alır.
 * Next 15'in route tip kontrolü tek parametreli handler'ı ancak dönen fonksiyon da tek
 * parametreliyse kabul ediyor; bu yüzden tek bir generic imza yerine aşırı yükleme.
 */
export function withApiHandler(
  name: string,
  handler: (request: NextRequest) => Promise<Response>
): (request: NextRequest) => Promise<Response>;
export function withApiHandler<C>(
  name: string,
  handler: (request: NextRequest, context: C) => Promise<Response>
): (request: NextRequest, context: C) => Promise<Response>;
export function withApiHandler(
  name: string,
  handler: (request: NextRequest, context?: any) => Promise<Response>
) {
  return async (request: NextRequest, context?: unknown) => {
    const startedAt = Date.now();
    // Middleware'in ürettiği kimlik: yanıt başlığı, bu gövde, log ve audit kaydı aynı değeri taşır
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const log = logger.child({ requestId, route: name });

    let response: Response;
    let unhandled: unknown;
    try {
      response = await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        response = NextResponse.json(
          { error: error.message, code: error.code, requestId },
          { status: error.status, headers: { "Cache-Control": "no-store, private" } }
        );
      } else {
        unhandled = error;
        response = NextResponse.json(
          { error: "Sunucu hatası. Lütfen tekrar deneyin.", code: "INTERNAL_ERROR", requestId },
          { status: 500, headers: { "Cache-Control": "no-store, private" } }
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    const entry = {
      method: request.method,
      path: request.nextUrl.pathname,
      status: response.status,
      durationMs,
      ...(unhandled !== undefined ? { err: unhandled } : {}),
    };
    if (response.status >= 500) log.error(entry, unhandled !== undefined ? "İşlenmeyen hata" : "Sunucu hatası yanıtı");
    else if (durationMs >= SLOW_REQUEST_MS) log.warn(entry, "Yavaş istek");
    else if (response.status >= 400) log.info(entry, "İstemci hatası");
    else log.debug(entry, "İstek");

    return response;
  };
}

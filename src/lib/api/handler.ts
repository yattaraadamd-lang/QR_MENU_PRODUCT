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
import { z, type ZodSchema } from "zod";

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

/** İsteğin JSON gövdesini okur ve şemayla doğrular; başarısızlıkta 400 ApiError fırlatır. */
export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Geçersiz istek gövdesi.");
  }

  return validate(schema, body);
}

/**
 * Sorgu parametrelerini şemayla doğrular; başarısızlıkta 400 ApiError fırlatır.
 * Tekrarlanan anahtarda ilk değer alınır (searchParams.get ile aynı).
 */
export function parseQuery<T>(request: NextRequest, schema: ZodSchema<T>): T {
  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    if (!(key in query)) query[key] = value;
  });
  return validate(schema, query);
}

function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data, { errorMap: turkishErrorMap });
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", result.error.issues[0]?.message ?? "Geçersiz istek.");
  }
  return result.data;
}

/**
 * Route handler'ı sarar: ApiError kendi durum koduyla, beklenmeyen hata 500 ile döner.
 * 500 yanıtında iç ayrıntı (stack, Prisma mesajı) yer almaz; log requestId ile aranır.
 */
export function withApiHandler(
  name: string,
  handler: (request: NextRequest) => Promise<Response>
): (request: NextRequest) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      // Middleware'in ürettiği kimlik: yanıt başlığı, bu gövde, log ve audit kaydı aynı değeri taşır
      const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code, requestId },
          { status: error.status, headers: { "Cache-Control": "no-store, private" } }
        );
      }

      console.error(`[${name}]`, {
        requestId,
        code: (error as { code?: string })?.code,
        message: (error as Error)?.message,
      });
      return NextResponse.json(
        { error: "Sunucu hatası. Lütfen tekrar deneyin.", code: "INTERNAL_ERROR", requestId },
        { status: 500, headers: { "Cache-Control": "no-store, private" } }
      );
    }
  };
}

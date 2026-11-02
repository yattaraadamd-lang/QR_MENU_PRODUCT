/**
 * Ekranların API istemcisi: ağ hatası ve hata gövdesi tek tip sonuca çevrilir,
 * böylece servisler try/catch yazmaz, ekran yalnız `ok`'a bakar.
 */

export type ApiErrorBody = Readonly<Record<string, unknown>>;

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: string;
      /** 0: yanıt hiç gelmedi (ağ hatası ya da iptal) */
      readonly status: number;
      readonly body: ApiErrorBody | null;
      readonly aborted: boolean;
    };

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  /** Sunucu hata metni dönmezse gösterilecek mesaj */
  readonly fallbackError?: string;
}

export const NETWORK_ERROR = "Bağlantı hatası. Lütfen tekrar deneyin.";
const DEFAULT_ERROR = "İşlem tamamlanamadı.";

function isRecord(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(body: ApiErrorBody | null, fallback: string): string {
  const message = body?.error ?? body?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export async function apiRequest<T>(url: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, signal, fallbackError = DEFAULT_ERROR } = options;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal,
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    if (!aborted) console.error(`[api] ${method} ${url}`, e);
    return { ok: false, error: NETWORK_ERROR, status: 0, body: null, aborted };
  }

  const json: unknown = await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: json as T };

  const errorBody = isRecord(json) ? json : null;
  return {
    ok: false,
    error: errorMessage(errorBody, fallbackError),
    status: res.status,
    body: errorBody,
    aborted: false,
  };
}

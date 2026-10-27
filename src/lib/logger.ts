/**
 * Yapılandırılmış log — pino, JSON satırları stdout'a (Render log akışı satır satır okur)
 *
 * - Her satırda level, time, service, env; istek kapsamında requestId (getRequestLogger ya da
 *   withApiHandler'ın alt logger'ı) — yanıt başlığındaki x-request-id ve audit kaydıyla aynı
 * - Hassas alanlar "[REDACTED]" olur (iki seviyeye kadar iç içe)
 * - Prisma hataları yalnız kodu, çağrıyı ve son satırdaki nedeni taşır: tam mesaj ve stack sorgu
 *   argümanlarını (e-posta, token hash'i) içerebiliyor
 *
 * Seviye: LOG_LEVEL (varsayılan production'da info, aksi halde debug).
 * Yerelde okunur çıktı: npm run dev | npx pino-pretty
 */

import pino, { type DestinationStream, type Logger } from "pino";
import { currentRequestId } from "./request-id";

const SENSITIVE_KEYS = [
  "password",
  "token",
  "sessionToken",
  "accessToken",
  "authorization",
  "cookie",
  "secret",
  "inviteCode",
  "verificationCode",
  "qrToken",
  "identityNumber",
  "deviceKey",
  "rawDeviceKey",
];

const REDACT_PATHS = [
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
  'headers["x-session-token"]',
  '*.headers["x-session-token"]',
];

function serializeError(err: unknown) {
  if (!(err instanceof Error)) return err;

  if (err.name.startsWith("PrismaClient")) {
    const lines = err.message.split("\n").map((line) => line.trim()).filter(Boolean);
    return {
      type: err.name,
      code: (err as { code?: string }).code,
      prismaCall: err.message.match(/Invalid `prisma\.(\w+\.\w+)\(\)` invocation/)?.[1],
      message: lines[lines.length - 1],
    };
  }

  return pino.stdSerializers.err(err);
}

/** Testler kendi hedef akışını verir; uygulama varsayılan stdout'u kullanır */
export function createLogger(destination?: DestinationStream): Logger {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
      base: { service: "qr-menu-platform", env: process.env.APP_ENV ?? process.env.NODE_ENV },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
      serializers: { err: serializeError, error: serializeError },
    },
    destination
  );
}

export const logger = createLogger();

/** İstek kapsamındaki kod (servisler) için: middleware'in x-request-id'si bağlı alt logger */
export async function getRequestLogger(bindings: Record<string, unknown> = {}): Promise<Logger> {
  return logger.child({ ...bindings, requestId: await currentRequestId() });
}

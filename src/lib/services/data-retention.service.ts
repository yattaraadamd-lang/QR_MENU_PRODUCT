/**
 * Kişisel veri saklama işi: süresi dolan verileri siler veya anonim hale getirir.
 * Süreler Gizlilik Politikası madde 3 ve 5 ile aynı olmalı; biri değişirse diğeri de değişir.
 *
 * Geri alınamaz olduğu için varsayılan kapalıdır (src/instrumentation.ts, DATA_RETENTION_MODE):
 *   dry-run → silinecek kayıt sayılarını loglar, veritabanına yazmaz
 *   apply   → ayda bir çalışır, her çalışma data_retention_runs tablosuna yazılır (imha kaydı)
 *
 * Render ücretsiz planda cron yok ve süreç boştayken uyuyor: iş uygulama açılışında ve açık kaldığı
 * sürece günde bir yoklanır, son başarılı çalışmanın üzerinden bir ay geçtiyse başlar.
 */

import "server-only";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = {
  deletedStaff: 30,
  guestNote: 90,
  customerSession: 90,
  notification: 90,
  revokedDeviceBlock: 30,
  deviceBlock: 365,
  auditLog: 730,
  tableEvent: 730,
  retentionRun: 3 * 365,
} as const;

export const ANONYMOUS_STAFF_NAME = "Silinmiş Personel";
const ANONYMOUS_EMAIL_DOMAIN = "anon.invalid";
// bcrypt özeti değil: hiçbir parola bununla eşleşmez
const UNUSABLE_PASSWORD = "!anonymized";

const RUN_INTERVAL_MS = 30 * DAY_MS;
// Süreç iş sırasında kapanırsa kayıt yarım kalır: bu süreden eski yarım kayıt yeniden denemeyi engellemez
const STALE_RUN_MS = 60 * 60 * 1000;
const ADVISORY_LOCK_KEY = 727_201;

const BATCH_SIZE = 500;
const BATCH_PAUSE_MS = 50;
const IDS = { select: { id: true }, take: BATCH_SIZE } as const;

export type RetentionMode = "dry-run" | "apply";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Canlı veritabanı uzak ve yavaş anları oluyor: uzun tek sorgu yerine küçük parçalar. findIds işlenen
 * satırı bir daha döndürmemeli (koşulu değişen ya da silinen satırlar), yoksa döngü bitmez.
 */
async function inBatches(findIds: () => Promise<{ id: string }[]>, apply: (ids: string[]) => Promise<unknown>) {
  let total = 0;
  for (;;) {
    const ids = (await findIds()).map((row) => row.id);
    if (ids.length === 0) return total;
    await apply(ids);
    total += ids.length;
    if (ids.length < BATCH_SIZE) return total;
    await sleep(BATCH_PAUSE_MS);
  }
}

const inIds = (ids: string[]) => ({ where: { id: { in: ids } } });

/** Silinen Personel: kimlik alanları ve başka tablolara kopyalanan adı anonim olur, kullanıcı kimliği kalır */
async function anonymizeUser(userId: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: ANONYMOUS_STAFF_NAME,
        email: `deleted-${userId}@${ANONYMOUS_EMAIL_DOMAIN}`,
        phone: null,
        password: UNUSABLE_PASSWORD,
      },
    }),
    prisma.payment.updateMany({ where: { handledById: userId }, data: { handledByWaiterName: ANONYMOUS_STAFF_NAME } }),
    prisma.payment.updateMany({ where: { requestedById: userId }, data: { requestedByName: ANONYMOUS_STAFF_NAME } }),
    prisma.payment.updateMany({ where: { approvedById: userId }, data: { approvedByName: ANONYMOUS_STAFF_NAME } }),
    // Audit kaydında e-postanın kendisini taşıyan tek işlem: USER_EMAIL_CHANGED
    prisma.auditLog.updateMany({
      where: { entityType: "User", entityId: userId, action: "USER_EMAIL_CHANGED" },
      data: { beforeJson: Prisma.DbNull, afterJson: Prisma.DbNull },
    }),
  ]);
}

/** Her adım tekrarlanabilir: işlenen kayıt koşuldan çıkar, yarıda kalan işi sonraki çalışma tamamlar */
function retentionSteps(now: Date) {
  const before = (days: number) => ({ lt: new Date(now.getTime() - days * DAY_MS) });

  const deletedStaff = {
    deletedAt: before(RETENTION_DAYS.deletedStaff),
    NOT: { email: { endsWith: `@${ANONYMOUS_EMAIL_DOMAIN}` } },
  } satisfies Prisma.UserWhereInput;
  const orderNote = {
    createdAt: before(RETENTION_DAYS.guestNote),
    note: { not: null },
  } satisfies Prisma.OrderWhereInput;
  const orderItemNote = {
    customerNote: { not: null },
    order: { createdAt: before(RETENTION_DAYS.guestNote) },
  } satisfies Prisma.OrderItemWhereInput;
  // orderPreview ürün ve sipariş notlarını da taşır
  const requestNote = {
    createdAt: before(RETENTION_DAYS.guestNote),
    OR: [{ note: { not: null } }, { reason: { not: null } }, { orderPreview: { not: Prisma.AnyNull } }],
  } satisfies Prisma.ServiceRequestWhereInput;
  const customerSession = { lastSeenAt: before(RETENTION_DAYS.customerSession) } satisfies Prisma.CustomerSessionWhereInput;
  const notification = { createdAt: before(RETENTION_DAYS.notification) } satisfies Prisma.NotificationWhereInput;
  const deviceBlock = {
    OR: [{ createdAt: before(RETENTION_DAYS.deviceBlock) }, { revokedAt: before(RETENTION_DAYS.revokedDeviceBlock) }],
  } satisfies Prisma.CustomerAccessBlockWhereInput;
  const auditLog = { createdAt: before(RETENTION_DAYS.auditLog) } satisfies Prisma.AuditLogWhereInput;
  const tableEvent = { createdAt: before(RETENTION_DAYS.tableEvent) } satisfies Prisma.TableEventWhereInput;
  const retentionRun = { startedAt: before(RETENTION_DAYS.retentionRun) } satisfies Prisma.DataRetentionRunWhereInput;

  return {
    deletedStaff: {
      count: () => prisma.user.count({ where: deletedStaff }),
      run: () =>
        inBatches(
          () => prisma.user.findMany({ where: deletedStaff, ...IDS }),
          async (ids) => {
            for (const id of ids) await anonymizeUser(id);
          }
        ),
    },
    orderNotes: {
      count: () => prisma.order.count({ where: orderNote }),
      run: () =>
        inBatches(
          () => prisma.order.findMany({ where: orderNote, ...IDS }),
          (ids) => prisma.order.updateMany({ ...inIds(ids), data: { note: null } })
        ),
    },
    orderItemNotes: {
      count: () => prisma.orderItem.count({ where: orderItemNote }),
      run: () =>
        inBatches(
          () => prisma.orderItem.findMany({ where: orderItemNote, ...IDS }),
          (ids) => prisma.orderItem.updateMany({ ...inIds(ids), data: { customerNote: null } })
        ),
    },
    serviceRequestNotes: {
      count: () => prisma.serviceRequest.count({ where: requestNote }),
      run: () =>
        inBatches(
          () => prisma.serviceRequest.findMany({ where: requestNote, ...IDS }),
          (ids) => prisma.serviceRequest.updateMany({ ...inIds(ids), data: { note: null, reason: null, orderPreview: Prisma.DbNull } })
        ),
    },
    customerSessions: {
      count: () => prisma.customerSession.count({ where: customerSession }),
      run: () =>
        inBatches(
          () => prisma.customerSession.findMany({ where: customerSession, ...IDS }),
          (ids) => prisma.customerSession.deleteMany(inIds(ids))
        ),
    },
    notifications: {
      count: () => prisma.notification.count({ where: notification }),
      run: () =>
        inBatches(
          () => prisma.notification.findMany({ where: notification, ...IDS }),
          (ids) => prisma.notification.deleteMany(inIds(ids))
        ),
    },
    deviceBlocks: {
      count: () => prisma.customerAccessBlock.count({ where: deviceBlock }),
      run: () =>
        inBatches(
          () => prisma.customerAccessBlock.findMany({ where: deviceBlock, ...IDS }),
          (ids) => prisma.customerAccessBlock.deleteMany(inIds(ids))
        ),
    },
    auditLogs: {
      count: () => prisma.auditLog.count({ where: auditLog }),
      run: () =>
        inBatches(
          () => prisma.auditLog.findMany({ where: auditLog, ...IDS }),
          (ids) => prisma.auditLog.deleteMany(inIds(ids))
        ),
    },
    tableEvents: {
      count: () => prisma.tableEvent.count({ where: tableEvent }),
      run: () =>
        inBatches(
          () => prisma.tableEvent.findMany({ where: tableEvent, ...IDS }),
          (ids) => prisma.tableEvent.deleteMany(inIds(ids))
        ),
    },
    retentionRuns: {
      count: () => prisma.dataRetentionRun.count({ where: retentionRun }),
      run: () =>
        inBatches(
          () => prisma.dataRetentionRun.findMany({ where: retentionRun, ...IDS }),
          (ids) => prisma.dataRetentionRun.deleteMany(inIds(ids))
        ),
    },
  };
}

type RetentionStep = keyof ReturnType<typeof retentionSteps>;
export type RetentionCounts = Record<RetentionStep, number>;

function stepEntries(now: Date) {
  return Object.entries(retentionSteps(now)) as [RetentionStep, { count: () => Promise<number>; run: () => Promise<number> }][];
}

/** Değişiklik yapmaz: çalışsaydı kaç kayıt etkilenirdi */
export async function previewDataRetention(now: Date = new Date()): Promise<RetentionCounts> {
  const counts = {} as RetentionCounts;
  for (const [name, step] of stepEntries(now)) counts[name] = await step.count();
  return counts;
}

/** Geri alınamaz. progress, hata anına kadar işlenenleri kayda geçirmek içindir */
export async function applyDataRetention(now: Date = new Date(), progress: Partial<RetentionCounts> = {}): Promise<RetentionCounts> {
  for (const [name, step] of stepEntries(now)) progress[name] = await step.run();
  return progress as RetentionCounts;
}

/**
 * Çalışma hakkı: son başarılı çalışma bir aydan eskiyse ve süren başka çalışma yoksa kayıt açar.
 * Kilit transaction'a bağlı: Supabase havuzunda oturum düzeyi kilit bağlantıyla birlikte kaybolur.
 */
async function claimRun(now: Date) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint)`;

    const lastSuccess = await tx.dataRetentionRun.findFirst({
      where: { finishedAt: { not: null }, error: null },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });
    if (lastSuccess && now.getTime() - lastSuccess.startedAt.getTime() < RUN_INTERVAL_MS) return null;

    const running = await tx.dataRetentionRun.findFirst({
      where: { finishedAt: null, startedAt: { gt: new Date(now.getTime() - STALE_RUN_MS) } },
      select: { id: true },
    });
    if (running) return null;

    return tx.dataRetentionRun.create({ data: { startedAt: now }, select: { id: true } });
  });
}

/** Zamanlayıcının çağırdığı adım. Çalışmadıysa null. Hatayı kaydeder ve yeniden fırlatır */
export async function runScheduledDataRetention(mode: RetentionMode, now: Date = new Date()): Promise<RetentionCounts | null> {
  const log = logger.child({ module: "data-retention", mode });

  if (mode === "dry-run") {
    const counts = await previewDataRetention(now);
    log.info({ counts }, "Saklama işi kuru çalıştırma: bu kayıtlar işlenecekti, değişiklik yapılmadı");
    return counts;
  }

  const run = await claimRun(now);
  if (!run) return null;

  const progress: Partial<RetentionCounts> = {};
  try {
    const counts = await applyDataRetention(now, progress);
    await prisma.dataRetentionRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), counts: { ...counts } },
    });
    log.info({ counts }, "Saklama işi tamamlandı");
    return counts;
  } catch (error) {
    // Yalnız hata türü ve kodu: Prisma mesajı sorgu argümanlarını (e-posta) içerebilir
    const code = (error as { code?: string }).code;
    await prisma.dataRetentionRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), counts: { ...progress }, error: [(error as Error).name, code].filter(Boolean).join(":") },
    });
    throw error;
  }
}

// Uyanan sürecin ilk isteklerini geciktirmesin
const BOOT_DELAY_MS = 2 * 60 * 1000;
const CHECK_INTERVAL_MS = DAY_MS;

export function startDataRetentionScheduler(mode: RetentionMode) {
  const log = logger.child({ module: "data-retention", mode });
  let busy = false;

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runScheduledDataRetention(mode);
    } catch (err) {
      log.error({ err }, "Saklama işi başarısız; sonraki yoklamada yeniden denenecek");
    } finally {
      busy = false;
    }
  };

  setTimeout(tick, BOOT_DELAY_MS).unref();
  setInterval(tick, CHECK_INTERVAL_MS).unref();
  log.info("Saklama işi zamanlayıcısı açık");
}

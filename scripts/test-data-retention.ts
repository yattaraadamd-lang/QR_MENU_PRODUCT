/**
 * Kişisel veri saklama işi testi — gerçek Postgres ister (CI: Security CI → migrations işi)
 *
 * Süresi dolan veri siliniyor ya da anonim oluyor mu, süresi dolmayana dokunulmuyor mu, kuru çalıştırma
 * gerçekten hiçbir şey değiştirmiyor mu, aynı anda iki süreç işi iki kez başlatabiliyor mu.
 *
 * Kendi işletmesini oluşturur, sonunda siler. Yalnız yerel veritabanında çalışır: iş geneldir, süresi
 * dolan HER kaydı işler.
 */

const RUN_ID = `ci-ret-${Date.now()}`;
const DAY_MS = 24 * 60 * 60 * 1000;

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: unknown) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
    failedCount++;
  }
}

function assertLocalDatabase() {
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    /* geçersiz ya da tanımsız */
  }
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    console.error(`❌ test:lifecycle yalnız yerel Postgres'te çalışır (DATABASE_URL host: ${host || "yok"}).`);
    process.exit(2);
  }
}

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

async function main() {
  assertLocalDatabase();

  const { prisma } = await import("../src/lib/prisma");
  const { ANONYMOUS_STAFF_NAME, applyDataRetention, previewDataRetention, runScheduledDataRetention } = await import(
    "../src/lib/services/data-retention.service"
  );

  const businessId = RUN_ID;
  const emails = {
    expired: `${RUN_ID}-expired@example.test`,
    recent: `${RUN_ID}-recent@example.test`,
    active: `${RUN_ID}-active@example.test`,
  };

  await prisma.business.create({ data: { id: businessId, name: RUN_ID, slug: RUN_ID } });

  try {
    const table = await prisma.table.create({ data: { businessId, tableNumber: "1" } });
    const product = await prisma.product.create({ data: { businessId, name: "Çay", price: 10 } });

    const newUser = (email: string, name: string, deletedAt: Date | null) =>
      prisma.user.create({
        data: { businessId, email, name, password: "hash", phone: "+905550000000", role: "WAITER", isActive: !deletedAt, deletedAt },
      });
    const expired = await newUser(emails.expired, "Süresi Dolan", daysAgo(31));
    const recent = await newUser(emails.recent, "Yeni Silinen", daysAgo(5));
    const active = await newUser(emails.active, "Çalışan Garson", null);

    const payment = (userId: string, name: string) =>
      prisma.payment.create({
        data: {
          businessId,
          tableId: table.id,
          amount: 10,
          handledById: userId,
          handledByWaiterName: name,
          requestedById: userId,
          requestedByName: name,
          approvedById: userId,
          approvedByName: name,
        },
      });
    const expiredPayment = await payment(expired.id, "Süresi Dolan");
    const activePayment = await payment(active.id, "Çalışan Garson");

    const emailChange = (userId: string, email: string) =>
      prisma.auditLog.create({
        data: { businessId, action: "USER_EMAIL_CHANGED", entityType: "User", entityId: userId, beforeJson: { email }, afterJson: { email } },
      });
    const expiredEmailAudit = await emailChange(expired.id, emails.expired);
    const activeEmailAudit = await emailChange(active.id, emails.active);
    const oldAudit = await prisma.auditLog.create({ data: { businessId, action: "TEST_OLD", createdAt: daysAgo(731) } });
    const keptAudit = await prisma.auditLog.create({ data: { businessId, action: "TEST_KEPT", createdAt: daysAgo(729) } });

    const session = (label: string, lastSeenAt: Date) =>
      prisma.customerSession.create({
        data: { businessId, tableId: table.id, sessionToken: `${RUN_ID}-${label}`, deviceKeyHash: `hash-${label}`, expiresAt: lastSeenAt, lastSeenAt },
      });
    const oldSession = await session("old", daysAgo(91));
    const newSession = await session("new", daysAgo(89));

    const order = (createdAt: Date, customerSessionId: string, note: string) =>
      prisma.order.create({
        data: {
          businessId,
          tableId: table.id,
          customerSessionId,
          totalPrice: 10,
          note,
          createdAt,
          items: { create: { productId: product.id, productName: "Çay", quantity: 1, unitPrice: 10, totalPrice: 10, customerNote: `ürün ${note}` } },
        },
        include: { items: true },
      });
    const oldOrder = await order(daysAgo(91), oldSession.id, "fıstık alerjim var");
    const newOrder = await order(daysAgo(89), newSession.id, "şekersiz");

    const request = (createdAt: Date, note: string) =>
      prisma.serviceRequest.create({
        data: {
          businessId,
          tableId: table.id,
          requestType: "COMPLAINT_SUGGESTION",
          note,
          reason: "sebep",
          orderPreview: { orderNote: note, items: [{ customerNote: note }] },
          status: "COMPLETED",
          createdAt,
        },
      });
    const oldRequest = await request(daysAgo(91), "eski şikâyet");
    const newRequest = await request(daysAgo(89), "yeni şikâyet");
    const oldEmptyRequest = await prisma.serviceRequest.create({
      data: { businessId, tableId: table.id, requestType: "CALL_WAITER", status: "COMPLETED", createdAt: daysAgo(100) },
    });

    const notification = (createdAt: Date) =>
      prisma.notification.create({ data: { businessId, tableId: table.id, type: "CALL_WAITER", title: "t", message: "m", createdAt } });
    const oldNotification = await notification(daysAgo(91));
    const newNotification = await notification(daysAgo(89));

    const block = (label: string, createdAt: Date, revokedAt: Date | null) =>
      prisma.customerAccessBlock.create({ data: { businessId, deviceKeyHash: `block-${label}`, reason: "kötüye kullanım", createdAt, revokedAt } });
    const oldActiveBlock = await block("old-active", daysAgo(366), null);
    const newActiveBlock = await block("new-active", daysAgo(100), null);
    const oldRevokedBlock = await block("old-revoked", daysAgo(100), daysAgo(31));
    const newRevokedBlock = await block("new-revoked", daysAgo(100), daysAgo(29));

    const tableEvent = (createdAt: Date) =>
      prisma.tableEvent.create({
        data: { businessId, tableId: table.id, fromStatus: "EMPTY", toStatus: "OCCUPIED", source: "SYSTEM", reason: "TEST", createdAt },
      });
    const oldEvent = await tableEvent(daysAgo(731));
    const newEvent = await tableEvent(daysAgo(729));

    const oldRun = await prisma.dataRetentionRun.create({ data: { startedAt: daysAgo(3 * 365 + 1), finishedAt: daysAgo(3 * 365 + 1), counts: {} } });

    console.log("\n── Kuru çalıştırma hiçbir şey değiştirmez");
    const runsBefore = await prisma.dataRetentionRun.count();
    const preview = await previewDataRetention();
    assert(preview.deletedStaff >= 1 && preview.orderNotes >= 1 && preview.orderItemNotes >= 1, "silinecekler sayılıyor", preview);
    assert(preview.serviceRequestNotes >= 1 && preview.customerSessions >= 1 && preview.notifications >= 1, "sayımlar devam", preview);
    assert(preview.deviceBlocks >= 2 && preview.auditLogs >= 1 && preview.tableEvents >= 1 && preview.retentionRuns >= 1, "sayımlar devam", preview);
    const dryResult = await runScheduledDataRetention("dry-run");
    assert(dryResult?.deletedStaff === preview.deletedStaff, "zamanlayıcının kuru modu aynı sayıyı veriyor");
    assert((await prisma.user.findUnique({ where: { id: expired.id } }))?.email === emails.expired, "kuru çalıştırma Personel'e dokunmadı");
    assert((await prisma.order.findUnique({ where: { id: oldOrder.id } }))?.note === "fıstık alerjim var", "kuru çalıştırma nota dokunmadı");
    assert((await prisma.dataRetentionRun.count()) === runsBefore, "kuru çalıştırma kayıt da yazmadı");

    console.log("\n── Uygula");
    const applied = await applyDataRetention();
    assert(applied.deletedStaff >= 1, "Personel anonimleştirildi", applied);

    console.log("\n── Silinen Personel");
    const anon = await prisma.user.findUnique({ where: { id: expired.id } });
    assert(anon?.name === ANONYMOUS_STAFF_NAME, "ad anonim");
    assert(anon?.email === `deleted-${expired.id}@anon.invalid`, "e-posta anonim", anon?.email);
    assert(anon?.phone === null, "telefon silindi");
    assert(anon?.password !== "hash" && !anon?.password.startsWith("$2"), "parola özeti silindi");
    assert(anon?.deletedAt !== null, "silinmiş işareti duruyor: giriş kapalı");
    const anonPayment = await prisma.payment.findUnique({ where: { id: expiredPayment.id } });
    assert(
      anonPayment?.handledByWaiterName === ANONYMOUS_STAFF_NAME &&
        anonPayment.requestedByName === ANONYMOUS_STAFF_NAME &&
        anonPayment.approvedByName === ANONYMOUS_STAFF_NAME,
      "ödeme kayıtlarındaki ad kopyaları anonim",
      anonPayment
    );
    assert(anonPayment?.handledById === expired.id, "kullanıcı kimliği duruyor");
    const scrubbed = await prisma.auditLog.findUnique({ where: { id: expiredEmailAudit.id } });
    assert(scrubbed?.beforeJson === null && scrubbed.afterJson === null, "audit kaydındaki e-posta silindi", scrubbed);
    const freed = await prisma.user.create({ data: { businessId, email: emails.expired, name: "Yeniden Kayıt", password: "hash", role: "WAITER" } });
    assert(!!freed.id, "e-posta yeniden kullanılabilir");

    const keptRecent = await prisma.user.findUnique({ where: { id: recent.id } });
    assert(keptRecent?.email === emails.recent && keptRecent.phone !== null, "30 günü dolmayan silinmiş Personel'e dokunulmadı");
    const keptActive = await prisma.user.findUnique({ where: { id: active.id } });
    assert(keptActive?.email === emails.active && keptActive.name === "Çalışan Garson", "çalışan Personel'e dokunulmadı");
    const keptPayment = await prisma.payment.findUnique({ where: { id: activePayment.id } });
    assert(keptPayment?.handledByWaiterName === "Çalışan Garson", "çalışan Personel'in ödeme adı duruyor");
    const keptEmailAudit = await prisma.auditLog.findUnique({ where: { id: activeEmailAudit.id } });
    assert(keptEmailAudit?.beforeJson !== null, "çalışan Personel'in audit kaydı duruyor");

    console.log("\n── Misafir Notu (90 gün)");
    const clearedOrder = await prisma.order.findUnique({ where: { id: oldOrder.id }, include: { items: true } });
    assert(clearedOrder?.note === null, "eski sipariş notu silindi");
    assert(clearedOrder?.items[0].customerNote === null, "eski ürün notu silindi");
    assert(clearedOrder?.items[0].productName === "Çay" && Number(clearedOrder.totalPrice) === 10, "sipariş kaydının kendisi duruyor");
    const keptOrder = await prisma.order.findUnique({ where: { id: newOrder.id }, include: { items: true } });
    assert(keptOrder?.note === "şekersiz" && keptOrder.items[0].customerNote === "ürün şekersiz", "yeni not duruyor");
    const clearedRequest = await prisma.serviceRequest.findUnique({ where: { id: oldRequest.id } });
    assert(clearedRequest?.note === null && clearedRequest.reason === null && clearedRequest.orderPreview === null, "eski talep metni ve önizlemesi silindi", clearedRequest);
    const keptRequest = await prisma.serviceRequest.findUnique({ where: { id: newRequest.id } });
    assert(keptRequest?.note === "yeni şikâyet" && keptRequest.orderPreview !== null, "yeni talep duruyor");
    assert(!!(await prisma.serviceRequest.findUnique({ where: { id: oldEmptyRequest.id } })), "notsuz eski talep silinmedi");

    console.log("\n── Misafir oturumu ve cihaz özeti (90 gün)");
    assert(!(await prisma.customerSession.findUnique({ where: { id: oldSession.id } })), "eski oturum silindi");
    assert(!!(await prisma.customerSession.findUnique({ where: { id: newSession.id } })), "yeni oturum duruyor");
    assert(clearedOrder?.customerSessionId === null, "eski siparişin oturum bağı kalktı, sipariş silinmedi");
    assert(keptOrder?.customerSessionId === newSession.id, "yeni siparişin bağı duruyor");

    console.log("\n── Bildirim, cihaz engeli, işlem kayıtları");
    assert(!(await prisma.notification.findUnique({ where: { id: oldNotification.id } })), "90 günden eski bildirim silindi");
    assert(!!(await prisma.notification.findUnique({ where: { id: newNotification.id } })), "yeni bildirim duruyor");
    assert(!(await prisma.customerAccessBlock.findUnique({ where: { id: oldActiveBlock.id } })), "12 aydan eski engel silindi");
    assert(!!(await prisma.customerAccessBlock.findUnique({ where: { id: newActiveBlock.id } })), "yeni engel duruyor");
    assert(!(await prisma.customerAccessBlock.findUnique({ where: { id: oldRevokedBlock.id } })), "30 günden önce kaldırılan engel silindi");
    assert(!!(await prisma.customerAccessBlock.findUnique({ where: { id: newRevokedBlock.id } })), "yeni kaldırılan engel geçmişte duruyor");
    assert(!(await prisma.auditLog.findUnique({ where: { id: oldAudit.id } })), "24 aydan eski audit silindi");
    assert(!!(await prisma.auditLog.findUnique({ where: { id: keptAudit.id } })), "24 aydan yeni audit duruyor");
    assert(!(await prisma.tableEvent.findUnique({ where: { id: oldEvent.id } })), "24 aydan eski masa olayı silindi");
    assert(!!(await prisma.tableEvent.findUnique({ where: { id: newEvent.id } })), "24 aydan yeni masa olayı duruyor");
    assert(!(await prisma.dataRetentionRun.findUnique({ where: { id: oldRun.id } })), "3 yıldan eski çalışma kaydı silindi");

    console.log("\n── Tekrar çalıştırma");
    const second = await applyDataRetention();
    const leftover = Object.entries(second).filter(([, count]) => count !== 0);
    assert(leftover.length === 0, "ikinci çalıştırmada işlenecek kayıt yok", leftover);

    console.log("\n── Zamanlama: ayda bir, aynı anda tek");
    await prisma.dataRetentionRun.deleteMany();
    const base = new Date();
    const [first, rival] = await Promise.all([runScheduledDataRetention("apply", base), runScheduledDataRetention("apply", base)]);
    assert((first === null) !== (rival === null), "aynı anda iki süreçten yalnız biri çalışır", { first: !!first, rival: !!rival });
    const runs = await prisma.dataRetentionRun.findMany();
    assert(runs.length === 1 && !!runs[0].finishedAt && runs[0].error === null, "imha kaydı yazıldı", runs);
    assert((runs[0].counts as Record<string, number>).notifications === 0, "kayıtta sayılar var", runs[0].counts);
    assert(JSON.stringify(runs[0]).indexOf("example.test") === -1, "kayıt kişisel veri içermiyor");
    assert((await runScheduledDataRetention("apply", new Date(base.getTime() + 29 * DAY_MS))) === null, "ay dolmadan çalışmaz");
    assert((await runScheduledDataRetention("apply", new Date(base.getTime() + 31 * DAY_MS))) !== null, "ay dolunca çalışır");

    await prisma.dataRetentionRun.deleteMany();
    await prisma.dataRetentionRun.create({ data: { startedAt: new Date(base.getTime() - 10 * 60 * 1000) } });
    assert((await runScheduledDataRetention("apply", base)) === null, "süren çalışma varken başlamaz");
    await prisma.dataRetentionRun.deleteMany();
    await prisma.dataRetentionRun.create({ data: { startedAt: new Date(base.getTime() - 2 * 60 * 60 * 1000) } });
    assert((await runScheduledDataRetention("apply", base)) !== null, "yarım kalmış eski çalışma engellemez");

    await prisma.dataRetentionRun.deleteMany();
    await prisma.dataRetentionRun.create({ data: { startedAt: new Date(base.getTime() - DAY_MS), finishedAt: new Date(base.getTime() - DAY_MS), error: "Hata" } });
    assert((await runScheduledDataRetention("apply", base)) !== null, "başarısız çalışma ertesi yoklamada yeniden denenir");

    console.log("\n── Hata yarıda kalırsa");
    await prisma.dataRetentionRun.deleteMany();
    const stuck = await notification(daysAgo(91));
    const stuckStaff = await newUser(`${RUN_ID}-stuck@example.test`, "Yarıda Kalan", daysAgo(31));
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION pg_temp_retention_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test: silme reddedildi'; END; $$ LANGUAGE plpgsql`
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER retention_fail BEFORE DELETE ON notifications FOR EACH ROW EXECUTE FUNCTION pg_temp_retention_fail()`
    );
    let thrown: unknown = null;
    try {
      await runScheduledDataRetention("apply", base);
    } catch (error) {
      thrown = error;
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER retention_fail ON notifications`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION pg_temp_retention_fail()`);
    }
    assert(thrown !== null, "hata yeniden fırlatılıyor: zamanlayıcı loglasın");
    const failedRun = await prisma.dataRetentionRun.findFirst({ orderBy: { startedAt: "desc" } });
    assert(!!failedRun?.error && !!failedRun.finishedAt, "çalışma hatalı olarak kapandı", failedRun);
    assert(!String(failedRun?.error).includes("reddedildi") && !String(failedRun?.error).includes("example.test"), "kayıtta hata mesajı yok, yalnız tür ve kod", failedRun?.error);
    const partial = failedRun?.counts as Record<string, number>;
    assert(partial.deletedStaff === 1, "hata öncesi işlenenler sayıldı", partial);
    assert(partial.notifications === undefined, "hatalı adım işlenmiş sayılmadı", partial);
    assert((await prisma.user.findUnique({ where: { id: stuckStaff.id } }))?.name === ANONYMOUS_STAFF_NAME, "hata öncesi adım kalıcı");
    assert(!!(await prisma.notification.findUnique({ where: { id: stuck.id } })), "hatalı adımın kaydı silinmedi");
    const retried = await runScheduledDataRetention("apply", base);
    assert(retried?.notifications === 1, "sonraki çalışma kalanı tamamlıyor", retried);
    assert(!(await prisma.notification.findUnique({ where: { id: stuck.id } })), "kayıt ikinci çalışmada silindi");
  } finally {
    await prisma.dataRetentionRun.deleteMany();
    await prisma.payment.deleteMany({ where: { businessId } });
    await prisma.order.deleteMany({ where: { businessId } });
    await prisma.serviceRequest.deleteMany({ where: { businessId } });
    await prisma.auditLog.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } }).catch((e) => console.error("temizlik:", (e as Error).message));
    await prisma.$disconnect();
  }

  console.log(`\n📊 Test Results: ${passedCount} Passed, ${failedCount} Failed`);
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

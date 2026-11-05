/**
 * 🔒 Masa durumu güven testi — gerçek Postgres ister (CI: Security CI → migrations işi)
 *
 * İlke: müşteri masa durumunu yazmaz, sinyal üretir; durum kanıtlanmış kayıtlardan hesaplanır.
 * Müşteri uçları rota işleyicisi çağrılarak, personel adımları servisler üzerinden sınanır
 * (personel uçları next-auth oturumu ister).
 *
 * Kendi işletmelerini ve masalarını oluşturur, sonunda siler.
 */

import { NextRequest } from "next/server";

const RUN_ID = `ci-trust-${Date.now()}`;
const DEMO_ID = `${RUN_ID}-demo`;

// src/lib/demo.ts değeri modül yüklenirken okur: işleyiciler aşağıda bundan sonra yüklenir
process.env.DEMO_BUSINESS_ID = DEMO_ID;
process.env.CUSTOMER_DEVICE_HMAC_SECRET ||= "table-trust-test-secret-at-least-32-characters";

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
    console.error(`❌ test:db yalnız yerel Postgres'te çalışır (DATABASE_URL host: ${host || "yok"}).`);
    process.exit(2);
  }
}

function customerRequest(path: string, init: { method?: string; token?: string; device?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.token) headers["x-session-token"] = init.token;
  if (init.device) headers.cookie = `customer_device_id=${init.device}`;
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function main() {
  assertLocalDatabase();

  const { prisma } = await import("../src/lib/prisma");
  const { computeClosedTableStatus, computeOpenTableStatus } = await import("../src/lib/services/table-status");
  const flow = await import("../src/lib/services/table-flow.service");
  const { createDirectAdminPayment } = await import("../src/lib/services/payment.service");
  const { cancelOrderAndSyncState } = await import("../src/lib/services/order-cancellation.service");
  const { approveOrderRequest } = await import("../src/lib/services/order-request-approval.service");
  const sessionRoute = await import("../src/app/api/customer/session/route");
  const statusRoute = await import("../src/app/api/customer/session/status/route");
  const ordersRoute = await import("../src/app/api/customer/orders/route");
  const requestsRoute = await import("../src/app/api/customer/service-requests/route");
  const demoApproveRoute = await import("../src/app/api/customer/demo/approve-order-request/route");

  type Handler = (request: NextRequest, context: never) => Promise<Response>;
  const call = async (handler: unknown, request: NextRequest) => {
    const response = await (handler as Handler)(request, undefined as never);
    return { status: response.status, body: await response.json().catch(() => null) };
  };

  const business = await prisma.business.create({ data: { name: RUN_ID, slug: RUN_ID } });
  const demo = await prisma.business.create({ data: { id: DEMO_ID, name: DEMO_ID, slug: DEMO_ID } });
  const product = await prisma.product.create({ data: { businessId: business.id, name: "Çay", price: 100 } });

  let tableCounter = 0;
  const newTable = (businessId: string) =>
    prisma.table.create({
      data: { businessId, tableNumber: String(++tableCounter), qrToken: `${RUN_ID}-qr-${tableCounter}` },
    });
  const tableStatus = async (id: string) =>
    (await prisma.table.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;
  const billOf = (tableSessionId: string) => prisma.bill.findUniqueOrThrow({ where: { tableSessionId } });

  const scan = (table: { id: string; businessId: string; qrToken: string | null }, device: string, qrToken: string | null = table.qrToken) =>
    call(
      sessionRoute.POST,
      customerRequest("/api/customer/session", {
        device,
        body: { businessId: table.businessId, tableId: table.id, ...(qrToken ? { qrToken } : {}) },
      })
    );

  const sendOrderRequest = (table: { id: string; businessId: string }, token: string) =>
    call(
      requestsRoute.POST,
      customerRequest("/api/customer/service-requests", {
        token,
        body: { businessId: table.businessId, tableId: table.id, requestType: "ORDER_REQUEST", idempotencyKey: `or_${crypto.randomUUID()}` },
      })
    );

  /** QR → talep → garson onayı: yetkili müşteri ve masa oturumu hazırlar */
  const approvedCustomer = async (table: { id: string; businessId: string; tableNumber: string; tableName: string | null; qrToken: string | null }) => {
    const scanned = await scan(table, `${RUN_ID}-device-${table.id}`);
    const token: string = scanned.body.sessionToken;
    const requested = await sendOrderRequest(table, token);
    const customerSession = await prisma.customerSession.findFirstOrThrow({
      where: { tableId: table.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    const { tableSession } = await approveOrderRequest({
      id: requested.body.serviceRequest.id,
      businessId: table.businessId,
      tableId: table.id,
      customerSessionId: customerSession.id,
      table,
    });
    return { token, customerSession, tableSession };
  };

  const createOrder = (data: { businessId: string; tableId: string; tableSessionId: string; customerSessionId?: string; status: "PENDING" | "ACCEPTED" | "PREPARING" | "SERVED"; totalPrice: number }) =>
    prisma.order.create({ data });

  try {
    console.log("📦 Suite 1: Durum kuralları");
    const facts = { orderStatuses: [], hasPaymentRequest: false, hasWaiterCall: false };
    assert(computeOpenTableStatus(facts) === "OCCUPIED", "Sipariş ve talep yoksa dolu");
    assert(computeOpenTableStatus({ ...facts, orderStatuses: ["PREPARING"], hasWaiterCall: true, hasPaymentRequest: true }) === "PREPARING", "Garson çağrısı ve ödeme talebi 'hazırlanıyor'u ezmez");
    assert(computeOpenTableStatus({ ...facts, orderStatuses: ["ACCEPTED"], hasWaiterCall: true }) === "HAS_ORDER", "Garson çağrısı onaylı siparişi ezmez");
    assert(computeOpenTableStatus({ ...facts, orderStatuses: ["SERVED"], hasWaiterCall: true }) === "WAITING_WAITER", "Servis sonrası garson çağrısı görünür");
    assert(computeOpenTableStatus({ ...facts, orderStatuses: ["SERVED"], hasPaymentRequest: true }) === "PAYMENT_REQUESTED", "Servis sonrası ödeme talebi görünür");
    assert(computeClosedTableStatus("OCCUPIED", false) === "EMPTY", "Oturumsuz masa boş");
    assert(computeClosedTableStatus("CLEANING_NEEDED", false) === "CLEANING_NEEDED", "Temizlik kararı korunur");
    assert(computeClosedTableStatus("EMPTY", true) === "OCCUPIED", "Oturumsuz açık adisyon görünür kalır");

    console.log("\n📦 Suite 2: QR okutmak masayı değiştirmez (gerçek işletme)");
    const quietTable = await newTable(business.id);
    const noQr = await scan(quietTable, `${RUN_ID}-a`, null);
    assert(noQr.body.sessionToken === null, "QR kanıtı olmadan oturum yok", noQr.body);
    const viewer = await scan(quietTable, `${RUN_ID}-a`);
    assert(viewer.body.authorizationStatus === "VIEW_ONLY", "Okutan cihaz yalnız görüntüler", viewer.body);
    assert((await tableStatus(quietTable.id)) === "EMPTY", "Masa boş kalır");
    assert((await prisma.tableSession.count({ where: { tableId: quietTable.id } })) === 0, "Masa oturumu açılmaz");
    const asked = await sendOrderRequest(quietTable, viewer.body.sessionToken);
    assert(asked.status === 201, "Sipariş talebi oluşur", asked.body);
    assert((await tableStatus(quietTable.id)) === "EMPTY", "Talep garson onayına kadar masayı doldurmaz");

    console.log("\n📦 Suite 3: Demo işletmesi aynı kurallara uyar");
    const demoTable = await newTable(demo.id);
    const demoNoQr = await scan(demoTable, `${RUN_ID}-d1`, null);
    assert(demoNoQr.body.sessionToken === null, "Demoda da QR kanıtı zorunlu", demoNoQr.body);
    assert((await tableStatus(demoTable.id)) === "EMPTY", "QR'sız istek demo masasını değiştirmez");
    const demoViewer = await scan(demoTable, `${RUN_ID}-d1`);
    assert(demoViewer.body.authorizationStatus === "VIEW_ONLY", "Demo cihazı otomatik yetkilenmez", demoViewer.body);
    assert((await tableStatus(demoTable.id)) === "EMPTY", "Demo QR okutması masayı doldurmaz");

    const demoToken: string = demoViewer.body.sessionToken;
    const demoAsked = await sendOrderRequest(demoTable, demoToken);
    const approveCall = () => call(demoApproveRoute.POST, customerRequest("/api/customer/demo/approve-order-request", { token: demoToken }));
    const early = await approveCall();
    assert(early.status === 409 && early.body.code === "DEMO_APPROVAL_NOT_DUE", "Süre dolmadan sistem onayı reddedilir", early);
    const pendingStatus = await call(statusRoute.GET, customerRequest("/api/customer/session/status", { method: "GET", token: demoToken }));
    assert(pendingStatus.body.demoAutoApproveInMs > 0, "Durum ucu kalan süreyi bildirir", pendingStatus.body);

    await prisma.serviceRequest.update({
      where: { id: demoAsked.body.serviceRequest.id },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
    const approved = await approveCall();
    assert(approved.status === 200, "Süre dolunca sistem onaylar", approved);
    assert((await tableStatus(demoTable.id)) === "OCCUPIED", "Masa yalnız onayla dolar");
    const secondDevice = await scan(demoTable, `${RUN_ID}-d2`);
    assert(secondDevice.body.authorizationStatus === "VIEW_ONLY", "İkinci cihaz yetki alamaz", secondDevice.body);
    assert((await tableStatus(demoTable.id)) === "OCCUPIED", "Masayı tutan cihaz etkin iken masa serbest kalmaz");

    await prisma.customerSession.updateMany({ where: { tableId: demoTable.id }, data: { lastSeenAt: new Date(Date.now() - 31 * 60_000) } });
    await prisma.tableSession.updateMany({ where: { tableId: demoTable.id }, data: { startedAt: new Date(Date.now() - 31 * 60_000) } });
    await scan(demoTable, `${RUN_ID}-d3`);
    assert((await tableStatus(demoTable.id)) === "EMPTY", "Boşta kalan demo masası yeni okutmada serbest kalır");
    const oldHolder = await call(statusRoute.GET, customerRequest("/api/customer/session/status", { method: "GET", token: demoToken }));
    assert(oldHolder.status !== 200, "Boşta kalan cihazın yetkisi biter", oldHolder);

    const realApprove = await call(demoApproveRoute.POST, customerRequest("/api/customer/demo/approve-order-request", { token: viewer.body.sessionToken }));
    assert(realApprove.status === 404, "Gerçek işletmede sistem onayı yok", realApprove);

    console.log("\n📦 Suite 4: Onaylanmamış sipariş adisyona ve masaya dokunmaz");
    const orderTable = await newTable(business.id);
    const customer = await approvedCustomer(orderTable);
    const placed = await call(
      ordersRoute.POST,
      customerRequest("/api/customer/orders", {
        token: customer.token,
        body: { items: [{ productId: product.id, quantity: 3 }], idempotencyKey: `ord_${crypto.randomUUID()}` },
      })
    );
    assert(placed.status === 201 && placed.body.status === "PENDING", "Sipariş PENDING doğar", placed);
    assert((await tableStatus(orderTable.id)) === "OCCUPIED", "Masa 'sipariş var'a geçmez");
    assert(Number((await billOf(customer.tableSession.id)).totalAmount) === 0, "Adisyon artmaz");
    await flow.requestPayment(orderTable.id, business.id).then(
      () => assert(false, "Yalnız bekleyen siparişle ödeme talebi reddedilir"),
      (error: Error) => assert(error.message.includes("sipariş"), "Yalnız bekleyen siparişle ödeme talebi reddedilir", error.message)
    );

    await prisma.order.update({ where: { id: placed.body.order.id }, data: { status: "ACCEPTED" } });
    await prisma.$transaction(async (tx) => {
      await flow.updateBillAfterOrder(tx, customer.tableSession.id);
      await flow.recalculateTableStatus(tx, { businessId: business.id, tableId: orderTable.id });
    });
    assert(Number((await billOf(customer.tableSession.id)).totalAmount) === 300, "Garson onayı adisyona yazar");
    assert((await tableStatus(orderTable.id)) === "HAS_ORDER", "Garson onayı masayı 'sipariş var' yapar");

    console.log("\n📦 Suite 5: Bekleyen sipariş sınırı");
    const limitTable = await newTable(business.id);
    const limited = await approvedCustomer(limitTable);
    for (let i = 0; i < 2; i++) {
      await createOrder({ businessId: business.id, tableId: limitTable.id, tableSessionId: limited.tableSession.id, customerSessionId: limited.customerSession.id, status: "PENDING", totalPrice: 100 });
    }
    const overLimit = await call(
      ordersRoute.POST,
      customerRequest("/api/customer/orders", {
        token: limited.token,
        body: { items: [{ productId: product.id, quantity: 1 }], idempotencyKey: `ord_${crypto.randomUUID()}` },
      })
    );
    assert(overLimit.status === 429 && overLimit.body.code === "PENDING_ORDER_LIMIT", "Üçüncü bekleyen sipariş reddedilir", overLimit);

    console.log("\n📦 Suite 6: Garson çağrısı mutfaktaki gerçeği ezmez");
    const callTable = await newTable(business.id);
    const caller = await approvedCustomer(callTable);
    await createOrder({ businessId: business.id, tableId: callTable.id, tableSessionId: caller.tableSession.id, status: "PREPARING", totalPrice: 100 });
    await prisma.$transaction((tx) => flow.recalculateTableStatus(tx, { businessId: business.id, tableId: callTable.id }));
    const called = await call(
      requestsRoute.POST,
      customerRequest("/api/customer/service-requests", {
        token: caller.token,
        body: { businessId: business.id, tableId: callTable.id, requestType: "CALL_WAITER" },
      })
    );
    assert(called.status === 201, "Çağrı oluşur", called);
    assert((await tableStatus(callTable.id)) === "PREPARING", "Masa 'hazırlanıyor' kalır");
    await prisma.order.updateMany({ where: { tableId: callTable.id }, data: { status: "SERVED" } });
    await prisma.$transaction((tx) => flow.recalculateTableStatus(tx, { businessId: business.id, tableId: callTable.id }));
    assert((await tableStatus(callTable.id)) === "WAITING_WAITER", "Sipariş bitince açık çağrı görünür");
    await prisma.serviceRequest.updateMany({ where: { tableId: callTable.id, requestType: "CALL_WAITER" }, data: { status: "COMPLETED" } });
    await prisma.$transaction((tx) => flow.recalculateTableStatus(tx, { businessId: business.id, tableId: callTable.id }));
    assert((await tableStatus(callTable.id)) === "SERVED", "Çağrı kapanınca durum kendiliğinden döner");

    console.log("\n📦 Suite 7: Sipariş geçmişi boş masayı doldurmaz");
    const historyTable = await newTable(business.id);
    const past = await flow.openTable(historyTable.id, business.id);
    await createOrder({ businessId: business.id, tableId: historyTable.id, tableSessionId: past.tableSession.id, status: "SERVED", totalPrice: 100 });
    await prisma.$transaction((tx) => flow.updateBillAfterOrder(tx, past.tableSession.id));
    await flow.closeTable(past.tableSession.id, business.id, null, { forceClose: true, closeReason: "test" });
    assert((await tableStatus(historyTable.id)) === "EMPTY", "Kapanan masa boş");
    await prisma.$transaction((tx) => flow.recalculateTableStatus(tx, { businessId: business.id, tableId: historyTable.id }));
    assert((await tableStatus(historyTable.id)) === "EMPTY", "Talep kapanınca (yeniden hesap) masa boş kalır");

    console.log("\n📦 Suite 8: Reddedilen sipariş ve hesabın kapanması");
    const payTable = await newTable(business.id);
    const payer = await approvedCustomer(payTable);
    const rejected = await createOrder({ businessId: business.id, tableId: payTable.id, tableSessionId: payer.tableSession.id, status: "PENDING", totalPrice: 500 });
    const rejection = await cancelOrderAndSyncState({
      orderId: rejected.id,
      businessId: business.id,
      actorId: "test",
      actorRole: "WAITER",
      targetStatus: "REJECTED",
      reasonCode: "WRONG_ORDER",
      reasonText: null,
      outOfStockProductIds: null,
    });
    assert(rejection.tableStatus === "OCCUPIED", "Reddedilen bekleyen sipariş masayı dolu bırakır", rejection.tableStatus);
    assert(Number((await billOf(payer.tableSession.id)).totalAmount) === 0, "Reddedilen sipariş adisyona yazılmaz");

    await createOrder({ businessId: business.id, tableId: payTable.id, tableSessionId: payer.tableSession.id, status: "SERVED", totalPrice: 200 });
    const straggler = await createOrder({ businessId: business.id, tableId: payTable.id, tableSessionId: payer.tableSession.id, status: "PENDING", totalPrice: 900 });
    await prisma.$transaction((tx) => flow.updateBillAfterOrder(tx, payer.tableSession.id));
    const bill = await billOf(payer.tableSession.id);
    assert(Number(bill.totalAmount) === 200, "Bekleyen sipariş borç yazmaz", bill.totalAmount);
    await createDirectAdminPayment({
      billId: bill.id,
      businessId: business.id,
      adminId: "test",
      adminName: "Test",
      amount: 200,
      method: "CARD",
    });
    const closedOrder = await prisma.order.findUniqueOrThrow({ where: { id: straggler.id } });
    assert(closedOrder.status === "CANCELLED" && closedOrder.paymentStatus === "CANCELLED", "Hesap kapanırken bekleyen sipariş iptal olur", closedOrder.status);
    assert((await tableStatus(payTable.id)) === "EMPTY", "Tam ödeme masayı boşaltır");
  } finally {
    const businessIds = [business.id, demo.id];
    await prisma.payment.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.bill.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.order.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.serviceRequest.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.customerSession.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.tableSession.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.product.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
    await prisma.$disconnect();
  }

  console.log("\n=================================================");
  console.log(`📊 Test Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("=================================================");
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ Test çalıştırılamadı:", error);
  process.exit(1);
});

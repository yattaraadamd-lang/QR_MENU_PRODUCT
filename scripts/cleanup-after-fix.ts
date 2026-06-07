/**
 * Cleanup Script - Düzeltme Sonrası Veritabanı Temizliği
 * 
 * Bu script düzeltmeler deploy edildikten sonra çalıştırılmalıdır.
 * Eski açık oturumları, tutarsız masa durumlarını ve orphan kayıtları temizler.
 * 
 * KULLANIM:
 * npx tsx scripts/cleanup-after-fix.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Veritabanı temizliği başlıyor...\n');

  try {
    // ─── 1. Süresi Geçmiş CustomerSession'ları Kapat ─────────────────
    console.log('1️⃣ Süresi geçmiş CustomerSession kayıtları kapatılıyor...');
    const expiredCustomerSessions = await prisma.customerSession.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    console.log(`   ✅ ${expiredCustomerSessions.count} CustomerSession EXPIRED yapıldı.\n`);

    // ─── 2. Eski TableSession'ları Kapat (2 saatten eski) ────────────
    console.log('2️⃣ Eski TableSession kayıtları kapatılıyor (2 saat+)...');
    const oldTableSessions = await prisma.tableSession.findMany({
      where: {
        status: 'ACTIVE',
        startedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
      select: { id: true, tableId: true, startedAt: true },
    });

    let closedTableSessions = 0;
    for (const ts of oldTableSessions) {
      await prisma.$transaction(async (tx) => {
        // TableSession kapat
        await tx.tableSession.update({
          where: { id: ts.id },
          data: { status: 'CLOSED', endedAt: new Date() },
        });

        // İlgili Bill'i kapat
        await tx.bill.updateMany({
          where: { tableSessionId: ts.id, status: 'OPEN' },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            paymentStatus: 'CANCELLED',
          },
        });

        // İlgili CustomerSession'ları kapat
        await tx.customerSession.updateMany({
          where: { tableId: ts.tableId, status: 'ACTIVE' },
          data: { status: 'CLOSED' },
        });

        closedTableSessions++;
      });
    }
    console.log(`   ✅ ${closedTableSessions} eski TableSession kapatıldı.\n`);

    // ─── 3. Orphan Masa Durumlarını Düzelt ───────────────────────────
    console.log('3️⃣ Orphan masa durumları düzeltiliyor...');
    
    // Aktif session olmayan ama OCCUPIED/HAS_ORDER durumundaki masalar
    const orphanTables = await prisma.table.findMany({
      where: {
        status: { in: ['OCCUPIED', 'HAS_ORDER', 'PREPARING', 'SERVED', 'WAITING_WAITER', 'PAYMENT_REQUESTED'] },
        isActive: true,
        isDeleted: false,
      },
      include: {
        tableSessions: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    let fixedTables = 0;
    for (const table of orphanTables) {
      if (table.tableSessions.length === 0) {
        // Aktif session yok ama masa dolu görünüyor — düzelt
        await prisma.table.update({
          where: { id: table.id },
          data: { status: 'EMPTY' },
        });
        fixedTables++;
      }
    }
    console.log(`   ✅ ${fixedTables} orphan masa durumu EMPTY yapıldı.\n`);

    // ─── 4. Bekleyen Ödeme Taleplerini Temizle (eski) ────────────────
    console.log('4️⃣ Eski bekleyen ödeme talepleri temizleniyor (24 saat+)...');
    const oldPendingPayments = await prisma.payment.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      data: { status: 'CANCELLED' },
    });
    console.log(`   ✅ ${oldPendingPayments.count} eski PENDING Payment iptal edildi.\n`);

    // ─── 5. Orphan ServiceRequest Kayıtlarını Tamamla ────────────────
    console.log('5️⃣ Orphan hizmet talepleri tamamlanıyor...');
    const orphanServiceRequests = await prisma.serviceRequest.updateMany({
      where: {
        status: { in: ['PENDING', 'SEEN', 'IN_PROGRESS'] },
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    console.log(`   ✅ ${orphanServiceRequests.count} eski ServiceRequest tamamlandı.\n`);

    // ─── 6. Bill Tutarlılık Kontrolü ─────────────────────────────────
    console.log('6️⃣ Bill tutarlılık kontrolü yapılıyor...');
    const openBills = await prisma.bill.findMany({
      where: { status: 'OPEN' },
      include: {
        tableSession: {
          include: {
            orders: {
              where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
            },
          },
        },
      },
    });

    let fixedBills = 0;
    for (const bill of openBills) {
      if (!bill.tableSession || bill.tableSession.status !== 'ACTIVE') {
        // TableSession kapalı ama Bill açık — tutarsızlık
        await prisma.bill.update({
          where: { id: bill.id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            paymentStatus: 'CANCELLED',
          },
        });
        fixedBills++;
        continue;
      }

      // totalAmount yeniden hesapla
      const orders = bill.tableSession.orders || [];
      const serverTotalAmount = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

      if (Number(bill.totalAmount) !== serverTotalAmount) {
        const remainingAmount = Math.max(0, serverTotalAmount - Number(bill.paidAmount));
        await prisma.bill.update({
          where: { id: bill.id },
          data: {
            totalAmount: serverTotalAmount,
            remainingAmount,
          },
        });
        fixedBills++;
      }
    }
    console.log(`   ✅ ${fixedBills} Bill kaydı düzeltildi.\n`);

    // ─── 7. ÖZET RAPOR ────────────────────────────────────────────────
    console.log('━'.repeat(60));
    console.log('📊 TEMİZLİK RAPORU\n');

    // Mevcut durum
    const activeTableSessions = await prisma.tableSession.count({ where: { status: 'ACTIVE' } });
    const openBillsCount = await prisma.bill.count({ where: { status: 'OPEN' } });
    const pendingPayments = await prisma.payment.count({ where: { status: 'PENDING' } });
    const occupiedTables = await prisma.table.count({
      where: { status: { not: 'EMPTY' }, isActive: true, isDeleted: false },
    });

    console.log(`Aktif TableSession: ${activeTableSessions}`);
    console.log(`Açık Bill: ${openBillsCount}`);
    console.log(`Bekleyen Payment: ${pendingPayments}`);
    console.log(`Dolu Masa: ${occupiedTables}`);

    console.log('\n✅ Temizlik başarıyla tamamlandı!');
    console.log('━'.repeat(60));

  } catch (error) {
    console.error('❌ Temizlik sırasında hata oluştu:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Script çalıştırma
main()
  .catch((e) => {
    console.error('❌ Script hatası:', e);
    process.exit(1);
  });

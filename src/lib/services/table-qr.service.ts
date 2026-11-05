import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { generateQrToken } from "@/lib/qr-token";

/**
 * Masanın QR'ını yeniler: eski bağlantı (basılı kod, çekilmiş fotoğraf) artık çalışmaz. Eski kodla
 * açılmış, henüz garson onayı almamış oturumlar ve talepleri de kapanır; masadaki onaylı müşteri
 * etkilenmez. Masa durumu değişmez.
 */
export async function rotateTableQr(tableId: string, businessId: string) {
  const qrToken = generateQrToken();

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const table = await tx.table.update({
      where: { id: tableId, businessId },
      data: { qrToken, qrTokenExpiresAt: null },
      select: { id: true, tableNumber: true, tableName: true },
    });

    const { count: closedSessions } = await tx.customerSession.updateMany({
      where: { tableId, businessId, status: "ACTIVE", authorizationStatus: { in: ["VIEW_ONLY", "PENDING"] } },
      data: { status: "CLOSED", authorizationStatus: "REVOKED", closedAt: now },
    });

    const { count: cancelledRequests } = await tx.serviceRequest.updateMany({
      where: { tableId, businessId, requestType: "ORDER_REQUEST", status: { in: ["PENDING", "SEEN"] } },
      data: { status: "CANCELLED", resolvedAt: now },
    });

    return { table, qrToken, closedSessions, cancelledRequests };
  });
}

/** Yazdırılabilir QR: bağlantı ve base64 görsel */
export async function renderTableQr(qrToken: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qrUrl = `${appUrl}/qr/${qrToken}`;
  const qrImageData = await QRCode.toDataURL(qrUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return { qrUrl, qrImageData };
}

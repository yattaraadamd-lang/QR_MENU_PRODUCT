"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import { hasUnpaidBill } from "@/components/tables/tableModel";
import { selectTables } from "@/components/tables/tables.api";
import type { TableDTO } from "@/components/tables/types";
import { useTableDetail } from "@/components/tables/useTableDetail";
import { adminTablesApi, type TableQrDTO } from "./adminTables.api";

/** Sekme görünürken masa listesi yenileme aralığı; değişiklikler ayrıca soketle anında gelir */
const REFRESH_MS = 8000;
const TABLE_EVENTS = ["table_status_update", "table_opened", "request_status_update", "payment_collected"];

/** Aynı anda en fazla bir pencere açık: masa detayı kendi alt pencerelerini (ödeme, kapat) taşır */
type AdminDialog =
  | { readonly kind: "none" }
  | { readonly kind: "create" }
  | { readonly kind: "qr"; readonly qr: TableQrDTO }
  | { readonly kind: "delete"; readonly table: TableDTO };

const NO_DIALOG: AdminDialog = { kind: "none" };

/** Admin masa ekranının durumu ve eylemleri; sayfa yalnız çizim yapar */
export function useAdminTablesPage() {
  const query = useApiQuery("/api/admin/tables", { select: selectTables, refreshInterval: REFRESH_MS });
  const tables = query.data ?? [];
  useBusinessSocket(TABLE_EVENTS, query.refresh);

  const detail = useTableDetail(tables);
  const [dialog, setDialog] = useState<AdminDialog>(NO_DIALOG);
  const [qrPendingId, setQrPendingId] = useState<string | null>(null);

  const closeDialog = () => setDialog(NO_DIALOG);

  const showQr = async (table: TableDTO) => {
    setQrPendingId(table.id);
    const result = await adminTablesApi.generateQr(table.id);
    setQrPendingId(null);
    // Pencere açık değilken hata toast'la gösterilir (açık <dialog> toast'ı örterdi)
    if (result.ok) setDialog({ kind: "qr", qr: result.data });
    else toast.error(result.error);
  };

  const afterMutation = () => {
    closeDialog();
    void query.refresh();
  };

  const occupied = tables.filter((t) => t.status !== "EMPTY").length;

  return {
    query,
    tables,
    stats: {
      total: tables.length,
      occupied,
      empty: tables.length - occupied,
      pendingPayment: tables.filter(hasUnpaidBill).length,
    },
    detail,
    dialog,
    qrPendingId,
    openCreate: () => setDialog({ kind: "create" }),
    openDelete: (table: TableDTO) => setDialog({ kind: "delete", table }),
    showQr,
    closeDialog,
    afterMutation,
  };
}

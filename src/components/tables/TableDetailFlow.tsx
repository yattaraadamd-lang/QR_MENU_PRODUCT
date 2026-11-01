"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import TableDetailDialog from "./TableDetailDialog";
import type { useTableDetail } from "./useTableDetail";
import type { TableDTO } from "./types";

// Alt pencereler ilk yükte gerekmez: ayrı chunk'ta, detay açılınca önceden indirilir.
// React.lazy (next/dynamic değil): yalnız tıklamayla çizilir, SSR'a girmez; ek çalışma zamanı yok.
const loadPaymentDialog = () => import("./PaymentDialog");
const loadCloseTableDialog = () => import("./CloseTableDialog");
const PaymentDialog = lazy(loadPaymentDialog);
const CloseTableDialog = lazy(loadCloseTableDialog);

type SubDialog = "none" | "pay" | "close";

interface TableDetailFlowProps {
  detail: ReturnType<typeof useTableDetail>;
  /** Admin zorla kapatabilir */
  allowForceClose: boolean;
  /** Ödeme/kapatma sonrası masa listesini yenile */
  onTablesChanged: () => void;
}

/**
 * Masa detayı + üstünde açılan ödeme ve kapatma pencereleri (admin ve garson ortak).
 * Alt pencere detayın üstünde açılır; kapanınca odak detaydaki düğmeye döner.
 */
export default function TableDetailFlow(props: TableDetailFlowProps) {
  const { table } = props.detail;
  // Masa değişince alt pencere durumu sıfırlanır (key ile yeniden takılır)
  return table ? <OpenTableFlow key={table.id} table={table} {...props} /> : null;
}

function OpenTableFlow({
  table,
  detail,
  allowForceClose,
  onTablesChanged,
}: TableDetailFlowProps & { table: TableDTO }) {
  const [sub, setSub] = useState<SubDialog>("none");
  const { billState } = detail;
  const session = table.activeSession;

  // "Ödeme Al"a basıldığında pencere beklemeden açılsın
  useEffect(() => {
    void loadPaymentDialog();
    void loadCloseTableDialog();
  }, []);
  const bill = billState.status === "ready" ? billState.bill : table.bill;
  const closeSub = () => setSub("none");

  const handlePaid = () => {
    closeSub();
    detail.reloadBill();
    onTablesChanged();
  };

  const handleClosed = () => {
    closeSub();
    detail.close();
    onTablesChanged();
  };

  return (
    <>
      <TableDetailDialog
        table={table}
        billState={billState}
        onRetry={detail.reloadBill}
        onClose={detail.close}
        actions={
          <>
            <Button variant="success" size="sm" className="flex-1" onClick={() => setSub("pay")}>
              💰 Ödeme Al
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setSub("close")}>
              🔒 Masayı Kapat
            </Button>
          </>
        }
      />
      <Suspense fallback={null}>
        {session && sub === "pay" && (
          <PaymentDialog table={table} sessionId={session.id} bill={bill} onClose={closeSub} onPaid={handlePaid} />
        )}
        {session && sub === "close" && (
          <CloseTableDialog table={table} allowForce={allowForceClose} onClose={closeSub} onClosed={handleClosed} />
        )}
      </Suspense>
    </>
  );
}

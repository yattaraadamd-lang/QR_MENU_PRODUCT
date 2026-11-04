import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";

/**
 * Platform tahsilat kaydı henüz tutulmuyor (/api/super-admin/platform-payments sabit boş liste
 * döner). Burada toplam gösterilmez: gerçek abonelikler varken "₺0,00" ve "0 abonelik" yanıltıyordu.
 */
export default function SuperAdminPaymentsPage() {
  return (
    <div>
      <h1 className="page-title mb-6">Platform Ödemeleri</h1>
      <EmptyState
        icon="🏗️"
        title="Ödeme kayıtları henüz tutulmuyor"
        description="Platform ödeme kayıtları abonelik sistemi aktifleştirildiğinde burada görünecektir."
        action={
          <Link href="/super-admin/subscriptions" className="btn btn-primary">
            Abonelikleri gör
          </Link>
        }
      />
    </div>
  );
}

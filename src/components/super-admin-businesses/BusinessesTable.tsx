import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ScrollRegion from "@/components/ui/ScrollRegion";
import TruncatedText from "@/components/ui/TruncatedText";
import type { BusinessDTO } from "./types";

interface BusinessesTableProps {
  businesses: readonly BusinessDTO[];
  busyId: string | null;
  onToggle: (business: BusinessDTO) => void;
}

/** İşletmeler tablosu; dar ekranda yatay kayar (klavyeyle de) */
export default function BusinessesTable({ businesses, busyId, onToggle }: BusinessesTableProps) {
  return (
    <ScrollRegion label="İşletmeler tablosu" className="card">
      <table className="table min-w-[50rem]">
        <thead>
          <tr>
            <th scope="col">İşletme Adı</th>
            <th scope="col">Slug</th>
            <th scope="col">Yetkili Email</th>
            <th scope="col">Masa Sayısı</th>
            <th scope="col">Abonelik</th>
            <th scope="col">Durum</th>
            <th scope="col">İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((business) => (
            <tr key={business.id}>
              <td>
                <TruncatedText text={business.name} className="font-semibold text-fg" />
                <TruncatedText text={business.phone || "-"} className="text-xs text-fg-secondary" />
              </td>
              <td className="text-fg-secondary">
                <TruncatedText text={business.slug} width="sm" />
              </td>
              <td>
                <TruncatedText text={business.email || "-"} />
              </td>
              <td className="tabular-nums">{business._count?.tables ?? 0}</td>
              <td>{business.businessSubscriptions?.[0]?.plan?.name || "Bilinmiyor"}</td>
              <td>
                <Badge tone={business.isActive ? "success" : "danger"}>{business.isActive ? "Aktif" : "Pasif"}</Badge>
              </td>
              <td>
                <Button variant="ghost" size="sm" loading={busyId === business.id} onClick={() => onToggle(business)}>
                  {business.isActive ? "🔴 Pasif Et" : "🟢 Aktif Et"}
                  <span className="sr-only">: {business.name}</span>
                </Button>
              </td>
            </tr>
          ))}
          {businesses.length === 0 && (
            <tr>
              <td colSpan={7} className="p-8 text-center text-fg-secondary">
                İşletme bulunamadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

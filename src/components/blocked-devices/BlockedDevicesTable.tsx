import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ScrollRegion from "@/components/ui/ScrollRegion";
import { formatDateTime } from "@/lib/format";
import type { DeviceBlockDTO } from "./types";

interface BlockedDevicesTableProps {
  blocks: readonly DeviceBlockDTO[];
  onUnblock: (block: DeviceBlockDTO) => void;
}

/** Cihaz engelleri tablosu; dar ekranda yatay kayar (klavyeyle de) */
export default function BlockedDevicesTable({ blocks, onUnblock }: BlockedDevicesTableProps) {
  return (
    <ScrollRegion label="Cihaz engelleri tablosu" className="card">
      <table className="table min-w-[50rem]">
        <thead>
          <tr>
            <th scope="col">Cihaz</th>
            <th scope="col">Engel Nedeni</th>
            <th scope="col">Engelleyen</th>
            <th scope="col">Engel Tarihi</th>
            <th scope="col">Durum</th>
            <th scope="col">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.id}>
              <td>
                <code className="rounded-sm bg-surface-hover px-2 py-0.5 font-mono text-xs text-fg-secondary">
                  {block.maskedDeviceHash}
                </code>
              </td>
              <td className="max-w-[12.5rem] truncate text-sm" title={block.reason}>
                {block.reason}
              </td>
              <td className="text-sm">
                {block.createdByName ? (
                  <span className="font-medium text-fg">👤 {block.createdByName}</span>
                ) : (
                  <span className="text-fg-muted">Sistem</span>
                )}
              </td>
              <td className="text-xs text-fg-secondary">{formatDateTime(block.createdAt)}</td>
              <td>
                <BlockStatusCell block={block} />
              </td>
              <td>
                {block.status === "active" && (
                  <Button variant="ghost" size="sm" onClick={() => onUnblock(block)}>
                    🔓 Engeli Kaldır<span className="sr-only">: {block.maskedDeviceHash}</span>
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

function BlockStatusCell({ block }: { block: DeviceBlockDTO }) {
  if (block.status === "active") return <Badge tone="danger">Aktif Engel</Badge>;

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone="success">Kaldırıldı</Badge>
      {block.revokedAt && (
        <p className="text-2xs text-fg-muted">
          {formatDateTime(block.revokedAt)}
          {block.revokedByName && ` — ${block.revokedByName}`}
        </p>
      )}
      {block.revocationNote && <p className="text-2xs italic text-fg-secondary">{block.revocationNote}</p>}
    </div>
  );
}

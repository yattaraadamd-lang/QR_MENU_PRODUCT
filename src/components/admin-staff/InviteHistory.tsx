import { formatDateTime } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { inviteStatus } from "./staffModel";
import type { InviteDTO } from "./types";

interface InviteHistoryProps {
  invites: readonly InviteDTO[];
  now: number;
  onDelete: (invite: InviteDTO) => void;
}

/** Davet geçmişi: oluşturma/son kullanma/kullanım zamanı, durum, iptal */
export default function InviteHistory({ invites, now, onDelete }: InviteHistoryProps) {
  return (
    <ul className="divide-y divide-line">
      {invites.map((invite, index) => {
        const status = inviteStatus(invite, now);
        const title = `Davet #${invites.length - index}`;
        return (
          <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1 text-xs text-fg-secondary">
              <p className="text-base font-bold text-fg">🔗 {title}</p>
              <p>Oluşturulma: {formatDateTime(invite.createdAt)}</p>
              {invite.expiresAt && <p>Son kullanma: {formatDateTime(invite.expiresAt)}</p>}
              {invite.usedAt && <p className="text-success-fg">Kullanıldı: {formatDateTime(invite.usedAt)}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={status.tone}>{status.label}</Badge>
              {status.open && (
                <Button variant="danger-ghost" size="sm" onClick={() => onDelete(invite)}>
                  🗑️ Sil<span className="sr-only">: {title}</span>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

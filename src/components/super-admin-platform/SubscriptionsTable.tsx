import { formatDate, formatTRY } from "@/lib/format";
import { SUBSCRIPTION_STATUS } from "@/components/subscription/subscriptionModel";
import Badge from "@/components/ui/Badge";
import ScrollRegion from "@/components/ui/ScrollRegion";
import TruncatedText from "@/components/ui/TruncatedText";
import { subscriptionEnd } from "./platformModel";
import type { PlatformSubscriptionDTO } from "./types";

/** İşletme abonelikleri; dar ekranda yatay kayar (klavyeyle de) */
export default function SubscriptionsTable({ subscriptions }: { subscriptions: readonly PlatformSubscriptionDTO[] }) {
  return (
    <ScrollRegion label="Abonelikler tablosu" className="card">
      <table className="table min-w-[50rem]">
        <thead>
          <tr>
            <th scope="col">İşletme</th>
            <th scope="col">Plan</th>
            <th scope="col">Durum</th>
            <th scope="col">Aylık Tutar</th>
            <th scope="col">Başlangıç</th>
            <th scope="col">Bitiş</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((subscription) => {
            const status = SUBSCRIPTION_STATUS[subscription.status];
            const end = subscriptionEnd(subscription);
            return (
              <tr key={subscription.id}>
                <td className="font-semibold text-fg">
                  <TruncatedText text={subscription.business?.name || "-"} />
                </td>
                <td>
                  <TruncatedText text={subscription.plan?.name || "-"} />
                </td>
                <td>
                  {status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge tone="neutral">{subscription.status}</Badge>}
                </td>
                <td className="font-semibold tabular-nums text-primary-light">{formatTRY(subscription.plan?.monthlyPrice ?? 0)}</td>
                <td className="tabular-nums">{formatDate(subscription.startedAt)}</td>
                <td className="tabular-nums">{end ? formatDate(end) : "Süresiz"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

import Badge from "@/components/ui/Badge";
import ScrollRegion from "@/components/ui/ScrollRegion";
import TruncatedText from "@/components/ui/TruncatedText";
import { userRoleMeta, userStatusMeta } from "./platformModel";
import type { PlatformUserDTO } from "./types";

/** Platformdaki tüm kullanıcılar; dar ekranda yatay kayar (klavyeyle de) */
export default function UsersTable({ users }: { users: readonly PlatformUserDTO[] }) {
  return (
    <ScrollRegion label="Kullanıcılar tablosu" className="card">
      <table className="table min-w-[50rem]">
        <thead>
          <tr>
            <th scope="col">İsim</th>
            <th scope="col">E-posta</th>
            <th scope="col">Rol</th>
            <th scope="col">İşletme</th>
            <th scope="col">Durum</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const role = userRoleMeta(user.role);
            const status = userStatusMeta(user);
            return (
              <tr key={user.id}>
                <td className="font-semibold text-fg">
                  <TruncatedText text={user.name || "-"} />
                </td>
                <td>
                  <TruncatedText text={user.email} />
                </td>
                <td>
                  <Badge tone={role.tone}>{role.label}</Badge>
                </td>
                <td>
                  <TruncatedText text={user.business?.name || "-"} />
                </td>
                <td>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

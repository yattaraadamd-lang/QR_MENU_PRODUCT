import Badge from "@/components/ui/Badge";
import ScrollRegion from "@/components/ui/ScrollRegion";
import { roleMeta } from "./staffModel";
import type { StaffMemberDTO } from "./types";

/** Personel tablosu; dar ekranda yatay kayar (klavyeyle de) */
export default function StaffTable({ staff }: { staff: readonly StaffMemberDTO[] }) {
  return (
    <ScrollRegion label="Personel tablosu">
      <table className="table min-w-[32rem]">
        <thead>
          <tr>
            <th scope="col">İsim</th>
            <th scope="col">E-posta</th>
            <th scope="col">Rol</th>
            <th scope="col" className="text-center">
              Durum
            </th>
          </tr>
        </thead>
        <tbody>
          {staff.map((user) => {
            const role = roleMeta(user.role);
            return (
              <tr key={user.id}>
                <td className="font-semibold text-fg">{user.name}</td>
                <td className="text-fg-secondary">{user.email}</td>
                <td>
                  <Badge tone={role.tone}>{role.label}</Badge>
                </td>
                <td className="text-center">
                  <Badge tone={user.isActive ? "success" : "danger"}>{user.isActive ? "✅ Aktif" : "❌ Pasif"}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

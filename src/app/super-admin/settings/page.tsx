"use client";

import { useId } from "react";
import { useSession } from "next-auth/react";
import { userRoleMeta } from "@/components/super-admin-platform/platformModel";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

/** API henüz yok: değerler örnek, alanlar kapalı ("kaydedildi" ya da düzenlenebilir görünmek yanıltırdı) */
const PLACEHOLDER_FIELDS = [
  { key: "name", label: "Platform Adı", value: "QR Menu SaaS" },
  { key: "trial", label: "Varsayılan Deneme Süresi (Gün)", value: "14" },
  { key: "support", label: "Destek E-posta", value: "destek@qrmenu.com" },
] as const;

export default function SuperAdminSettingsPage() {
  const { data: session } = useSession();
  const id = useId();
  const user = session?.user;

  return (
    <div>
      <h1 className="page-title mb-6">Platform Ayarları</h1>

      <div className="card flex max-w-[600px] flex-col gap-4 p-6">
        {PLACEHOLDER_FIELDS.map((field) => (
          <Field key={field.key} label={field.label} htmlFor={`${id}-${field.key}`}>
            <input id={`${id}-${field.key}`} className="input opacity-60" value={field.value} disabled readOnly />
          </Field>
        ))}

        <section aria-labelledby={`${id}-account`}>
          <h2 id={`${id}-account`} className="mb-1.5 text-[13px] font-semibold text-fg-secondary">
            Süper Admin Bilgisi
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-md border border-line bg-surface-muted p-4 text-sm">
            <dt className="font-bold text-fg">İsim:</dt>
            <dd className="min-w-0 break-words text-fg">{user?.name || "-"}</dd>
            <dt className="font-bold text-fg">E-posta:</dt>
            <dd className="min-w-0 break-words text-fg">{user?.email || "-"}</dd>
            <dt className="font-bold text-fg">Rol:</dt>
            <dd className="min-w-0 break-words text-fg">{user?.role ? userRoleMeta(user.role).label : "-"}</dd>
          </dl>
        </section>

        <p className="mt-2 text-[13px] text-fg-secondary">
          Platform ayarlarını kaydetme yakında eklenecek; buradaki değerler şimdilik örnek olarak gösteriliyor.
        </p>
        <Button size="lg" disabled>
          <span aria-hidden="true">💾</span> Kaydet (yakında)
        </Button>
      </div>
    </div>
  );
}

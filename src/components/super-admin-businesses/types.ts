/** Süper admin işletme yönetimi sözleşmesi. Kaynak: /api/super-admin/businesses */

export interface BusinessDTO {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly isActive: boolean;
  readonly _count?: { readonly tables: number; readonly products: number };
  readonly businessSubscriptions?: readonly { readonly plan: { readonly name: string } }[];
}

/** Yeni işletme + ilk admin hesabı */
export interface CreateBusinessInput {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly adminName: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
}

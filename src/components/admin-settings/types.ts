/** İşletme ayarları sözleşmesi. Kaynak: /api/admin/business */

export interface BusinessDTO {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
}

export interface BusinessInput {
  readonly name: string;
  readonly description: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
}

/** Form durumu: boş alan "" (kontrollü input), sunucuya null gider */
export type BusinessFormValues = Readonly<Record<keyof BusinessInput, string>>;

/** lib/validation.ts updateBusinessSchema ile aynı */
export const BUSINESS_LIMITS = { name: 200, description: 1000, phone: 30, address: 500 } as const;

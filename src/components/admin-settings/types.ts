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

/** Form durumu: boş alan "" (kontrollü input), sunucuya null gider. Sınırlar: contracts/business.ts */
export type BusinessFormValues = Readonly<Record<keyof BusinessInput, string>>;

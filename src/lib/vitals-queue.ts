/** /api/vitals'a giden tek ölçü; sunucu her alanı ayrıca doğrular */
export interface VitalReport {
  readonly name: string;
  readonly value: number;
  readonly rating?: string;
  readonly navigationType?: string;
  /** Rota deseni: QR token'ı, davet kodu ve işletme/masa kimliği gitmez */
  readonly route: string;
}

/**
 * Web Vitals kuyruğu (FE-ARCH-3.9b): ölçüler geldikçe gönderilmez, sayfa gizlenince tek istekte
 * (`{ metrics: [...] }`) gider. Önceden her ölçü ayrı beacon'dı: her açılışta 2–3 istek, aynı
 * milisaniyede. Aynı ölçünün yenisi (ör. bfcache dönüşünden sonra) eskisinin yerini alır; kuyruk
 * en çok ölçü türü kadar büyür.
 */
export function createVitalsQueue(send: (body: string) => void) {
  const pending = new Map<string, VitalReport>();
  return {
    add(report: VitalReport): void {
      pending.set(report.name, report);
    },
    flush(): void {
      if (pending.size === 0) return;
      const metrics = [...pending.values()];
      pending.clear();
      send(JSON.stringify({ metrics }));
    },
  };
}

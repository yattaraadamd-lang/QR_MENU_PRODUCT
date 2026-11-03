import type { TableDTO } from "./types";

/**
 * Masanın görünen adı. Ayrı dosya: yalnız adı gereken ekran (dashboard) tableModel'in durum
 * tablolarını paketine çekmesin (istemci chunk'ında kullanılmayan export elenmiyor).
 */
export function tableDisplayName(table: Pick<TableDTO, "tableName" | "tableNumber">): string {
  return table.tableName || `Masa ${table.tableNumber}`;
}

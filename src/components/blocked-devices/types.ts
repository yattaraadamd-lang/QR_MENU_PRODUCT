/** Cihaz engelleri sözleşmesi. Kaynak: /api/admin/customer-access-blocks */

export type BlockStatus = "active" | "revoked";
export type BlockFilter = BlockStatus | "all";

export interface DeviceBlockDTO {
  readonly id: string;
  /** Sunucuda maskelenmiş cihaz parmak izi (tam değer istemciye gelmez) */
  readonly maskedDeviceHash: string;
  readonly reason: string;
  readonly createdByName: string | null;
  readonly createdAt: string;
  readonly revokedAt: string | null;
  readonly revokedByName: string | null;
  readonly revocationNote: string | null;
  readonly status: BlockStatus;
}

export interface PaginationDTO {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface BlockPage {
  readonly blocks: readonly DeviceBlockDTO[];
  readonly pagination: PaginationDTO;
}

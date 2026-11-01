/**
 * Marka motifinin QR matrisi. Gerçek bir QR sürüm 1'in (21×21) iskeletini taşır:
 * üç köşede bulucu desen, aralarında zamanlama çizgisi; veri alanı sabit tohumlu
 * sözde rastgele. Okunabilir bir kod değildir, yalnız biçimdir. Sunucuda bir kez
 * hesaplanır; aynı tohum her derlemede aynı deseni verir.
 */

export const QR_SIZE = 21;
const FINDER = 7;
const TIMING_LINE = 6;
const SEED = 2026;

export interface QrCell {
  readonly x: number;
  readonly y: number;
}

/** mulberry32: küçük, deterministik PRNG */
function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FINDER_ORIGINS: readonly (readonly [number, number])[] = [
  [0, 0],
  [QR_SIZE - FINDER, 0],
  [0, QR_SIZE - FINDER],
];

/** Bulucu desen + 1 hücrelik boş ayırıcı bandı */
function finderAt(x: number, y: number): { readonly zone: boolean; readonly on: boolean } {
  for (const [ox, oy] of FINDER_ORIGINS) {
    const dx = x - ox;
    const dy = y - oy;
    if (dx < -1 || dx > FINDER || dy < -1 || dy > FINDER) continue;
    const inside = dx >= 0 && dx < FINDER && dy >= 0 && dy < FINDER;
    if (!inside) return { zone: true, on: false };
    const ring = dx === 0 || dy === 0 || dx === FINDER - 1 || dy === FINDER - 1;
    const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
    return { zone: true, on: ring || core };
  }
  return { zone: false, on: false };
}

function buildCells(): readonly QrCell[] {
  const random = createRandom(SEED);
  const cells: QrCell[] = [];
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      const finder = finderAt(x, y);
      const on = finder.zone
        ? finder.on
        : x === TIMING_LINE || y === TIMING_LINE
          ? (x + y) % 2 === 0
          : random() > 0.52;
      if (on) cells.push({ x, y });
    }
  }
  return cells;
}

export const QR_CELLS: readonly QrCell[] = buildCells();

/** Sütun sütun hücreler: motif dönüşümü sütun sırasıyla ilerler */
export const QR_COLUMNS: readonly (readonly QrCell[])[] = Array.from({ length: QR_SIZE }, (_, x) =>
  QR_CELLS.filter((cell) => cell.x === x),
);

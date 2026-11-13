import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { DEMO_PRODUCT_IDS, demoProductImage } from "./demo-data";

const MIGRATION = "prisma/migrations/20261112120000_demo_product_images/migration.sql";

test("her demo ürününün görseli public/ altında var", () => {
  const missing = DEMO_PRODUCT_IDS.filter((id) => !existsSync(join("public", demoProductImage(id))));
  assert.deepEqual(missing, []);
});

test("canlı demo migration'ı tanımdaki ürünleri aynı yollarla yazar", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const written = [...sql.matchAll(/\('(prod-[a-z-]+)', '([^']+)'\)/g)].map(([, id, image]) => [id, image]);
  const expected = DEMO_PRODUCT_IDS.map((id) => [id, demoProductImage(id)]);
  assert.deepEqual(written, expected);
});

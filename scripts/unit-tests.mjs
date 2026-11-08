// Birim testleri (FE-ARCH-2.3): src altındaki *.test.ts dosyalarını Node'un yerleşik test
// koşucusuyla çalıştırır; TypeScript ve @/ yolları tsx ile çözülür. Yeni bağımlılık yok.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const files = readdirSync("src", { recursive: true })
  .filter((file) => typeof file === "string" && file.endsWith(".test.ts"))
  .map((file) => join("src", file))
  .sort();

// Testler yanlışlıkla silinirse CI sessizce yeşil kalmasın
if (files.length === 0) {
  console.error("Birim testi bulunamadı (src/**/*.test.ts).");
  process.exit(1);
}

const args = ["--import", "tsx", "--test", "--test-reporter=spec", ...files];
const { status } = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(status ?? 1);

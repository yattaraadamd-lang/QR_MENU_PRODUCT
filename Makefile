# Olgunluk denetimi. Windows'ta make yoksa: npm run audit:maturity
BASE ?= https://qr-menu-product.onrender.com

.PHONY: audit audit-static audit-deps crawl lighthouse

## Canlıya istek atmayan tüm kontroller (CI'da da çalışır)
audit: audit-static audit-deps
	npx tsc --noEmit

audit-static:
	node maturity-audit/tests/route-guards.mjs
	node maturity-audit/tests/secret-scan.mjs
	node maturity-audit/tests/seo-static.mjs

## Üretim bağımlılıklarında kritik açık kapısı (kullanılmayan optional peer hariç) + tam rapor
audit-deps:
	npm audit --omit=dev --omit=peer --audit-level=critical
	-npm audit

## Salt-okunur, ≤1 istek/sn tarama. Yalnızca sahibinin onay verdiği hostlarda çalıştırın.
crawl:
	node maturity-audit/tests/crawl.mjs --base $(BASE) --out maturity-audit/evidence/crawl-latest.json

## Mobil Lighthouse (Chrome gerekir)
lighthouse:
	npx --yes lighthouse@13.5.0 $(BASE)/ --quiet --form-factor=mobile --output=json --output-path=maturity-audit/evidence/lighthouse/home-latest.json --chrome-flags="--headless=new"

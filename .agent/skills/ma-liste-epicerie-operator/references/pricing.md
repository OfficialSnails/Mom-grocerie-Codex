# Prices, evidence and history

Start with the current affected raw item, actual flyer/proof and generated item. Old receipt amounts are not current test facts.

## Ownership and lineage

| Concern | Source |
|---|---|
| Collection | `sources/flipp-adapter.ts`, `sources/csv-adapter.ts`, `src/collect-current-deals.ts` |
| Normalize/score/classify/export | `src/normalize-price.ts`, `normalize-product.ts`, `deal-score.ts`, `generate-report.ts` |
| OCR/crops/evidence | `src/proof-ocr.ts`, `proof-crop.ts`, `offer-evidence.ts`, `build-offer-evidence.ts`, `refresh-offer-quality.ts` |
| Reviewed facts | `data/offer-proof-facts.json` with source proof, never arbitrary display overrides |
| Comparison/identity | `website/offer-identity.js`, `product-details.js`, `price-comparison.js`, `price-context.js` |
| Estimates | `src/price-estimate.ts`, consumers in `website/app.js` / `saved-lists.js` |
| History | `src/update-history.ts`, `price-history.ts`; `website/price-history-data.js`, `price-history.js`, `price-history-chart.js` |
| Visual proof/flyers | `website/proof-image.js`, `flyer-pages.js`, `flyers.js` |

Trace a changed field through weekly/regional/evidence JSON, history, basket/saved snapshots and both PDFs only where actually consumed.

## Correctness rules

- Distinguish checkout price from comparable unit price. Different package sizes require confirmed identity, quantity and unit. A known count of avocados does not imply a known mass.
- Same-quantity savings use a documented comparison basis and selected-store scope. Weight savings stay per-unit until purchased weight is known; do not count them as fixed basket savings.
- Conservative totals count confirmed fixed/package prices and exclude variable or genuinely unconfirmed formats with a readable caveat. `unit: null` plus a number establishes neither “fixed” nor “unknown”: inspect evidence and current behavior. If an unrelated audit finds a gap, report it instead of claiming it already works.
- Preserve structured `currentPrice`, shopper `price`, `unit`, dates and evidence. Prefer structured values over parsing formatted strings.
- Keep history distinct by actual identity, store, format, unit and source. Unknown formats can display observations but do not prove equal-quantity savings. Show actual dates/deltas; invent no records or usual-price history.
- A proof image must show the actual product and offer. Use original pixels/crops, never AI imagery or a neighboring tile. Prefer a missing-image placeholder to false proof.
- Append high-confidence OCR recoveries before scoring/classification/deduplication so all outputs share them. Validate product keywords and price/rebate context in the crop.
- Fix categories in `src/generate-report.ts`; pantry is the fallback after stronger rules. Rebuild cleanup from saved raw data, not a fresh scrape or hand-edited JSON. Follow the root weekly skill for cycle/CSV/Costco constraints.

## Validation

Relevant suites: `normalize-price`, `normalize-product`, `deal-score`, `product-details`, `price-estimate`, `offer-evidence`, `offer-quality`, `proof-ocr`, `price-history`, `report-generation`. Invoke explicit files with `npx vitest run tests/<name>.test.ts`.

Add regressions for the real failure: unequal packages, incompatible units, unknown format, duplicate offers, member conditions, proof mismatch or missing history. Check basket/snapshot/PDF parity when calculations change.

After category changes run `npm run qa:pantry` and `npm run qa:categories`; ambiguous flags need source review. Recheck changed source fields after rebuild and visually inspect affected products/charts. Image HTTP 200 is not proof that the correct product is shown.

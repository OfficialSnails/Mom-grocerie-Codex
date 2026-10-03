# Offer quality repair — October 3, 2026

Scope: the side-conversation request to improve incomplete photos, retain equal-price store offers, and check categories with reusable rules.

## Implemented

- Thin source cutouts use the original flyer pixels around source-associated offer text. Shared adjacent pictures qualify only when their source price and text area agree. Invalid, distant or insufficient geometry retains the original image. Both collection paths attach this optional metadata for future weeks; the website never scrapes.
- Equal-price offers remain individually selectable. A neutral “Même prix ailleurs” pill opens the other store's offer; equal prices do not create cross-store savings.
- Classification fixes separate brand fragments from medicine, ingredients from product types, dishwasher tablets from throat lozenges, cosmetics from dairy, and refrigerated/frozen dough from health products. Regional collection now preserves the full bilingual source name, including frozen-product context.
- Reviewed cabbage proofs show 0,99 $/lb; reviewed broccoli proofs show 2 pour 4,98 $. The shared UI/PDF evidence helper retains the bundle amount and applies weight units before estimates.
- The wider clementine proof exposes a feed error: structured price 2.70 versus printed 2.77. The photo-reviewed correction applies only to that exact source photo/feed amount. The original 2.70 remains in the source snapshot; UI/list/PDF inputs use 2.77 and the 908 g package. The conflicting feed percentage is suppressed.
- A guarded, dry-run-first repair command updates current category/evidence snapshots without rescoring or deleting offers: `node --import tsx src/refresh-offer-quality.ts` (review), then `--write`. Existing runtime offer IDs are materialized before regrouping so saved lists survive category changes.

## Current snapshot results

| Region | Offers retained | Category corrections | Wider source photos |
|---|---:|---:|---:|
| Joliette | 1479 | 58 | 50 |
| Montréal | 1657 | 76 | 69 |
| Québec | 1659 | 77 | 69 |

These are regional records, not unique products. Full before/after comparison confirms IDs, fetched prices, dates, units, references, selected-mode membership and all other business fields are unchanged in week snapshots; only categories, retained source-name context and stable-ID metadata differ. Evidence supplies the reviewed display corrections. Receipts: `output/photo-quality-review/preservation.json`, `repair-receipt.json`; pre-repair copies under `before/`.

## Validation

- `npm test`: 198 tests passed (including concurrent workspace work); 43 focused offer-quality regression cases.
- `npm run qa:pantry` and `npm run qa:categories`: pass. Imported checks across all 4,795 regional records: zero current high-confidence errors, ambiguous findings or pantry findings.
- JavaScript syntax and scoped diff whitespace checks pass. No lint/build script is configured.
- `npx tsc --noEmit`: still 23 pre-existing errors (CSV adapter, history updater, older report test fixtures); none in the new modules.
- Real browser: wider clementine photo and matching 2.77 price; broccoli's two-for display; competitor-only equal-price modal; add/reload/remove preserves the selected offer and adds 4.98 to the fixed total; cabbage retains 0.99/lb and adds no fixed subtotal. No console errors in the test tab.
- Mobile: no horizontal overflow at 320 and 390 px. Enlarged photo remains within the 390 px viewport. Screenshot: `output/photo-quality-review/clementines-mobile.png`.
- Local preview restarted on port 4187 to load updated PDF evidence logic, HTTP 200 confirmed. Temporary test server on 4188 was stopped. The user's localhost shopping list was not edited; selection tests used a separate origin and removed their test additions.
- PDF input normalization and estimate parity were regression-tested; a new Desktop PDF export was not performed in this side task.

## Files

Classifier/collection: `src/generate-report.ts`, `sources/flipp-adapter.ts`, `sources/source-adapter.ts`, `src/refresh-regions.ts`.

Proof/evidence and repair: `src/proof-crop.ts`, `src/offer-evidence.ts`, `src/refresh-offer-quality.ts`, `data/offer-proof-facts.json`.

Rendering/shared PDF inputs: `website/proof-image.js`, `website/offer-identity.js`, `website/product-details.js`, small integration edits in `website/app.js`, `website/index.html`, `website/shopping-workspace.css`, `src/serve-website.ts`.

Tests: `tests/offer-quality.test.ts`; the existing active-week QA test now reads the active index instead of the May 14 archive. Current three regional week/evidence bundles were regenerated through the guarded repair command. Continuity ledger updated.

## Boundaries and remaining limitations

No deployment, Git write, full weekly run, rescoring, history update, Obsidian export or older-week regeneration. Concurrent UI/list work was preserved.

Photo repair requires usable source geometry; it cannot reconstruct a missing subject. Automated category checks and targeted visual checks do not establish that every future flyer is error-free. Newly ambiguous formats or source-price mismatches still require source review; no prices are invented from a percentage or a nearby product.

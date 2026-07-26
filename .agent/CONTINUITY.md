# Continuity

## Snapshot
Goal: Generate and publish the weekly Quebec grocery data.
Now: Week `Semaine du 23 au 29 juillet 2026` is generated, QA-validated, locally verified, and deployed to Cloudflare Pages.
Next: Commit/push generated artifacts if the user wants the repo history updated.
Open questions: None.

## Decisions
D001 ACTIVE: [USER] Weekly runs target the upcoming Thursday-to-Wednesday flyer cycle, using Joliette only as the Quebec source anchor.

## State
Done:
- 2026-06-24T15:00-04:00 [TOOL] Ran `BONS_SPECIAUX_RUN_DATE=2026-06-25T12:00:00-04:00 npm run weekly`; Flipp/Wishabi collected 1765 priced source items and generated 75 bons prix plus 1403 total products for `25 juin au 1 juillet 2026`.
- 2026-06-24T15:06-04:00 [TOOL] Deployed `website/` with `npm run deploy:cloudflare`; live `index.json` now points first to `semaine-du-25-juin-au-1-juillet-2026`.
- 2026-07-01T13:02-04:00 [TOOL] Preflight found committed conflict markers in generated files `website/data/weeks/index.json` and `data/source_status.json`; restored valid JSON so the weekly pipeline could run. Evidence: `rg -n '^(<<<<<<<|=======|>>>>>>>)'`.
- 2026-07-01T13:28-04:00 [TOOL] Ran `BONS_SPECIAUX_RUN_DATE=2026-07-02T12:00:00-04:00 npm run weekly`; Flipp/Wishabi collected 1610 priced source items and generated week `2 au 8 juillet 2026` with live Thursday-overlapping flyers.
- 2026-07-01T13:29-04:00 [TOOL] Deployed `website/` with `npm run deploy:cloudflare`; production and deploy URL both serve `semaine-du-2-au-8-juillet-2026` first in `data/weeks/index.json`.
- 2026-07-09T22:09-04:00 [TOOL] Ran `npm run weekly` without run-date override; Flipp/Wishabi collected 1564 priced source items and generated week `9 au 15 juillet 2026`.
- 2026-07-09T22:43-04:00 [TOOL] Deployed `website/` with `npm run deploy:cloudflare`; production `data/weeks/index.json` serves `semaine-du-9-au-15-juillet-2026` first.
- 2026-07-15T13:01-04:00 [USER] Wednesday automation should target the upcoming Thursday-to-Wednesday flyer cycle when live flyers are available.
- 2026-07-15T13:32-04:00 [TOOL] Ran `BONS_SPECIAUX_RUN_DATE=2026-07-16T12:00:00-04:00 npm run weekly`; live Flipp/Wishabi flyers overlapped `2026-07-16 -> 2026-07-22`, 18 dated CSV rows were skipped as out-of-range supplements, and the pipeline generated week `16 au 22 juillet 2026`. OCR proof recovery stayed enabled and made the run materially slower. Evidence: `reports/weeks/Semaine du 16 au 22 juillet 2026/`, `website/data/weeks/semaine-du-16-au-22-juillet-2026/week.json`.
- 2026-07-15T13:33-04:00 [TOOL] Deployed `website/` with `npm run deploy:cloudflare`; live `https://bons-speciaux-joliette.pages.dev/data/weeks/index.json` serves `semaine-du-16-au-22-juillet-2026` first. Deploy URL: `https://b1ed72cb.bons-speciaux-joliette.pages.dev`.
- 2026-07-22T13:02-04:00 [TOOL] Preflight in the trusted Codex workspace found committed line-start conflict markers across generated grocery artifacts, including invalid `website/data/weeks/index.json`. Restored the conflict-marked generated files from clean parent commit `5484c5a` to recover a valid generation baseline before running the weekly pipeline. Evidence: `rg -n '^(<<<<<<<|=======|>>>>>>>)'`, `git restore --source=5484c5a`.
- 2026-07-22T13:30-04:00 [TOOL] Ran `BONS_SPECIAUX_RUN_DATE=2026-07-23T12:00:00-04:00 npm run weekly`; live Flipp/Wishabi flyers overlapped `2026-07-23 -> 2026-07-29`, 18 dated CSV rows were skipped as out-of-range supplements, and the pipeline generated week `23 au 29 juillet 2026` with 87 bons prix and 1447 total produits. Evidence: `reports/weeks/Semaine du 23 au 29 juillet 2026/`, `website/data/weeks/semaine-du-23-au-29-juillet-2026/week.json`.
- 2026-07-22T13:35-04:00 [CODE] Fixed a category-QA blocker by teaching `classifyShopperCategory` to keep apple pouch / squeeze-fruit flyer products in produce even when raw English text contains `fruit snacks`. Evidence: `src/generate-report.ts`, `tests/report-generation.test.ts`.
- 2026-07-22T13:36-04:00 [TOOL] Rebuilt week `23 au 29 juillet 2026` after the classifier fix; category QA then passed with 0 high-confidence errors and 9 ambiguous frozen-item review cases. Evidence: `reports/qa/category-review-semaine-du-23-au-29-juillet-2026.md`.
- 2026-07-22T13:37-04:00 [TOOL] Deployed `website/` with `npm run deploy:cloudflare`; deploy URL `https://b087d092.bons-speciaux-joliette.pages.dev` and repeated cache-busted reads from production `https://bons-speciaux-joliette.pages.dev/data/weeks/index.json` now serve `semaine-du-23-au-29-juillet-2026` first.

In progress:
- None.

Blocked:
- None.

## Working set
Relevant files:
- `src/generate-report.ts`
- `tests/report-generation.test.ts`
- `website/data/weeks/index.json`
- `website/data/weeks/semaine-du-23-au-29-juillet-2026/week.json`
- `reports/weeks/Semaine du 23 au 29 juillet 2026/`
- `website/data/weeks/index.json`
- `website/data/weeks/semaine-du-16-au-22-juillet-2026/week.json`
- `reports/weeks/Semaine du 16 au 22 juillet 2026/`
- `data/historical_prices.csv`
- `data/source_status.json`

## Receipts
- `npm test`: 117/117 passed.
- `node --check website/app.js`: passed.
- `npm run qa:pantry`: passed, no high-confidence suspicious pantry items in `website/data/weeks/semaine-du-23-au-29-juillet-2026/week.json`.
- `npm run qa:categories`: passed, 0 high-confidence errors, 9 ambiguous review items, report at `reports/qa/category-review-semaine-du-23-au-29-juillet-2026.md`.
- Local verification: Chrome DevTools snapshot of `http://localhost:4187/` showed week button `Semaine du 23 au 29 juillet 2026 · 87 bons prix`, selected week `Liste d'épicerie — 23 au 29 juillet 2026`, and `curl http://localhost:4187/data/weeks/index.json` returned latest week `23 au 29 juillet 2026`.
- Live verification: repeated cache-busted reads from `https://bons-speciaux-joliette.pages.dev/data/weeks/index.json` returned latest week `23 au 29 juillet 2026`.

## Follow ups
- Commit/push generated files if desired; no commit was created by Codex in this run.

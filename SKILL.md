# Skill: grocery-codex

**Trigger:** `/grocery`
**Workspace:** `/Users/slugz/Desktop/Mes Document/CLAUDE CODING APP/SEQUENCER VIDEO APP/Mom grocerie Codex`

## Purpose

Generate a weekly Quebec-facing grocery report that a real shopper can actually use. Joliette is the postal-code anchor for fetching Quebec flyers, but the shopper-facing app and store names should stay generic rather than Joliette-branded.

The official human output is:

- `reports/weeks/Semaine du .../00 Liste d'épicerie.md`
- `reports/weeks/Semaine du .../01 Choix d'items.md`
- `reports/weeks/Semaine du .../02 Sélection par épicerie.md`

The weekly folder must also be exported automatically to:

- `/Users/slugz/Library/CloudStorage/Dropbox/OTHERS/OBSIDIAN MD/Bons speciaux/Semaine du .../`

The weekly run must also update the static local website data:

- `website/data/weeks/index.json`
- `website/data/weeks/<week-slug>/week.json`

## Required behavior

When running this skill:

1. Prefer live flyer data from Flipp/Wishabi
2. Use manual CSV only as supplement or fallback
3. Never let a CSV-only or mock-only run overwrite a live weekly result
4. Keep source provenance visible
5. Treat all prices as CAD
6. Show the sale unit when known (`/lb`, `/kg`, `/L`, `each`)
7. Show the normalized scale when useful, especially `/lb` items with `/kg` equivalents
8. When `tesseract` is available, run the proof-photo OCR recovery pass after the structured Flipp/Wishabi collection and before scoring. This pass should recover high-confidence visual-only offers from complex flyer tiles, then recover obvious units (`/100g`, `/lb`, `/kg`) that Flipp did not expose in structured data.
9. Say when the unit is not confirmed instead of implying a per-unit format, but keep it short: `Format à vérifier sur la photo.` when a proof image exists, or `Format non confirmé.` without an image.
10. Prefer embedded proof images over weak generic flyer links when available
11. Keep the shopper-facing output simple enough for phone reading
12. Add the `bons-speciaux` Obsidian CSS class to shopper-facing notes
13. Install/update the `bons-speciaux.css` Obsidian snippet during export
13. In `01 Choix d'items.md`, render each product as `- [ ] **Produit** — **Prix**`
14. Keep `📍 **Magasin:**`, `⚖️ **Échelle:**`, `✅ **Pourquoi:**`, and comparisons in a quoted detail block under the product
15. Do not wrap checkbox products inside callouts or raw HTML; Obsidian shows broken Markdown markers in live preview when interactive content is nested that way
16. Put a section summary at the top, then render standard Markdown section headings and normal checkbox lists
17. Keep proof photos open inline; do not hide individual product photos in collapsed blocks
18. Keep the website frontend data-only: the website reads generated JSON and must not scrape live sources
18a. Keep `DESIGN.md` as the website visual contract. UI changes should reuse its linen/evergreen palette, Playfair Display headings, Inter body text, card/button/total-block tokens, and readability principles without redesigning the shopping flow.
19. After website UI/data-rendering changes, run the local website and validate it in a real browser
20. Prefer Agent Browser or Playwright for that browser validation when available; verify week loading, product selection, sidebar final list, clearing/removal, print/export, proof photos, prices, units and store labels
21. Keep the website as a 3-zone shopping workspace: week/search/rayon controls on top, one active rayon in the center, and the final basket on the right
21a. Keep the store filter in the top controls as a compact full-width checkbox card. `Épiceries régulières` selects all non-Costco stores; `Tout inclure` selects every available store including Costco; `Tout décocher` clears the selection and must show `Choisis au moins une épicerie pour voir les produits.` without silently reselecting stores. Costco is available but unchecked by default.
21aa. Store selection must persist while clicking rayons; category counts and product cards stay scoped to the selected stores and current mode. Do not silently reset store selection.
21ab. The website must include `Tous` as the first rayon. `Tous` is a virtual frontend filter option, not a generated product category; it shows every product for the current mode and current store filter.
21b. Cloudflare Pages deployment serves the static `website/` folder. Use `npm run cloudflare:login` once and `npm run deploy:cloudflare` to publish; never publish `.env`, `.cache/`, `node_modules/`, `output/`, or logs.
21c. GitHub weekly automation lives in `.github/workflows/weekly-cloudflare.yml`. It requires GitHub secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and optionally `FIRECRAWL_API_KEY`; it regenerates weekly data, commits generated outputs, and deploys Cloudflare Pages.
21d. Before any deploy, validate that no generated artifact contains Git conflict markers. Run a repo scan for `<<<<<<<`, `=======`, and `>>>>>>>` outside `.git/` and `node_modules/`, then parse `website/data/weeks/index.json` and every `website/data/weeks/*/week.json`. Never deploy if these checks fail. If conflict markers appear only in generated grocery artifacts, prefer regenerating clean outputs from the normal pipeline or existing raw data instead of hand-editing JSON.
22. Do not use category navigation that scrolls the user up and down through the full page; rayon clicks should switch the active category in place
22a. Rayons should wrap into visible button rows. Do not use a horizontal scroller for category pills. Use enough card width and normal word wrapping so labels never split inside a word such as `Boulangerie`.
22b. Rayon counts must always be scoped by the selected mode and selected store. The `Tous` count is the total for that same scope. Rayon cards show available product totals only, never selected/total ratios; selected counts belong only in the panier/header/final list.
23. In local mode, `Exporter PDF` should call the Node server endpoint and save a clean PDF directly to `~/Desktop`; do not make it browser print-only. The exported PDF should stay simple: store, address, product, price, notes, a safe `Total estimé` near the top, store-level subtotals, and `Total estimé de la liste` at the end, without the website explanation note or reason columns.
23a. The website final basket and PDF export must calculate `Total estimé` at selection/export time from generated product data. Preserve `currentPrice`, `price`, and `unit` in every weekly website JSON item. Count fixed/package prices in the subtotal; exclude `/kg`, `/lb`, `/100g`, `/L`, and unclear prices, then show a short note that those products are not included because quantities can change. PDF exports must include the same caveat for taxes, deposits, real quantities, and weight-based prices.
23b. Keep a small `Partager` action beside `Exporter PDF`. On mobile or browsers with Web Share file support, it should generate the same PDF and open the native share sheet so the shopper can send it to herself. If native sharing is unavailable, fall back to a normal PDF download and show a clear status message.
24. Remember that direct Desktop export is a local-server capability. A hosted static site cannot silently write files to a user's Desktop. Hosted/mobile users should get a real downloadable/shareable PDF instead.
25. Keep search available in the top controls so the shopper can find a product across all rayons without browsing every section
25b. Search overrides the active category. If a shopper searches `baguette` while `Fruits et légumes` is active, search every category in the active mode. If store filters are active, search every category inside those selected stores only.
25c. Store selection persists when a shopper clicks category/rayon buttons. Category counts and results must be scoped by the current mode and selected store checkboxes.
25a. Use the custom in-page week dropdown, not the native select, so the week menu does not float over the search field.
26. Preserve clear basket feedback through product count, selected product badge, and sidebar contents. Do not add a large header toast for every add/remove action.
27. Render website products as premium product cards: proof image first, product/price/store below, explicit `Ajouter` control
28. If a product has no image, keep a polished placeholder box instead of collapsing the card layout
29. Keep the source/method explanation as a compact closed-by-default dropdown under the top `Québec / Liste d'épicerie` title, not inside the filter card: stores used, CAD prices, Costco bulk/member caveat, up-to-20-per-rayon limit, and no-padding rule for short sections
30. Do not pad thin rayons with weak or fake deals. A rayon can show fewer than 20 items when only that many verified, useful, non-duplicate deals survive.
31. Classify groceries by how a real shopper thinks: celery/céleri belongs in produce; breaded fish and cold cuts belong in meat/fish; pizza belongs in frozen even when the name includes tomato; bologne/bologna, pepperoni, chorizo, rosette, sauciflard, salami, mortadelle, prosciutto and viandes froides belong in meat, even when the raw source category says pantry/epicerie.
32. Deduplicate obvious same-family winners before filling categories, including bologne, sauciflard/chorizo, and extra-lean ground beef. Keep beef rosettes separate from sauciflard/chorizo.
33. Hide low-value visible reasons such as `Premier aperçu retenu` and `Bon prix si tu en as besoin`. Keep only useful reasons such as percent savings, historical savings, or concrete cross-store savings.
34. Use Thursday-to-Wednesday flyer labels for generated weeks, for example `14 au 20 mai 2026`, `21 au 27 mai 2026`, and `28 mai au 3 juin 2026`. Keep old folders readable; do not destructively rename existing weeks.
34a. When the user asks to "run weekly", "generate this week", "generate next week", or says new flyers should be valid starting Thursday, target the upcoming/current flyer cycle that begins on Thursday, not merely today's calendar week if today is Wednesday. On Wednesday preview runs, first check whether live Flipp/Wishabi results contain a materially new Thursday flyer cycle. If the normal `npm run weekly` would still label the old Wednesday-ending week, run the same normal pipeline with the run date forced to the upcoming Thursday using `BONS_SPECIAUX_RUN_DATE=<THURSDAY_ISO_DATE> npm run weekly`, then clearly report that override. Never copy last week's products into a future-dated folder; the new folder must be based on live flyer data whose valid dates overlap that generated Thursday-to-Wednesday week. If the source returns almost identical data, say that the flyers may not be released yet or the source did not expose them.
35. The website has two top-level modes: `Bons prix` by default for retained deals, and `Tous les produits` for every product found in the generated report. Full-list products must use `Produit trouvé` wording and must not be presented as deals unless the deal shortlist supports that.
35a. In `Tous les produits`, deduplicate obvious duplicate flyer extraction variants before writing website JSON: same store, same price, and near-identical title. A matching proof image is strong evidence, but Flipp/Wishabi can expose the same flyer tile with different image URLs, so title similarity is required. Prefer the richer title. Do not merge across stores, prices, or clearly different product names.
35b. Include Costco through the existing Flipp/Wishabi source as `costco-quebec` / `Costco` when its flyer and item dates overlap the generated week. Do not run a separate Costco scraper unless Flipp/Wishabi fails and a human asks. Costco may have monthly/longer flyer periods, bulk formats and member pricing; dedupe inside the same weekly snapshot, but allow the same valid Costco item to reappear in later weekly snapshots for history. Filter Costco to grocery-relevant products for the shopper app: food, drinks, frozen, dairy/eggs, meat/fish, produce, pantry, household consumables, hygiene/pharmacy essentials, pet food/consumables and kitchen food-storage consumables. Exclude obvious clothing, furniture, electronics, fans, appliances, tools, decor, outdoor gear and other non-consumable offers.
35c. Visible store names should be generic Quebec-facing labels (`IGA`, `Maxi`, `Metro`, `Super C`, `Familiprix`, `Costco`) even when Joliette's postal code is used as the flyer anchor.
35d. Group `bonichoix-stemilie` under the shopper-facing `BoniChoix` store in website data, filters, counts, basket and PDF output. Preserve the raw source id only where audit/history needs it.
36. Include `Maison et entretien` for household and hygiene essentials: detergent, laundry products, dish soap, cleaning products, paper towels, toilet paper, tissues/Kleenex, Q-tips/cotton swabs, shampoo, soap, toiletries, diapers and similar home basics.
37. Classify goberge, crab-flavoured pollock, pollock, surimi and crab-style grocery items under `Viandes et poissons`, not pantry.
38. Familiprix should be included through the Flipp/Wishabi weekly source when available. Firecrawl can verify the public Familiprix flyer page, but do not invent Familiprix data if item-level extraction is unavailable.
39. The website final basket includes a simple free-text `Notes` field saved with `localStorage`; include those notes in PDF export under `Notes`.
40. In the normal website dropdown, keep a small rolling comparison window of valid production weeks, currently the newest two website weeks. Select the newest production week by default. Keep older archive folders readable under `reports/weeks/`, but do not keep every old week in the normal public website selector. Keep test/manual-preview/mock weeks hidden unless `?debugWeeks=1` or localStorage `bons-speciaux:show-all-weeks=1` is set.
41. Use user-facing French with `produit`, not `item`: `Tous les produits`, `produits trouvés`, `Produit trouvé`, `Rechercher un produit`, and store counts like `137 produits`.
42. Treat the pantry fallback as `Garde-manger et autres` in user-facing UI. The internal key may remain `pantry` for compatibility, but the shopper should not see `Épicerie / garde-manger`.
42a. Treat `Garde-manger et autres` as a final fallback only after stronger category rules. Add QA checks for high-confidence pantry misses such as beefsteak/bifteck, goberge, homard, prepared fruit/vegetable trays, maïs en épi, ananas, kiwi, raisins/grapes, avocat, ail/garlic, frozen terms, detergent/Kleenex/Q-tips, pansements/allergies/Polysporin, medications and vitamins.
42b. Prepared produce still belongs in `Fruits et légumes` when the core product is produce: barquette de légumes, plateau de crudités, plateau de fruits, carrousel de fruits/légumes, maïs en épi and maïs sucré. Do not classify sauce tomate, pâte de tomate, ketchup, salsa, beurre à l'ail, maïs à éclater, maïs soufflé, fruit snacks, fruit spread, fruit tartlets, or vegetable crackers as produce.
42c. For category QA, do not scrape. Patch `classifyShopperCategory`, add representative tests, run `npm test -- tests/report-generation.test.ts`, then run `npm run qa:pantry` and `npm run qa:categories`. If website JSON is stale, regenerate only from existing raw JSON and rerun both QA commands.
42d. `npm run qa:categories` is the broad all-category scan. It reports high-confidence errors separately from ambiguous review items, writes `reports/qa/category-review-<week>.md`, and should pass before publishing a weekly generation. Fix classifier source code, not generated JSON.
42e. When `Garde-manger et autres` absorbs obvious misses, add reusable rules and tests for the whole family, not one generated product: produce examples include clémentines, pitaya, poires, dattes, romaine and prepared trays; meat/fish examples include goberge, brochettes, côtelettes, veau and surlonge; frozen examples include Eggo, frozen desserts and frozen meals; health examples include sunscreen, dental care, cosmetics, digestive/allergy products and pharmacy meal replacements; household examples include detergent, dish soap, paper goods and diapers.
43. Do not run Firecrawl for Familiprix during ordinary cleanup or weekly generation. Use Flipp/Wishabi data first; investigate with Firecrawl only if that feed fails and a human asks for it.
44. OCR recovery is automatic, not a manual review queue. If a proof image clearly contains an extra grocery offer that the structured feed missed, append a source-backed raw item before scoring so it appears in `Tous les produits` and the weekly archive. Keep recovered offers conservative, tied to the original proof image, and covered by tests. Example: a Metro flyer page can expose `pain tranché St-Méthode` as a receipt rebate even when Wishabi only returns another product from the same area.
44a. Never attach an unrelated structured tile as the proof for an OCR-recovered product. Before showing a proof photo for a recovered offer, validate that the image OCR/text or crop actually contains the recovered product keywords and price/rebate context. If the source image is a wider flyer page, prefer a source-backed crop around the OCR match; if a safe crop is not available, keep the product but show no proof image rather than showing the wrong product photo. A missing proof is safer than a wrong proof. Add regression tests for any recovered-offer family that was missed or mismatched.
44b. Future OCR improvements should follow this order: structured Flipp/Wishabi collection first, page/tile OCR second, high-confidence missing-offer recovery third, proof crop/validation fourth, then scoring, category classification, dedupe, reports and website JSON. The goal is to recover products like `pain tranché St-Méthode` without incorrectly reusing a neighboring Cheerios-style proof tile.

## Official weekly outputs

| File | Purpose |
|---|---|
| `reports/weeks/Semaine du .../00 Liste d'épicerie.md` | selected products grouped by store; tick a product here to remove it |
| `reports/weeks/Semaine du .../01 Choix d'items.md` | main checkbox picker for adding/removing products |
| `reports/weeks/Semaine du .../02 Sélection par épicerie.md` | read-only store reference |
| `reports/weeks/Semaine du .../Autres/full-report.md` | complete weekly archive |
| `reports/weeks/Semaine du .../Autres/audit.json` | machine-readable audit |
| `reports/weeks/Semaine du .../Autres/scored.json` | scored snapshot for fast queries |
| `website/data/weeks/index.json` | static website week index |
| `website/data/weeks/<week-slug>/week.json` | static website data for the week |

Shopper-facing Markdown should remain readable without CSS, but should include Obsidian frontmatter so the vault snippet can render a cleaner card-style UI.

The picker layout is part of the contract, not a cosmetic afterthought:

```md
## Sections

- [[#🥬 Fruits et légumes|🥬 Fruits et légumes]]

## 🥬 Fruits et légumes

- [ ] **Product name** — **price**
  - 📍 **Magasin:** Store name
  - ⚖️ **Échelle:** normalized unit note, when useful
  - ✅ **Pourquoi:** short reason
  - 📸 **Preuve du prix**
    <img ... />
```

## Legacy outputs

These still exist, but are no longer the human entrypoint:

- `reports/mom-list/...`
- `reports/verified/...`
- `reports/compare/...`
- `reports/raw/...`
- `reports/audit/...`
- `reports/scored/...`
- `reports/historical-item/...`

Use them for compatibility, audit or debugging only.

## Trust model

Items shown in the shopper files should be:

- food items
- practical grocery choices
- source-backed
- not mock data
- not obviously grouped flyer headlines

If no photo proof exists for a manual product, the output should say so explicitly.

## Commands

```bash
npm install
npm test
npm run weekly
npm run finalize
npm run watch-picker
npm run query -- poulet beurre fraises
npm run web
```

Forced validation run:

```bash
BONS_SPECIAUX_IGNORE_RATE_LIMIT=1 npm run weekly
```

Use that only for validation or development.

## Website validation

The local website is part of the official weekly output. It should be checked after any change to:

- `website/`
- the website JSON export in `src/generate-report.ts`
- the weekly data shape consumed by `website/app.js`

Run:

```bash
npm run web
```

Open:

```text
http://localhost:4187
```

Browser checklist:

1. Week card is visible
2. Opening the week shows top week/search/rayon controls, active rayon products, and right basket
3. Rayon clicks switch the center content without jumpy page scrolling
4. Search finds matching products across all rayons
5. Product cards show proof images or a clean no-image placeholder
6. Checking a product adds it to the final list sidebar, updates the basket count, and shows selected feedback
7. Unchecking or clearing removes it
8. PDF export writes a clean grocery PDF to `~/Desktop` and shows the saved filename in the sidebar
9. Proof photos, prices, units and store labels are readable

Use Agent Browser or Playwright when available. With Playwright, snapshot before clicking, use current element refs, and save screenshots under `output/playwright/` when a visual artifact is useful.

## Key files

```text
src/collect-current-deals.ts
src/generate-report.ts
src/query-deals.ts
src/run-weekly.ts
sources/flipp-adapter.ts
sources/csv-adapter.ts
```

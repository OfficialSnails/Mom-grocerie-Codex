# Skill: grocery-codex

**Trigger:** `/grocery`
**Workspace:** `/Users/slugz/Desktop/Mes Document/CLAUDE CODING APP/SEQUENCER VIDEO APP/Mom grocerie Codex`

## Purpose

Generate a weekly grocery report for Joliette that a real shopper can actually use.

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
8. When `tesseract` is available, use conservative proof-photo OCR to recover obvious units (`/100g`, `/lb`, `/kg`) that Flipp did not expose in structured data.
9. Say when the unit is not confirmed instead of implying a price is per item, but keep it short: `Format à vérifier sur la photo.` when a proof image exists, or `Format non confirmé.` without an image.
10. Prefer embedded proof images over weak generic flyer links when available
11. Keep the shopper-facing output simple enough for phone reading
12. Add the `bons-speciaux` Obsidian CSS class to shopper-facing notes
13. Install/update the `bons-speciaux.css` Obsidian snippet during export
13. In `01 Choix d'items.md`, render each item as `- [ ] **Item** — **Price**`
14. Keep `📍 **Magasin:**`, `⚖️ **Échelle:**`, `✅ **Pourquoi:**`, and comparisons in a quoted detail block under the item
15. Do not wrap checkbox items inside callouts or raw HTML; Obsidian shows broken Markdown markers in live preview when interactive content is nested that way
16. Put a section summary at the top, then render standard Markdown section headings and normal checkbox lists
17. Keep proof photos open inline; do not hide individual product photos in collapsed blocks
18. Keep the website frontend data-only: the website reads generated JSON and must not scrape live sources
19. After website UI/data-rendering changes, run the local website and validate it in a real browser
20. Prefer Agent Browser or Playwright for that browser validation when available; verify week loading, item selection, sidebar final list, clearing/removal, print/export, proof photos, prices, units and store labels
21. Keep the website as a 3-zone shopping workspace: week/search/rayon controls on top, one active rayon in the center, and the final basket on the right
21a. Keep the store filter in the top controls. Selecting a store clears the rayon view and shows every retained item for that grocery store across categories; clicking a rayon clears the store filter and returns to rayon mode.
21b. Cloudflare Pages deployment serves the static `website/` folder. Use `npm run cloudflare:login` once and `npm run deploy:cloudflare` to publish; never publish `.env`, `.cache/`, `node_modules/`, `output/`, or logs.
21c. GitHub weekly automation lives in `.github/workflows/weekly-cloudflare.yml`. It requires GitHub secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and optionally `FIRECRAWL_API_KEY`; it regenerates weekly data, commits generated outputs, and deploys Cloudflare Pages.
22. Do not use category navigation that scrolls the user up and down through the full page; rayon clicks should switch the active category in place
22a. Rayons should wrap into visible button rows. Do not use a horizontal scroller for category pills.
23. In local mode, `Exporter PDF` should call the Node server endpoint and save a clean PDF directly to `~/Desktop`; do not make it browser print-only. The exported PDF should stay simple: store, address, item, and price only, without the website explanation note or item reason columns.
24. Remember that direct Desktop export is a local-server capability. A hosted static site cannot silently write files to a user's Desktop.
25. Keep search available in the top controls so the shopper can find an item across all rayons without browsing every section
25a. Use the custom in-page week dropdown, not the native select, so the week menu does not float over the search field.
26. Preserve clear basket feedback through item count, selected item badge, and sidebar contents. Do not add a large header toast for every add/remove action.
27. Render website items as premium product cards: proof image first, item/price/store below, explicit `Ajouter` control
28. If an item has no image, keep a polished placeholder box instead of collapsing the card layout
29. Keep the source/method explanation as a compact closed-by-default dropdown under the top `Joliette / Liste d'épicerie` title, not inside the filter card: stores used, CAD prices, up-to-20-per-rayon limit, and no-padding rule for short sections
30. Do not pad thin rayons with weak or fake deals. A rayon can show fewer than 20 items when only that many verified, useful, non-duplicate deals survive.
31. Classify groceries by how a real shopper thinks: celery/céleri belongs in produce; breaded fish and cold cuts belong in meat/fish; pizza belongs in frozen even when the name includes tomato; bologne/bologna, pepperoni, chorizo, rosette, sauciflard, salami, mortadelle, prosciutto and viandes froides belong in meat, even when the raw source category says pantry/epicerie.
32. Deduplicate obvious same-family winners before filling categories, including bologne, sauciflard/chorizo, and extra-lean ground beef. Keep beef rosettes separate from sauciflard/chorizo.
33. Hide low-value visible reasons such as `Premier aperçu retenu` and `Bon prix si tu en as besoin`. Keep only useful reasons such as percent savings, historical savings, or concrete cross-store savings.

## Official weekly outputs

| File | Purpose |
|---|---|
| `reports/weeks/Semaine du .../00 Liste d'épicerie.md` | selected items grouped by store; tick an item here to remove it |
| `reports/weeks/Semaine du .../01 Choix d'items.md` | main checkbox picker for adding/removing items |
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

- [ ] **Item name** — **price**
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

If no photo proof exists for a manual item, the output should say so explicitly.

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
2. Opening the week shows top week/search/rayon controls, active rayon items, and right basket
3. Rayon clicks switch the center content without jumpy page scrolling
4. Search finds matching items across all rayons
5. Product cards show proof images or a clean no-image placeholder
6. Checking an item adds it to the final list sidebar, updates the basket count, and shows selected feedback
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

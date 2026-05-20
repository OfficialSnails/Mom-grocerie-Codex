<claude-mem-context>
# Memory Context

# [Mom grocerie] recent context, 2026-05-17 1:42am EDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 15 obs (11,531t read) | 321,571t work | 96% savings

### May 16, 2026
349 5:37p 🟣 Grocery Deal Skill — Architecture Spec Defined for Joliette, QC
350 5:39p ⚖️ Grocery Deal Skill — Architecture and Scope Defined
351 5:40p ⚖️ Grocery Deal Skill — Architecture & Scope Defined for Joliette, Québec
352 5:41p ⚖️ Grocery Deal Skill — Architecture and Scope Defined for Joliette QC Mom
353 5:42p ⚖️ Grocery Deal Skill — Architecture and Scope Defined for Joliette QC Mom
354 " ⚖️ Grocery Deal Skill — Architecture and Scope Defined for Joliette, QC
355 5:44p ⚖️ Grocery Deal Skill — Architecture and Requirements Defined
356 " ⚖️ Grocery Deal Skill — Full Architecture Designed for Mom in Joliette, QC
357 5:45p ⚖️ Grocery Deal Skill — Architecture &amp; Product Design Finalized
358 5:46p ⚖️ Grocery Deal Skill — Architecture and Requirements Defined
359 5:47p 🟣 grocery-deal-skill Core Pipeline Implemented — Report Generator, Collector, and Weekly Runner
360 5:48p ⚖️ Grocery Deal Skill — Architecture and Requirements Defined for Mom's Weekly Joliette Shopping
361 5:49p ⚖️ Grocery Deal Skill — Architecture and Scope Defined for Mom's Weekly Joliette Report
362 5:52p ⚖️ Grocery Deal Skill — Architecture & Scope Defined for Joliette, QC
363 5:53p ⚖️ Grocery Deal Skill — Architecture Decided: TypeScript CLI + Firecrawl

Access 322k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>

## Codex workspace note

- This fork is the trusted Codex workspace.
- Prefer `Mom grocerie Codex` over the legacy `Mom grocerie` folder.
- Do not overwrite a live report with CSV-only or mock-only data.
- Treat embedded flyer proof images as the preferred proof source for weekly specials.
- The human entrypoint is `reports/weeks/Semaine du .../00 Liste d'épicerie.md`.
- The main Obsidian checkbox entrypoint is `reports/weeks/Semaine du .../01 Choix d'items.md`.
- `reports/weeks/Semaine du .../00 Liste d'épicerie.md` shows selected items with empty remove checkboxes; checking one there must remove it from the picker and rebuild the final list.
- The store summary is `reports/weeks/Semaine du .../02 Sélection par épicerie.md` and must stay read-only.
- Technical files belong in `reports/weeks/Semaine du .../Autres/`.
- Shopper-facing prices must show the sale unit when known and must call out unknown units explicitly.
- Shopper-facing Markdown must include the `bons-speciaux` Obsidian CSS class and stay readable without custom CSS.
- `01 Choix d'items.md` item rows must show the price on the checkbox line: `- [ ] **Item** — **Price**`.
- Picker item details must stay under the item with `📍 **Magasin:**`, `⚖️ **Échelle:**`, `✅ **Pourquoi:**`, and comparisons.
- Do not wrap picker checkbox content inside Obsidian callouts or raw HTML details; use a section summary plus normal Markdown headings because nested interactive content renders poorly in Obsidian live preview.
- Product proof photos must stay open inline under each item.
- Weekly export should install/update `.obsidian/snippets/bons-speciaux.css` in the Dropbox Obsidian vault.
- Weekly packs must be exported to `/Users/slugz/Library/CloudStorage/Dropbox/OTHERS/OBSIDIAN MD/Bons speciaux/Semaine du .../`.
- Weekly runs must also update the static website JSON under `website/data/weeks/`; the website must read generated JSON and must not scrape live data.
- Cloudflare Pages deployment is configured as a static site serving `website/` through `wrangler.jsonc`. The current project is Direct Upload, not Cloudflare Git Provider, so keep the production URL `https://bons-speciaux-joliette.pages.dev/` updated either with `npm run deploy:cloudflare` locally or through the GitHub Actions Wrangler deployment. Do not publish `.env`, `.cache/`, `node_modules/`, `output/`, or logs.
- GitHub automation lives in `.github/workflows/weekly-cloudflare.yml`. Once this folder is published to a GitHub repo, add repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and optionally `FIRECRAWL_API_KEY`; the workflow deploys to Cloudflare Pages on every push to `main`, and on weekly/manual runs it can regenerate weekly data, commit `data/`, `reports/`, and `website/data/`, then deploy.
- Run the local website with `npm run web` and open `http://localhost:4187`.
- `DESIGN.md` is the website visual contract. Reuse its linen/evergreen palette, Playfair Display headings, Inter body text, and card/button/total-block tokens for UI polish; do not treat it as permission to redesign or change the data, picker, or PDF workflow.
- The website should stay a 3-zone shopping workspace: week/search/rayon controls on top, one active rayon in the center, and the final basket on the right. Rayon clicks should switch the center content in place, not scroll the user through a long page.
- The top controls include a compact full-width checkbox-style store filter. `Épiceries régulières` selects non-Costco stores; `Tout inclure` also selects Costco; `Tout décocher` clears all stores and should show the empty state `Choisis au moins une épicerie pour voir les produits.` without silently reselecting stores. Costco is available but unchecked by default because its formats/member pricing are not for every run. Selected stores scope counts and results; clicking a rayon must keep selected stores and show only those stores' products for that rayon. Search can override the active rayon, but still respects selected stores. The first rayon is `Tous`, a virtual frontend-only option that shows every product for the selected mode/store set; do not write `Tous` into generated product category data.
- Rayons should wrap into visible button rows, not a horizontal scroll rail. Use enough card width and normal word wrapping so category names do not split inside words. Rayon badges show available product totals only, scoped by mode/store; selected/total ratios do not belong on rayon cards because the basket already shows selected counts. Keep the week chooser as a custom in-page dropdown so it does not cover the search field like a native select menu.
- Keep the top search because it is the fastest path for a shopper looking for one item across all rayons. Keep visible basket feedback in the count/sidebar, but avoid large add/remove toast messages in the header.
- Do not bring back the bottom overlay basket on desktop/tablet; it covers the product cards and makes the shopping area too cramped.
- Website item cards should stay product-style and image-first: proof image or polished placeholder at the top, item/price/store below, explicit `Ajouter` control, and clean basket sidebar.
- Keep the website source/method explanation as a compact closed-by-default dropdown under the top `Québec / Liste d'épicerie` title, not inside the filter card, so the filters stay compact while the shopper can still see that the list is built from current weekly flyer data anchored in Québec, all prices are CAD, Costco may have bulk/member pricing and longer flyer periods, and short sections are not padded with fake deals.
- Costco is collected through the same Flipp/Wishabi source as `costco-quebec` / `Costco` when flyer/item dates overlap the generated week. Do not add a separate Costco scraper unless the source fails and a human asks. Deduplicate Costco variants inside one week, but allow the same still-valid monthly Costco offer to reappear in later weekly snapshots. Filter Costco to grocery-relevant products in the shopper app: food, drinks, frozen, dairy/eggs, meat/fish, produce, pantry, household consumables, hygiene/pharmacy essentials, pet food/consumables and kitchen food-storage consumables. Exclude obvious clothing, furniture, electronics, fans, appliances, tools, decor, outdoor gear and other non-consumable offers. Group `bonichoix-stemilie` into the visible `BoniChoix` store for website filters, counts, basket and PDF output while preserving raw ids for audit if needed.
- Category overrides are part of the process: celery/céleri, prepared fruit/vegetable trays, crudités, maïs en épi and maïs sucré go in produce; breaded fish, goberge, homard and cold cuts go in meat/fish; pizza and ice cream go in frozen when clearly frozen; bologne/bologna, pepperoni, chorizo, rosette, sauciflard, salami, mortadelle, prosciutto and viandes froides go in meat even if the source category says pantry/epicerie. Keep `Garde-manger et autres` as the visible pantry fallback after stronger rules, and run `npm run qa:pantry` plus `npm run qa:categories` after classifier changes. Deduplicate obvious same-family winners such as bologne, sauciflard/chorizo, and extra-lean ground beef; keep beef rosettes separate from sauciflard/chorizo.
- `npm run qa:categories` scans all generated categories, writes `reports/qa/category-review-<week>.md`, fails only on high-confidence errors, and logs ambiguous cases for human review. For category QA, do not scrape or patch generated JSON by hand; update `src/generate-report.ts`, add representative tests, regenerate only from existing raw JSON if website data is stale, then rerun QA. Agent Browser visual QA is useful after the JSON scan to spot-check the visible site.
- For UI-only changes, prefer the fast path: focused unit tests, `node --check website/app.js`, and one short browser smoke for the changed behavior. Do not run full weekly generation, `qa:pantry`, `qa:categories`, Firecrawl, or long browser scans unless the change touches generation, classifier, source data or category QA.
- Visible item details should stay useful and compact: hide filler reasons like `Premier aperçu retenu` and `Bon prix si tu en as besoin`; keep concrete savings, percent differences, and cross-store comparisons. Use conservative proof-photo OCR when available to recover obvious `/100g`, `/lb`, or `/kg` units missing from Flipp metadata. For unknown units, use `Format à vérifier sur la photo.` when a proof image exists, or `Format non confirmé.` without an image.
- In local mode, `Exporter PDF` should call the Node server and save a clean grocery PDF directly to `~/Desktop`. Do not reduce it back to browser print-only. The PDF should be simple for printing/sharing: store, address, item, price, notes, a safe `Total estimé` near the top, store-level subtotals, and `Total estimé de la liste` at the end, without the website method note or reason columns. On the hosted static Cloudflare version, use the browser-side PDF download flow so Windows/Mac users get a real `.pdf` file without needing the local Node server.
- The final basket and exported PDF must show a conservative `Total estimé`: fixed/package prices count toward the subtotal, while `/kg`, `/lb`, `/100g`, `/L` and unclear prices are excluded and called out as products to verify. Weekly generation must preserve `currentPrice`, `price`, and `unit` fields in `website/data/weeks/<week>/week.json`; the estimate is calculated at selection/export time, not during scraping. The PDF caveat must mention taxes, deposits, real quantities, and weight-based prices.
- After any website UI or website-data rendering change, validate `http://localhost:4187` in a real browser. Prefer Agent Browser or Playwright when available, and check week loading, rayon switching, store filtering, search, item selection, basket count/sidebar final list updates, removal/clear behavior, Desktop PDF export, proof photos, prices, units and store labels.
- Legacy report folders under `reports/` remain for audit/debugging, not as the main user-facing output.

# Historical price browser — October 3, 2026

## Update — history filter banner

- Removed region text from the archive coverage banner. Original retained count
  and dates remain on the left; live filtered results/relevés are on the right.
- Prix qui varient opens selected each time and sits with Épicerie, Période and
  Trier. Users can still toggle it off while browsing. Removed the separate
  results toolbar. Controls wrap to two columns below 900 px and one below 480 px.
- Changed only `website/price-history.js`, history rules in `website/list-dialog.css`,
  this report and `.agent/CONTINUITY.md`. Parent photo/header work preserved.
- Seven focused history tests and JS syntax pass. Live localhost initially
  confirmed 2,952 results / 10,379 observations, no region copy, aligned controls,
  dynamic search counts, empty state and selected default after reopening.
- A concurrent duplicate `location` declaration in `website/store-directory.js:33`
  subsequently blocked fresh whole-app loads. This unrelated file was not edited.
  Final responsive checks ran the actual history module/data in an isolated
  local HTML harness: desktop, 700 px and 320 px pass without overflow/clipping.
  Browser viewport reset and owned QA server/tab closed after checks.
- Screenshots: `output/ui-history-filter-banner-desktop.png` and
  `output/ui-history-filter-banner-320.png`. The desktop image is the isolated
  component preview, not evidence that the unrelated app startup error is fixed.
- No price/data/PDF changes, user basket edits, deployment or remote writes.

## Update — 17:55 EDT: simpler price summary and flyer-only view

This supersedes the source selector and four-price summary described below.

- Removed the source selector and excluded old CSV imports from public results.
  Coverage now correctly shows **32,048 observations / 20,085 series**, April 23
  through October 1, 2026. Stored CSV records and generated JSON are unchanged.
- Replaced Dernier relevé / Plus bas / Plus haut / Médiane with one dated price,
  e.g. **Prix du 1 octobre 2026 — 17,00 $**. Multiple prices on the latest date
  still appear as a range; an older observation is not labelled as today's price.
- Files edited: `website/price-history.js`, `website/price-history-data.js`,
  history-specific rules in `website/list-dialog.css`, `tests/price-history.test.ts`,
  this report and `.agent/CONTINUITY.md`. Header work in the parent chat is preserved.
- Seven focused tests, JS syntax and scoped diff checks pass. Browser on
  localhost:4187 verifies coverage, removed controls/statistics, search/empty
  state and chart navigation. Desktop and 320 px layouts have no modal overflow;
  console is clear. Temporary viewport reset. No basket selection or PDF change.
- Evidence: `output/ui-history-simple-price-desktop.png`,
  `output/ui-history-simple-price-narrow.png`, `output/ui-history-simple-price-320.png`.
- No scraping, source-price edits, remote writes or deployment. Archive prices
  retain their actual observation date; this is not a live store-price lookup.

## Delivered

The header's **Historique des prix** opens the full archive. Search works across every archived reference, independent of the current weekly shopping selection. Store, date-period and source filters, sorting, and **Prix qui varient** replace the restricted product dropdown. Paginated results keep every match reachable; there is no first-100-results limit. Product names use consistent sentence casing.

Charts preserve actual dated prices, including unchanged prices and multiple different prices recorded on one date. Clicking a point displays its full date, exact price and difference from the preceding record. Enter/Space, arrow keys and previous/next buttons provide keyboard and phone access. The table retains every observation. A flat series says that its recorded prices are identical.

## Archive audit

- `data/historical_prices.csv`: 32,653 source rows.
- `website/data/price-history.json`: **32,245 distinct observations**, **20,177 product/store/unit/format/source series**.
- Full available range: **November 7, 2025–October 1, 2026**.
- **32,048 flyer observations**, starting April 23, 2026; **197 older CSV observations**, starting November 7, 2025.
- Duplicate observations are removed; different stores, units, formats and sources remain separate. The CSV imports are labelled and explicitly lack attached circular verification.
- The screenshot's Maxi Bibigo 187 g example really contains four dated prices, all $3.50. This is four observations of that specific reference, not the full archive. Other matching dumpling references are also searchable.
- No dates, historical prices or missing weekly observations were invented. Missing formats remain visible and are not treated as proof of equal-quantity savings.

## Files

`website/price-history.js`, `website/price-history-data.js`, `website/price-history-chart.js`, history-specific rules in `website/list-dialog.css`, the header button in `website/index.html`, the catalogue portion of `src/offer-evidence.ts`, regenerated `website/data/price-history.json`, and `tests/price-history.test.ts`.

The existing builder already calls the shared catalogue function, so future regeneration retains both source types. Concurrent custom dropdown integration and the comparison modal's `priceContext` entrypoint were preserved. No weekly collection, scraping, price scoring, basket/PDF calculations, saved-list state, deployment, push or merge was performed by this history task.

## Validation

- `npm test`: **216/216 pass** (`output/history-tests-final.txt`).
- Focused history/evidence tests: **13/13 pass**.
- JavaScript syntax checks and scoped `git diff --check`: pass.
- Typecheck: **23 pre-existing errors** in CSV adapter, history updater and report-generation tests; no history-browser errors (`output/history-typecheck.txt`).
- Real browser on isolated static preview and `http://localhost:4187`: full archive loading, search, source/store/period filters, pagination, empty results, unchanged series, chart clicks, keyboard point navigation, close/focus restoration.
- 320 px and 390 px: no document/dialog horizontal overflow; point selection works. Source/period dropdowns follow the concurrently installed shared control implementation.
- Example: Maxi strawberries 1 L — August 13, 2026 is $2.88, down $2.11 from August 6. ArrowRight selects August 20 at $4.99, up $2.11.
- Screenshots: `output/ui-history-archive-final.png`, `output/ui-history-chart-final.png`, `output/ui-history-chart-320.png`, `output/ui-history-chart-390.png`.

## Remaining limits

The stored archive covers Joliette and nearby stores. It is not eight months of continuous, format-verified observations for every product or a historical Montréal/Québec database. Older CSV source provenance is retained but not retroactively verified. Existing unknown formats and missing collection dates cannot establish equal-quantity savings. These gaps stay visible rather than being filled with estimates.

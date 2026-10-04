# Store directory refresh — October 3, 2026

## Result

Store names, street addresses and coordinates now refresh from public retailer sources during the existing weekly publication. The manual address-facts override file is removed. Shopper GPS/town changes reload the published directory without browser caching and recalculate nearest branches. The shopping UI still reads generated data; it does not scrape retailer sites during use.

Directory: 2,326 towns, 1,416 geolocated branches, 1,239 with street addresses (previously 693), plus two retained legacy branches. Missing streets use a nearby GeoNames locality labelled “Près de …”; that locality is never presented as a verified street or PDF address. All six IGA results around Sainte-Émélie-de-l’Énergie now have street addresses. The outdated IGA point in Sainte-Mélanie is replaced by the official Tradition listing at 851, route Principale.

## Fetching and data integrity

- IGA: official French store sitemap and individual public store schemas/map coordinates, https://www.iga.ca/sitemap/stores_fr/sitemap.xml .
- Tradition / BoniChoix: public locator records, https://www.marchestradition.com/fr/store-locator/ and https://www.bonichoix.com/fr/store-locator/ .
- Familiprix: pharmacy sitemap and public Pharmacy schemas, https://www.familiprix.com/pharmacies_sitemap.xml .
- Metro: public locator, https://www.metro.ca/trouver-une-epicerie .
- Base coverage and localities: OpenStreetMap Overpass and https://download.geonames.org/export/dump/CA.zip .

The fetcher uses four concurrent public store-page requests, bounded timeouts/retries, minimum coverage checks, and source timestamps. Failed sources retain their last good data and record a visible operational warning/status. Complete official snapshots retire stale banner listings; partial snapshots retain unmatched map coverage. Existing branch IDs are preserved where a source match is unambiguous. Separate official addresses are not merged merely because they are within 250 m; equivalent street abbreviations are deduplicated. Validated JSON files are replaced by atomic rename.

This run fetched 90 Tradition, 40 usable BoniChoix, 291 IGA and 445 usable Familiprix records before deduplication. One BoniChoix and one Familiprix record had unusable coordinates and were excluded. GeoNames and Metro refreshed. Overpass returned HTTP 504: its previous successful October 3 snapshot was retained. Super C/Maxi and other chains without a dedicated successful collector still use retained sourced observations and OSM coverage. 177 branch streets remain unavailable; no invented addresses were inserted.

## UI

The branch modal keeps a fixed viewport-bounded size with only results scrolling. Rows use readable compact address links and at least 44 px selection buttons. Missing addresses show locality context; Maps searches include the store name and are anchored to branch coordinates when a full address is unavailable. Verified full addresses remain in Maps/PDF data, while postal codes stay out of compact screen labels.

## Validation

- Isolated staged release: `npm run check` passed TypeScript, release preflight (604 files, 260 JSON files, 19 browser scripts), and all 257 tests. `output/directory-release-check.txt`.
- Workspace release preflight passed: no conflict markers or invalid JSON/JavaScript. Scoped staged diff check passed.
- Browser localhost:4187 loads the current week and 1,479 products; existing user selections preserved.
- Isolated browser preview: Sainte-Émélie lookup, six addressed IGA branches, increasing distances, Rawdon search/selection, reload persistence, nearest reset, empty search state, focus restoration, named Maps URLs and unchanged basket estimate verified.
- Responsive picker at 320/390/700/1100 px: no horizontal overflow; height remains 680 px in the 760 px test viewport across full/single/empty results. Screenshot: `output/directory-picker-320.png`.
- Fresh GPS success/error behavior is covered by existing location tests. Physical device GPS acquisition was not revalidated in this run; no claim about actual device sensor accuracy.

## Working files and exclusions

New source modules: `src/fetch-store-directory.ts`, `src/store-directory-sources.ts`, `src/store-directory-enrichment.ts`; importer and weekly hook: `src/refresh-store-directory.ts`, `src/run-weekly.ts`. Generated data/cache/status: `website/data/store-locations.json`, `data/store-locator-records.json`, `data/store-directory-status.json`. UI: `website/app.js`, `location-data.js`, `store-directory.js`, `store-picker.js`, `shopping-workspace.css`. Regression tests: `tests/store-directory-{sources,enrichment}.test.ts`.

Prices, historical observations, product classification, basket calculations and PDF/account changes were not included. Other chats' unstaged edits were preserved. `.agent/CONTINUITY.md` records the location release separately.

## Release

Source commit `4367feee30f81bdafae06463b18cc4e78109de97` pushed to main. GitHub Actions run [37168569567](https://github.com/OfficialSnails/Mom-grocerie-Codex/actions/runs/37168569567) completed successfully; Cloudflare deployment [19e0cc9e](https://19e0cc9e.bons-speciaux-joliette.pages.dev) is live.

At 2026-10-04T01:38:38Z, all six deployed assets/data files matched the release commit by SHA-256: app, directory/picker, location utilities, shopping CSS and generated directory. Public browser readback loaded the current week and 1,479 products. The IGA link was also clicked in the browser and Google Maps resolved “IGA Les Marchés Rainville inc.” at 3100 Rue Henri-L.-Chevrette, Saint-Félix-de-Valois. Evidence: `output/directory-live-verification.json`, `output/directory-ci-watch.txt`.

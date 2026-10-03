# Location and design review — October 3, 2026

## Delivered locally

- Basket empty-state heading now uses the same Inter type family as the list heading. Removed the redundant empty-list count caption. The location caption spans the intro grid so the page title stays aligned.
- Region selector includes “Autre ville ou ma position…”. The location dialog supports city/alias search, accents/case, Saint/St abbreviations, one-character spelling mistakes when there is no direct result, and explicit browser geolocation.
- The source directory includes 2,326 Québec towns and 1,153 geolocated branches, 691 with street addresses. Two existing verified branch entries are retained separately. No invented locations or addresses.
- Nearby branches are ranked by straight-line distance within 50 km. Region selections use the city center; a chosen town or browser position refines the origin. Manual branch selection persists and can be reset to the closest listed branch.
- Basket and comparison addresses open Google Maps. A branch with missing street information keeps its actual map point rather than silently selecting a farther branch. If there is no listed branch, the basket offers a Maps search.
- The same address lookup feeds browser and local PDF output. Changing a branch does not change flyer prices.
- Savings details start collapsed, including a single saving item. This supersedes the earlier single-item automatic expansion.
- Optional precise address geocoding is implemented behind the local Node server. A blank `GEOAPIFY_API_KEY` slot was added to the ignored `.env`; no credentials were invented or exposed.

## Scope and limits

The existing generated flyer regions remain Joliette, Montréal and Québec. Choosing another town or GPS position selects the closest available flyer region and names it explicitly. This does not establish price availability at each individual branch. Branch coverage is a dated directory snapshot, not a promise that every branch is listed or operating; distances are not driving routes.

City search, known branch addresses/postal prefixes and GPS do not require an API key. Arbitrary street/postal geocoding requires the optional Geoapify key and local server. Static Cloudflare hosting has no such backend; no hosted geocoding endpoint or deployment was created. The real GPS request timed out in this browser; the visible timeout and city-search recovery were verified, but successful device positioning remains UNCONFIRMED. Provider responses were tested with controlled test fixtures, not a live Geoapify account.

No changes to flyer collection, prices, savings arithmetic, historical records, classifications or weekly generation were made by this side task. No deployment, push, merge or remote write. Other concurrent workspace changes were preserved.

## Files in this task

- New: `website/location-data.js`, `website/location-picker.js`, `website/location.css`, `src/location-api.ts`, `src/refresh-store-directory.ts`, `data/store-address-facts.json`, `tests/location-data.test.ts`.
- Focused integration: `website/app.js`, `website/index.html`, `website/store-directory.js`, `website/store-picker.js`, `website/price-comparison.js`, `website/list-dialog.js`, `website/shopping-workspace.css`, `src/serve-website.ts`, `tests/store-directory.test.ts`.
- Generated directory: `website/data/store-locations.json`.
- Documentation: this review and `.agent/CONTINUITY.md`. Optional environment slot: ignored `.env`.

## Sources and reproducibility

Source snapshot obtained October 3, 2026 through read-only requests:

- [OpenStreetMap / Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API), [attribution and license](https://www.openstreetmap.org/copyright). Default endpoints were unavailable; the documented VK mirror returned a complete response. The response's OSM timestamp is retained in the generated JSON.
- [GeoNames Canada dump](https://download.geonames.org/export/dump/CA.zip), filtered to populated Québec places. The generated directory includes individual GeoNames source links and CC BY 4.0 license.
- [Metro public store locator](https://www.metro.ca/trouver-une-epicerie), saved HTML with store coordinates and street addresses. Official Metro entries supersede nearby duplicate OSM Metro points.
- Four source-backed address enrichments are recorded individually in `data/store-address-facts.json`, with source URLs. These are location facts, not product or pricing overrides.
- [Browser geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [Geoapify forward geocoding](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/).

Saved local input receipts (ignored `output/`): `location-quebec-branches.json`, `location-canada.zip`, `location-metro-locator.html`. The Overpass query is:

```text
[out:json][timeout:60];
area["ISO3166-2"="CA-QC"]["admin_level"="4"]->.qc;
(nwr(area.qc)["shop"="supermarket"];
 nwr(area.qc)["brand"="Costco"];
 nwr(area.qc)["brand"="Familiprix"];
 nwr(area.qc)["amenity"="pharmacy"]["name"~"Familiprix",i];);
out center tags;
```

Save a fresh complete response from a documented public Overpass endpoint, the GeoNames ZIP and Metro locator HTML, then run the existing offline importer:

```sh
npx tsx src/refresh-store-directory.ts output/location-quebec-branches.json output/location-canada.zip output/location-metro-locator.html
```

It rejects source error responses, missing city centers and obviously incomplete snapshots before writing. It does not perform network requests or run automatically while shopping.

## Validation receipts

- `npm test`: 228 tests across 17 files passed (`output/location-full-tests.txt`). After the final spelling-match change, the 14 location/directory tests passed again (`output/location-tests-final.txt`).
- JavaScript syntax checks passed for app, location data/picker, store directory/picker, list dialog and comparison. Scoped tracked-file `git diff --check` passed.
- `tsc --noEmit`: the same 23 existing errors remain in unrelated CSV/history/report/test code (`output/location-typecheck-final.txt`); no errors reported in the location integration. No formatting, lint or build scripts are configured.
- Browser isolated origin 4196: Montréal/Québec week switching; mixed-case Montréal search; `st-jerome` and `Juliette`; missing result; GPS timeout recovery; street search without accents; branch selection and reload persistence; Maps coordinates/address; collapsed savings details; empty-list Inter font.
- Browser localhost:4187: 83 Joliette cards load, console clear, caption/title left edges aligned, user selection not changed by testing. Location dialog fits 320 CSS pixels (282 px dialog, no page overflow); desktop and mobile screenshots inspected. Temporary viewport override reset.
- Local PDF exported through the normal confirmation flow: Québec Maxi, 955 boulevard René-Lévesque Ouest, Québec G1S 1T7, correct 0.99 total. Parsed receipt: `output/location-export-quebec.pdf` and `.txt`. The test-created Desktop file was removed after copying the receipt; pre-existing Desktop files were untouched.
- Screenshots: `output/ui-location-desktop.png`, `output/ui-location-mobile.png`.

## Follow-up boundary

Optional hosted arbitrary-address search requires a deliberately configured server endpoint and provider key; city/GPS and saved branch lookup already work without it. Periodic directory refresh and fuller street-address coverage can be added independently of weekly price generation. No automatic schedule was created.

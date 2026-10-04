# Store banner and Maps release — October 3, 2026

2026-10-03T20:42:22-04:00 [USER] Compact grocery-store banners, address beside the store,
short distance and usable Modifier control; Maps should open a named place.

2026-10-03T20:42:22-04:00 [CODE] Basket banner uses two columns: name/distance and address/Modifier.
Postal codes and C.P. mailing-box text are removed only from the screen label.
Full stored addresses and PDF address lookup remain intact. Shared Maps helper
uses store name plus known street/city across basket, picker and comparison views.
Without a known street/city, it opens a named search centered on the branch;
a unique listing for every incomplete directory entry is not guaranteed.

Added the missing address for Super C St-Charles-Borromée through the existing
facts/importer, preserving its coordinates. Source: [Super C official locator](https://www.superc.ca/en/find-a-grocery)
(320 de la Visitation, St-Charles-Borromée J6E 4N7), corroborated by the Maps
listing at 46.0455652, -73.4525555, adjacent to the stored branch.
Maps URL convention: [Google documentation](https://developers.google.com/maps/documentation/urls/get-started), checked 2026-10-03.

Files: `website/app.js`, `website/shopping-workspace.css`,
`website/location-data.js`, `website/store-directory.js`,
`tests/location-data.test.ts`, `data/store-address-facts.json`,
`website/data/store-locations.json`, `DESIGN.md`, `.agent/CONTINUITY.md`, this report.

2026-10-03T20:42:22-04:00 [TOOL] Validation: isolated release snapshot passes TypeScript and 240 tests.
Root preflight passes (701 files, 259 JSON documents, 21 browser scripts),
plus staged app syntax. Real browser: named Maps listings verified for
Maxi Montreal Mt-Royal Ouest (50 Mont-Royal Ave W), Metro Plus Boucher
St-Félix-de-Valois (341 Chemin de Joliette), Super C (320 de la Visitation).
At 320/390/700/1100 px the banner has no overflow and Modifier stays 44 px tall.
Measured banner heights 73–89 px; branch switching updates address/distance.
Evidence: `output/store-banner-widths.json`, `output/store-banner-check.txt`.

No new dependencies, pricing changes, geolocation changes or PDF changes in this
release. Concurrent PDF/history/account edits are preserved and excluded by
staging only this task's app hunks and files. Production deployment verified below.

2026-10-03T20:45:04-04:00 [TOOL] Released `3a6970a` via successful [GitHub run](https://github.com/OfficialSnails/Mom-grocerie-Codex/actions/runs/37165771135),
including 240 tests and Pages deployment. Deployment: https://e07a697d.bons-speciaux-joliette.pages.dev/;
production: https://bons-speciaux-joliette.pages.dev/. Five changed public assets/data
match committed SHA-256 hashes. Live browser confirms 73–89 px banners, no
overflow, compact street/city text, preserved basket and named address links.
Evidence: `output/store-banner-live-readback.json`, `output/store-banner-github-log.txt`.
Continuity ledger updated. Concurrent unrelated edits remain local and untouched.

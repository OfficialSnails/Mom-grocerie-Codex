# Locations and store branches

Use for GPS, location search, missing branches/addresses, distances, branch selection and Google Maps links. Use [release](release.md) only if publishing or provider changes are requested.

## Owners

- `website/location-data.js`: coordinates, distances, device location, search helpers and Maps links.
- `website/location-picker.js`, `store-picker.js`, `store-directory.js`, `location.css`, `app.js`: origin/branch UI, persistence and rendering.
- `src/location-api.ts`, `functions/api/location/[[path]].ts`: bounded server-side geocoding/reverse lookup; optional provider credentials stay server-side.
- `src/fetch-store-directory.ts`: source collection; `store-directory-sources.ts`: parsing; `store-directory-enrichment.ts`: identity/merge; `refresh-store-directory.ts`: validated directory output.
- `data/store-locator-records.json`, `data/store-directory-status.json`, `website/data/store-locations.json`: source records, refresh status and public snapshot.

## Diagnose the actual link

Distinguish **origin** (GPS, searched address or city centre), **flyer region**, **selected branch**, and **directory freshness**. GPS does not establish live inventory or branch-specific flyer prices.

Trace origin → fresh reading → region → directory → nearest/explicit branch → displayed distance/address → named Maps destination. A stale manual override, stale directory, denied GPS and incorrect flyer region require different fixes.

- Inspect the current location helper. Its fresh-reading settings use `maximumAge: 0`, high accuracy and a bounded timeout. Keep loading, denial, timeout and unavailable states usable; do not add an indefinite watcher or treat a city centre as the user's GPS position.
- Preserve explicit branch choices across renders/reloads. An explicit “nearest branch” reset may replace that choice. Verify region changes do not leak another region's override.
- Use the compact `À X km` copy; the user removed “à vol d’oiseau.” The underlying distance is geometric, so do not describe it as driving distance/time without a routing source.
- Keep store banners compact: name, readable street/locality, distance and Modifier/Choisir. Omit postal-code clutter in compact display while preserving available full addresses for export/accessibility.
- Missing street data remains unknown. Use a source-backed locality or a clear fallback, never invented street numbers or raw coordinates as a human address.
- Maps links should search the named store and verified address/locality. Use a place ID only when sourced and verified; a coordinates-only pin is not a verified named business.

## Refresh only when in scope

`npx tsx src/fetch-store-directory.ts` fetches public sources and writes local directory artifacts. Use it for an authorized directory refresh/source repair, not a styling-only task. Inspect current options and status handling before running.

Read per-source status: retained last-good cache is not fresh success. A partial provider failure must not wipe previously verified branches. Preserve stable IDs, provenance and fetched timestamps; reject invalid coordinates and keep distinct real addresses distinct. Fix parsers/enrichment rather than appending one-off production addresses by hand. Keep required attribution available in the compact Sources disclosure.

## Validate

Run affected location-data, location-api, store-directory, source-parser and enrichment tests. In the browser check origin changes, nearest ordering, manual selection/reset, reload, missing-address copy, named Maps links, mobile dialog scrolling and keyboard focus. Follow links only far enough to inspect the intended destination.

Label simulated coordinates as simulation. Do not claim physical-device GPS or permission handling was verified from mocked browser coordinates. Request actual device location only when the user's task covers it; never publish the user's precise coordinates in receipts.

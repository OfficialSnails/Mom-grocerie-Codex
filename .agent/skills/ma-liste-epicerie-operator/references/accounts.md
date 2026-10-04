# Accounts, saved lists and retailer handoff

Use for sign-in/production readiness, profiles, cloud persistence, import/archive and retailer handoff. This app uses **Clerk + Neon**, with Pages Functions and a local Node route; do not migrate it to an unrelated auth/database stack.

## Owners

- `src/account-api.ts`: configuration readiness, verified bearer identity, origin/body limits and routes.
- `src/account-data.ts`, `account-store.ts`, `setup-account-database.ts`: validation, owner-scoped persistence and schema setup.
- `functions/api/account/[[path]].ts`, `src/serve-website.ts`: hosted/local entrypoints.
- `website/account-client.js`, `account-page.js`, `account.html`, `account.css`, `saved-lists.js`, `list-dialog.js`: account and list experience.
- `website/shopping-profile.js`: shared guest/account profile validation and device preferences.
- `website/order-handoff.js`, `order-dialog.js`: whole-list review, quantities, local drafts and provider handoff.
- `src/order-api.ts`, `functions/api/order/[[path]].ts`: public bounded Instacart list/retailer integration; separate from private account data.

## Public sign-in is a provider state

Recheck current configuration; old ledger entries about disabled development keys are dated receipts. Public activation requires an owned domain, the correct production Clerk instance/DNS, matching live keys, Neon schema and exact allowed origins. Read current official provider instructions only for the setup being changed.

Never hide the Development mode badge with CSS or remove the public development-key guard to call the service production-ready.

- Local configuration belongs in ignored `.env`; hosted Functions need the corresponding provider secrets/configuration. Editing `.env` alone does not update production.
- Relevant names include `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `ACCOUNT_ORIGINS`. Inspect presence/mode without printing values. A publishable key may intentionally reach the client config response; secret keys/database URLs must never enter static assets, logs or commits.
- Read-only diagnosis does not authorize domain purchases, DNS/credential changes, schema creation or production data writes. Reuse explicit active-task authority; do not re-ask routine actions it already covers. Resolve missing ownership/access without asking for secrets in chat.
- Respect the requested free-service constraints. Do not enable paid plans or services without authorization.

## Preserve trust and persistence

- 2026-10-04 user decision: ordering is temporarily removed from `Mon espace`. Keep preparation dialogs, retailer checkout links and pickup/delivery preferences out of the visible UI until the user asks to restore a working provider. Preserve existing drafts/profile values and the usable saved-list, PDF, copy, favorite and GPS/address flows.
- Derive owner identity from verified authentication, never a caller-supplied owner ID. Preserve bearer validation, origin allowlists, bounded payloads, no-store responses and parameterized owner-scoped queries.
- Disabled configuration should return its honest disabled state/JSON service error. Do not mask it with an HTML fallback or a successful empty account.
- Guest shopping remains usable. Reserve a stable header account slot so loading/sign-in state does not shift navigation; preserve accessible dialogs and account placement.
- Preserve saved price snapshots, notes and archives. Local import must not overwrite existing cloud lists silently. Same-browser reload is not proof of cross-device sync.
- Keep account/order copy minimal: short controls and confirmations, essential price exclusions, actionable errors and truthful provider availability. Do not reintroduce tutorial paragraphs around preferences or orders.
- Deleting the app's stored profile/lists and deleting a Clerk identity are different operations; describe exactly what is implemented and authorized.
- Whole-list transfer is configuration-dependent. Recheck `/api/order/config` and actual provider access; never fabricate successful transfers or enable a provider without real credentials. `INSTACART_API_KEY` stays server-side, using the production endpoint only. The user wants one transfer per store, not per-item search buttons.
- Instacart shopping-list links transfer names/formats/quantities together, but do not force a specific retailer branch or guarantee SKU/quantity/price matches. Flyer IDs are not retailer SKUs. Verify postal-code coverage and retain shopper review at the provider. Cache confirmed links by exact contents; do not automatically retry an ambiguous write.
- Device drafts/preferences and cloud lists are distinct. Guest profile/list access must remain available during disabled or failed authentication. Import profile/list data explicitly; never claim device drafts sync automatically.
- Provider alternatives require fresh documentation, exact Quebec store coverage and commercial access checks. The dated audit is `reports/ordering-flow-2026-10-04.md`; it is not a permanent provider capability list. Do not purchase plans, send outreach, accept terms, or place orders based on research alone.

## Validate

Use affected account API, saved-list and handoff tests plus typecheck. Cover unauthenticated access, wrong origin, cross-owner access, payload limits, unavailable service, import collisions and archive persistence when those paths change.

Check guest and configured account UI with current Browser tools. Prove cloud save/reload/import with an authorized isolated account when cloud behavior is in scope; clean up only records created for that test when authorized. Report physical-device/cross-device/provider verification separately from fixtures. See [release](release.md) for deploying both assets and Functions and verifying live readiness.

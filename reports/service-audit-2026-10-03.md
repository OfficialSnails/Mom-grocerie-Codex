# La liste d’épicerie — service concept and reference audit

2026-10-03. Read-only inspection of Bâtir à rabais. This report separates the local implementation from proposed commercial work. No account, subscription or remote service was provisioned.

## What the reference gets right

- [Bâtir à rabais app](https://batirarabais.ca/app) makes saved projects the durable object. A comparison is retained with quantities, store choices and a dated reference, rather than disappearing after a search.
- [Analytics](https://batirarabais.ca/app/analytics) connects individual comparisons to cumulative savings and time periods. Its project detail connects the saving to the competing price and lets users reconsider their purchasing strategy.
- [Pricing](https://batirarabais.ca/tarifs) differentiates free and paid use through saved projects, comparison limits and additional planning features. Price alerts were described as a future feature during this inspection; do not imply they are already available.
- [Login](https://batirarabais.ca/login?next=/app) supports an account-backed experience. No account settings, projects or payments were changed in this audit.

## Implemented locally

Compact cards, add controls on photos, consistent store presets and close controls, internal branch picker, competitor-only comparison with an optional in-site source photo. Savings filter, equivalent-quantity calculations, product/list savings details, saved weekly snapshots, repeat-save update rather than duplicate, save-and-export choices, and PDF savings.

Historical data is exposed through the full searchable archive and per-offer charts. Verified same-format observations support low/usual/high assessments. Unknown historical formats remain visible with their limitation; supplier discount percentages no longer produce unsupported recommendation popups. None of these historical changes is counted as money saved in the basket.

“Mes listes” stores snapshots on this device. It is not an authenticated account or cloud backup. Figures are estimated savings against the cited comparison price, not receipt-verified money actually saved.

## Recommended service sequence

1. **Accounts and private weekly history.** Keep browsing and PDF export available without an account. Offer sign-in when saving across devices. Store week, region, products, quantities, chosen branches, cited price references and a dated frozen snapshot. Import the existing local lists once, with duplicate protection. Support export and account/data deletion.
2. **Recurring grocery list and quantities.** Reuse a household's usual products and actual quantities next week. Weight inputs should update both estimated cost and savings. This unlocks a meaningful whole-basket comparison, especially for produce and meat.
3. **One store versus several stores.** Show the actual extra saving from an additional stop. Add travel cost/time only after verified branch locations and route data exist. Do not equate the largest displayed discount with the cheapest practical shopping trip.
4. **Price tracking people can verify.** Let users follow a specific product and format, choose a target price, and opt into notifications. Explain every alert with the date, comparable quantity and source. Expand source-format coverage before charging for precise recommendations.
5. **Paid service after reliability.** A sensible candidate is unlimited saved history, recurring household lists, household sharing and target-price alerts. Keep the useful free comparison experience. Validate demand and operational costs before choosing a price; the reference site's subscription is not evidence for this site's willingness to pay.

## Account implementation handoff

- Scope: real authentication, private list persistence, local-list migration, sign-out and deletion; payment is a later separate scope.
- Areas: static website save/history UI, server/API hosting choice, authenticated database policies and backup/export.
- Acceptance: a user signs in on two devices and sees only their own saved lists; edits do not duplicate savings; another user cannot read or alter them; failed synchronization stays visible and preserves the local copy; deletion and export work.
- Constraints: no mocked login, no invented accounts, no credentials in the client, no deployment or remote database writes without explicit authorization. Existing guest selection and both PDF paths must remain usable.
- Status: proposed. Backend provider/project and authentication configuration have not been selected or provisioned in this task.

## Remaining data and release work

Complete source-backed formats and branch coverage, arbitrary postal-code coverage, real-device iOS/Android sharing, and production release verification. Known unknowns must stay visible: a bag of five avocados cannot be compared to a 2 kg bag without its weight. Historical records with missing sizes cannot establish an equal-quantity saving.

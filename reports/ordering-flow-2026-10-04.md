# Guest lists and whole-basket ordering — 2026-10-04

## Implemented

- Guest list save/reload, optional device profile and favorite branches; `Mon espace` does not require Clerk login.
- Local save precedes optional cloud sync. Failed auth/sync opens the device copy instead of stranding it.
- Order review imports all selected products of one store, preserves original flyer prices, and saves edited names/formats/quantities locally. Copy/retailer links are secondary manual options. Per-item search buttons were removed following user feedback.
- Public local/Cloudflare order routes use server-only production Instacart credentials, bounded/validated requests, origin checks, sanitized errors, per-instance rate limiting and no automatic write retries. One provider call sends the full reviewed store list. Postal lookup checks the current returned retailer banners; it cannot select a precise branch.
- No API key present, so automatic transfer remains disabled. No provider account, paid subscription or purchase was created.
- Dialog bounds and scroll container corrected; heading/close stay visible. Account/order native selects share the existing chevron shape and 20 px right inset.

## Actual retailer test

Used Maxi's visible shopper UI while signed out, initially with an empty basket. Selected **Maxi Joliette Firestone, 909 boulevard Firestone** using the live locator. The selected location was confirmed for pickup. Added **Délices du Marché Carottes, sac de 3 lb**; PC Express cart displayed one item, quantity 1, **$1.50**. This is a manual browser proof, NOT an automatic transfer from the app. The app's October 1–7 flyer snapshot lists a combined carrots/yellow-onions offer at **$0.99**. Names/format can match without matching the current online price. The online cart displayed a $30 minimum and disabled checkout. No checkout, payment, delivery address or order submission was attempted. The user subsequently closed the retailer tab.

Local app browser test used the same real flyer offer: select → save → open guest space → save Joliette/postal preference → reload → edit order to carrots / 3 lb / quantity 2 → save draft → reload/reopen → copy. Profile, list and draft persisted. Main `localhost:4187` UI was also inspected without altering its existing four-item basket. Isolated interaction test used `localhost:4197`.

## Provider findings (reverify before integration)

| Provider | Evidence | Remaining dependency |
|---|---|---|
| Instacart | [Official application page](https://company.instacart.com/business/developers) explicitly closed to new applications with no waitlist. [Shopping-list API](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page) accepts all items and returns a shopping URL. | Cannot create developer access now; real key, live matching/coverage and provider approval remain unverified. |
| MealMe | [Older cart-search docs](https://docs.mealme.ai/reference/get_search_cart) mention US/Canada. However, the [current console docs linked from mealme.ai](https://mealmeai.vercel.app/docs) identify **Kroger** as the grocery provider and require shopper OAuth. | Maxi/IGA/Metro coverage is NOT established. Do not select based on old Canada marketing alone. [Console pricing](https://mealmeai.vercel.app/pricing) requires a card and metered calls; no account created. |
| Northfork | [Cart product](https://northfork.ai/products/recipe-shopping-foundation) supports whole-cart matching and retailer checkout. [Pricing](https://northfork.ai/pricing) is monthly integration fee plus usage, quote-based. | Stronger remaining commercial candidate, but Quebec banners/branches and cost need confirmation. No outreach submitted. |
| DoorDash | [Storefront API](https://developer.doordash.com/en-US/api/storefront/) can accept external carts for integrated stores; [Marketplace retail access](https://developer.doordash.com/en-US/docs/marketplace/retail/orders/overview/) is restricted/merchant-facing. | Not a verified public bridge into arbitrary Maxi/IGA consumer carts. |
| Uber Eats | [Grocery cart endpoint](https://developer.uber.com/docs/eats/references/api/v2/patch-eats-orders-orderid-cart) updates fulfillment issues on existing orders; written approval/scopes apply. | Not proof of third-party consumer basket creation. |
| Whisk / Samsung Food | [API introduction](https://docs.whisk.com/api-overview/introduction) says new API clients are not accepted. | No current self-service alternative. |
| PC Express / Voilà | [PC Express help](https://www.maxi.ca/en/help/shopping-with-us/what-is-pc-express) and [IGA/Voilà](https://www.iga.ca/fr/voila) describe shopper checkout. | No supported public whole-cart API established in this audit; direct retailer partnership needed to confirm access. |

## Validation and limits

- `npm run check`: TypeScript, conflict/JSON/browser syntax preflight, complete unit suite. Final count recorded in ledger.
- `wrangler@4.131.0 pages functions build functions --outdir output/order-flow/functions`: compiled successfully.
- Browser checks on guest profile/list/order at actual CSS widths 355, 433 and 1083 px: dialog inside viewport with 12 px outer margins, no page horizontal overflow, close control outside scroll body, dropdown arrow 20 px from border. No app console errors observed. Viewport override reset afterward.
- Provider success/error tests use test fixtures; they are not live Instacart proof. No live cloud-account import/cross-device test because production Clerk remains unavailable.
- Before enabling a paid provider: confirm commercial access, actual local retailer coverage, global quota protection beyond per-instance throttling, multi-item live matching and link retry/cache behavior. Automatic external ordering remains an open dependency, not a completed feature.

## Published release

- Implementation: `f08af93`; final dialog focus correction: `b7885927da445cf92fbaf1257ba05bae8b59a4ed`. [GitHub Actions](https://github.com/OfficialSnails/Mom-grocerie-Codex/actions/runs/37213210696) passed all 306 tests, TypeScript, release checks and backend compilation. [Cloudflare deployment](https://ea2f124a.bons-speciaux-joliette.pages.dev) is live on the normal production alias.
- Ten changed frontend files byte-match production; the current 14-file data bundle also matches. Order and account capability routes return 200 with integrations disabled; private account access returns 503 while production authentication is unavailable.
- Hosted guest flow: select bananas and lemons → save without login → both products in one store review, with pound/each units preserved → save draft and reload. Actual 320×740 CSS viewport has no horizontal overflow, 12 px modal margins and a 20 px chevron inset. Closing on the final deployment restores focus to its opening button. Browser error log empty. Test state uses separate deployment origins; the user's public profile/list state and main local basket were preserved.
- Main files: `website/{account-page,account-client,shopping-profile,order-dialog,order-handoff,list-dialog,app}.js`, `website/{account,index}.html`, `website/account.css`, `src/{account-data,order-api,serve-website}.ts`, `functions/api/order/[[path]].ts`, `tests/{shopping-profile,order-api}.test.ts`. Environment template, README, design contract and project operator/continuity were updated. No secret values, weekly prices, production auth configuration, paid plans or orders were changed.


## Developer application attempt — 2026-10-04T12:16:27-04:00

Status: **Not submitted**. The user authorized applying for access, retaining the free-service constraint. Followed **Apply today** from the [official getting-started guide](https://docs.instacart.com/developer_platform_api/get_started/overview/). It redirects to the [developer application page](https://company.instacart.com/business/developers), which currently states new applications are closed and there is no waitlist. The linked dashboard is for developer account access; the documentation describes invitation/onboarding, not an alternate open signup route. The general contact form is labeled for retail businesses, so no retailer application was submitted for this consumer app.

### Application brief (unsent)

- **Project:** Ma liste d’épicerie
- **Website:** https://bons-speciaux-joliette.pages.dev/
- **Market:** Québec, Canada; French-speaking shoppers
- **Request:** No-cost developer access for shopping-list creation and nearby-retailer lookup. Pricing and eligibility remain unconfirmed.

Ma liste d’épicerie lets shoppers build and save grocery lists from dated weekly flyer offers. We want to send a complete store list—including product names, formats and quantities—to an Instacart shopping-list page. Shoppers would review product matches, choose an available retailer and complete checkout on Instacart. Flyer prices remain separate from current online prices. The app has an initial server-side integration, but automatic transfers are disabled pending access and live validation.

Please confirm supported Québec retailers, including Maxi, Super C, IGA and Metro, and whether this independently sourced flyer-comparison use case is permitted under your developer program.

Contact person, application email and legal business details: **UNCONFIRMED**; obtain from the user if an actual submission route becomes available. Do not invent traffic, business registration, retailer partnerships or prior API usage.

### Activation steps once onboarding opens

1. Submit the accurate app/contact details and obtain developer access.
2. Test multi-item matching, quantities and retailer coverage with a development key in an isolated environment; production remains disabled.
3. Finish the provider's required branded CTA/demo and request review. [Approval process](https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/approval_process/) and [pre-launch checklist](https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/pre-launch_checklist/).
4. Confirm pricing and the flyer-comparison use case with Instacart. Its [terms](https://docs.instacart.com/developer_platform_api/guide/terms_and_policies/developer_terms/) contain restrictions involving multi-retailer priced displays; do not assume approval for this app or conceal its functionality.
5. After production approval, configure the key privately for local/server hosting, verify quotas and origins, deploy, and test a real whole-list transfer without purchasing. A production-key request alone is not active access.

No application, contact message, account, credential, subscription, purchase or deployment was created in this attempt. No application-code changes or tests were needed; findings checked against current official application and onboarding pages.

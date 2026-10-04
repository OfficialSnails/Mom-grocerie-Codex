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

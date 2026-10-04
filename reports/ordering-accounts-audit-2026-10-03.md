# Accounts and grocery ordering audit

Audited October 3, 2026. Scope: current repository, signed-in Clerk/Neon dashboards and primary provider documentation. No grocery order, retailer-account linking, paid upgrade or deployment authorized by this audit.

## Recommendation

Use the existing grocery Clerk application for identity and a dedicated Neon Postgres project for private profiles and list snapshots. Keep the current static shopping site and add a small authenticated API through the existing Node server / Cloudflare Pages Functions architecture. No React/Next.js rewrite is needed.

Accounts make sense for cross-device history, addresses and preferences. They are not necessary for browsing prices, making a list or downloading a PDF. Clerk does not sign users into their retailer accounts; each ordering provider needs its own supported handoff or account-linking flow.

## What is already available

- Weekly Flipp/Wishabi offers and archived prices; comparison by equivalent quantity where formats are confirmed.
- Local saved snapshots, archive/restore, dated estimated savings, branch-grouped basket, local Desktop PDF and hosted PDF download.
- Québec towns, opt-in GPS and a source-backed branch directory. The website uses three flyer-source regions, independently of the selected physical branch.
- Optional server-side address geocoding exists, but its provider key is not configured. Town/GPS selection does not require that key.
- No account backend, durable user database, retailer cart connector, retailer SKU/UPC mapping or user quantity editor was present at the start of this audit.

Evidence: `website/saved-lists.js`, `website/list-dialog.js`, `website/app.js`, `website/location-data.js`, `website/store-directory.js`, `src/location-api.ts`, `src/serve-website.ts`, `sources/source-adapter.ts`.

## Retailer and provider feasibility

| Route | Verified capability | Constraint / next evidence needed |
| --- | --- | --- |
| Maxi / PC Express | Online pickup and delivery where offered; customer checks out at Maxi | No public third-party consumer cart-import API found in the official documentation searched. Obtain partner documentation before promising automatic item transfer. |
| Super C | Online ordering and pickup; delivery partnership with Instacart, ordered through Super C | Postal-code and service checks required. An Instacart-powered delivery service does not imply a public cart API. |
| Metro Québec | Online grocery delivery and pickup, depending on location | No official public consumer cart-import API found. Do not confuse the unrelated METRO European marketplace APIs with metro.ca. |
| IGA / Voilà | IGA lists can enter IGA carts internally; Voilà serves covered Québec delivery zones | IGA's FAQ says outside recipe ingredients cannot be automatically imported. Voilà's Québec FAQ distinguishes its delivery coverage from IGA store services and says Voilà curbside pickup is unavailable there. Confirm the selected branch's own services. |
| Instacart Developer Platform | `POST /idp/v1/products/products_link` makes a shoppable list URL; customer selects retailer, reviews matches and checks out | Production approval needed. Basic handoff cannot force a specific merchant. Quantities are not guaranteed. Terms create a material eligibility issue for this comparison site; seek written approval before implementation. |
| Uber Consumer Delivery API | Account linking, merchant/menu discovery, cart operations, ordering and status | Early access, case-by-case credentials/specifications. Québec grocery coverage and a hosted checkout handoff for our use case remain unconfirmed. Merchant Marketplace APIs and courier-only Uber Direct are not equivalent. |
| SideChef / Chicory | Partner shoppable recipe / ingredient experiences | These are partnership products. No verified public self-service route covering the requested Québec chains and arbitrary grocery lists was established. |
| AnyList | Established list-to-online-shopping UX | Useful product reference, not an API we can assume our site may reuse. |

Primary sources checked:

- [Maxi PC Express](https://www.maxi.ca/en/help/shopping-with-us/what-is-pc-express)
- [Super C delivery](https://www.superc.ca/en/how-it-works/delivery)
- [Metro online-order help](https://www.metro.ca/en/help-center/online-order)
- [IGA online-shopping FAQ](https://www.iga.ca/fr/faq/epicerie_en_ligne), [IGA / Voilà](https://www.iga.ca/voila)
- [Instacart shopping-list endpoint](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/), [FAQ](https://docs.instacart.com/developer_platform_api/faq), [nearby retailers](https://docs.instacart.com/developer_platform_api/api/retailers/get_nearby_retailers/), [production approval](https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/approval_process/)
- [Uber Consumer Delivery introduction](https://developer.uber.com/docs/consumer-delivery/introduction)
- [SideChef integration documentation](https://business.sidechef.com/sb-documentation), [Chicory shoppable recipes](https://chicory.co/blog-feed/how-food-bloggers-and-recipe-publishers-can-use-shoppable-recipes), [AnyList online-shopping overview](https://help.anylist.com/articles/feature-overview-online-shopping/)

### Instacart eligibility is a real gate

The [developer terms](https://docs.instacart.com/developer_platform_api/guide/terms_and_policies/developer_terms), marked July 3, 2024 and checked October 3, 2026, restrict use with applications showing priced items from multiple retailers on one screen (§3.5(k)(iv)) and moving/comparing items across retailer baskets (§3.5(l)). They also restrict scraping. These provisions appear directly relevant to our concept. This is an implementation eligibility issue requiring clarification from Instacart, not a claim that a separate checkout page automatically resolves it. No application or agreement was submitted.

The endpoint documentation now lists product IDs and UPCs, while the FAQ retains older name-only wording. Validate the actual permissions and supported fields of an approved account. Prefer `line_item_measurements`; the endpoint marks top-level quantity/unit as deprecated. A nearby `retailer_key` identifies the chain, not a guaranteed physical branch. Customer review remains necessary.

## The proposed customer flow

1. Browse and build a grocery list as today.
2. Choose **Enregistrer ma liste**. Signed-in users save to their account; guests retain an explicit local/PDF option.
3. Open a full **Mes listes** page: left navigation for lists, archives and profile. Selected week displays dated estimates and notes.
4. Group products under the exact saved grocery branch and address. Keep the source flyer region visible separately.
5. Offer **Télécharger le PDF**, **Copier cette liste** and **Ouvrir [retailer]**. State clearly when products are not transferred automatically.
6. Later, enable **Préparer le panier** only for a working approved provider. Show matched products, package sizes, quantities, unavailable items and substitutions before leaving.
7. Customer selects the provider's fulfillment location/time and pays there. Multiple retailers remain separate orders.

## Location and product information still needed

- A manually entered postal code is enough to begin coverage lookup; full street address is useful for delivery. GPS is optional and cannot prove serviceability.
- Save name/address only when the person submits profile settings. Do not silently upload existing location history. Do not include private addresses in public cart links or URLs.
- Store retailer-chain ID, physical branch ID, provider merchant/store ID and flyer-source region separately. Never infer pickup availability from distance alone.
- Store actual requested quantity, package size/unit, brand/variant and verified UPC/provider product mapping where available. A flyer item ID is not an orderable SKU.
- Recheck availability and prices at handoff. An in-store flyer price, loyalty offer and delivery-platform price can differ. Fees/minimums/timeslots can eliminate the apparent benefit of splitting an order.
- Preserve the old list as a dated snapshot; a repeat order should use current offers and an explicit new comparison, not old savings as a current promise.

## Accounts architecture and safeguards

Clerk verifies sign-in; the server verifies every session and derives the owner ID. Neon stores only the owner's profile and snapshots; all reads/updates/deletes include that owner. Never trust a user ID supplied by the browser. Keep database and secret keys server-side, return no secret in public config, limit request sizes and render saved strings as text.

Use `(owner_id, list_id)` as the unique list key so repeat saves or local imports do not double-count a week. Keep local snapshots until a confirmed cloud save. Import is an explicit user action and must not overwrite a newer cloud copy. Support archive/restore, PDF export and deletion of account data. Account deletion also needs Clerk-user deletion / cleanup before a public release.

The existing Clerk application is **LISTE D'ÉPICERIE**, development-only. Neon was signed in on its free plan with no projects. With explicit user confirmation, dedicated **liste-epicerie** was created on the free plan with Postgres only in Ohio. Its schema is initialized, and its connection string is saved only in the ignored, mode-600 `.env`. No Canadian region was offered in that creation menu. Do not describe this as Canadian data residency.

[Clerk's vanilla JavaScript guide](https://clerk.com/docs/js-frontend/getting-started/quickstart) supports the current frontend. [Server verification](https://clerk.com/docs/reference/backend/authenticate-request) must restrict authorized origins. [Production setup](https://clerk.com/docs/guides/development/deployment/production) needs a production instance and domain/DNS setup; existing development credentials are not a finished public authentication deployment. [Neon's Cloudflare integration](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/) supports the serverless API architecture.

## Priority after the first account release

1. Quantity editor and repeat-week list: highest direct benefit for regular groceries and meaningful basket totals.
2. One store versus two stops: compare the whole basket with confirmed formats and any known fulfillment costs. Leave unknown fees visible.
3. Household shared lists with explicit access, rather than shared passwords.
4. Product/format-specific price alerts with opt-in delivery and dated evidence.
5. Receipt-confirmed spending/savings separate from estimates.
6. Paid tier only after validating cross-device reliability and demand. Saved history, recurring planning and alerts are better foundations than an unapproved automatic-cart promise.

## Launch gates

Completed locally: real Clerk sign-in, Neon schema, per-owner database isolation, explicit non-overwriting import, archive/restore and account-data deletion. Still required before public launch: domain + production Clerk instance, secrets on hosting, full Clerk identity deletion/cleanup, privacy/retention details and deployment authorization. Automatic carts have separate provider approval, catalog matching, location/service and checkout-verification gates. No retailer credentials or payment data should be stored by this site.


## Implemented local release — October 3, 2026

- **Free plans:** Clerk Hobby and Neon Free verified in their dashboards. Phone signup/sign-in and SMS MFA disabled; the two-paid-features indicator disappeared after readback. Username signup disabled to keep new accounts simple. Email/password and Google remain available. No paid upgrade, card, order or subscription was submitted.
- **Identity:** header Se connecter opens a branded French Clerk modal; Mon compte appears after login. Session survives reload. Public hosts refuse development Clerk keys. Browsing remains independent of sign-in loading.
- **Private lists:** the Mes listes page reads account-owned Neon snapshots, with region/week identity, dated estimates, stores, branches, formats, notes, archive/restore, deletion and PDF download. Guest/local copies remain usable and require explicit import. Import never replaces a cloud copy.
- **Preferences:** optional name, address, apartment, city, Québec postal code and pickup/delivery/in-store preference. Favorite branches persist to the account and are proposed within their region; explicit local choices win. Addresses are not geocoded automatically or transmitted to retailers.
- **Ordering:** per-store copy, retailer entry links for Metro/Super C/Maxi/IGA, exact saved branch/map, store subtotals and format/loyalty details. The page explicitly says products still need to be added at the retailer. No fake cart button or invented SKU mapping.
- **API:** Bearer session verification with explicit authorized origins; owner ID derived from verified Clerk token; parameterized SQL scoped to owner; 500 KB bounded streamed requests; JSON/text rendering; generic provider errors without secrets. All account credentials are excluded from git.

Files added: `src/account-api.ts`, `account-data.ts`, `account-store.ts`, `setup-account-database.ts`; `functions/api/account/[[path]].ts`; `website/account-client.js`, `account-page.js`, `account.html`, `account.css`, `order-handoff.js`, `list-pdf.js`; `tests/account-api.test.ts`.

Integration files: `website/app.js`, `index.html`, `shopping-workspace.css`, `saved-lists.js`, `list-dialog.js`; `src/serve-website.ts`; `package.json`, lockfile and `.env.example`. Existing PDF renderers are reused; concurrent price/history/location work is preserved.

Validation: TypeScript passes. 271 tests across 23 root suites pass. Cloudflare Pages Functions compiles without deployment. Real browser verifies login/reload, save/export-to-dashboard, profile persistence, favorites, archive/restore, import preservation, store-copy text and 320/390px fit. A real downloaded one-page PDF preserves 0.99 total, 1.50 savings, two stores and the variable-price exclusion. Database isolation was tested with two Clerk test-user IDs and injected authenticated identity; real browser authentication and forged-token rejection were verified separately. Receipts: `output/account-isolation-receipt.json`, `output/account-list-export.pdf`, `output/account-list-desktop.png`, `output/account-list-mobile.png`.

The dependency audit reports pre-existing transitive axios/form-data issues in the Firecrawl dependency chain. New Clerk/Neon dependencies did not account for those production findings; broad dependency upgrades were outside this change.

## Remaining ordering work

1. Obtain written eligibility/approval from a cart provider, including Instacart comparison-site restrictions or Uber Consumer Delivery early-access approval. No partner application or message has been sent.
2. Add confirmed retailer/provider product IDs or UPC matches, editable quantities, package equivalence and substitution review. A Flipp flyer ID is not an orderable SKU.
3. Use the approved provider's postal/address serviceability check and exact merchant/location IDs. Saved addresses and GPS alone do not prove pickup/delivery eligibility.
4. Revalidate provider prices, stock, fees/minimums and timeslots before checkout. Show the user's final review on the provider website. Do not report estimated flyer savings as verified purchase savings.

No account feature has been deployed publicly. The existing main site and scraping pipeline are not published or regenerated by this side task.

Final receipt: usual local preview `http://127.0.0.1:4187/` restarted and verified with a real Se connecter modal; its signup asks only for email/password or Google (no phone or username). Header fits at 320 px without overflow. Temporary 4196 server stopped, both disposable Clerk users and their Neon rows removed, password artifact deleted. Production and user baskets were not changed. Additional screenshots: `output/account-signup-modal.png`, `output/account-header-mobile.png`.

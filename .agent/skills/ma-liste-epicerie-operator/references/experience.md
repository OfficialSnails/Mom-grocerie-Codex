# Shopping experience and brand

Read `DESIGN.md` for the current contract; older weekly-skill/ledger passages do not restore superseded layouts.

## Ownership

- `website/index.html`, `app.js`, `shopping-workspace.js`: entry, controls, selection and basket.
- `website/styles.css`, `shopping-workspace.css`: tokens, responsive header, cards and basket.
- `website/dropdown.js`, `list-dialog.js`, `list-dialog.css`: overlays, focus and saved-list dialogs.
- `website/saved-lists.js`: local snapshots/archive/serialization; `account-page.js` / `account.css`: guest/account list page.
- Brand touchpoints: `website/assets/`, HTML titles/alt text/footer, `pdf-document.js`, `print-document.js`, `list-pdf.js`, share copy in `app.js`, local export naming in `src/serve-website.ts`.

## Preserve the shopper flow

Keep top week/search/store/rayon controls, active products and basket. Search crosses rayons but respects selected stores/mode. `Tous` is virtual frontend scope. Clearing stores keeps the explicit empty state. Costco remains optional/off by default.

Phones need at least two usable product columns; add a third only where readable. Keep mobile list/total access and a usable basket. Desktop basket stays beside products, with no bottom overlay covering cards. Check intermediate widths, not just smallest/largest.

Keep full navigation labels, consistent button heights/touch targets, stable account-control space while auth loads and no content jump when opening dropdowns. Dialog close controls stay visible, visually light and keyboard-accessible with visible focus. Keep saved-list geometry stable between empty/active/archive tabs.

Saved lists retain products, notes, dated prices and normalized savings. Saving the same week/region replaces or reactivates its snapshot; archive/restore must not substitute current offers. Preserve non-overwriting cloud import and guest shopping.

For a rebrand, inspect the real logo first. Preserve requested illustration/type/palette; update all brand touchpoints. Retain icon-only assets if still appropriate. Do not globally replace ordinary French “de la liste,” internal IDs or historical report filenames.

## Focused verification

1. Run/reuse the correct `npm run web` server at 4187. Restart only an identified project-owned process when necessary.
2. Run affected `saved-lists`, `product-details` or `price-history` tests and `node --check` on edited browser scripts. Do not add implementation-mirroring tests for a simple text/logo edit.
3. Use the current Browser skill at phone, intermediate and desktop sizes. Read actual CSS viewport width/zoom before reporting dimensions.
4. For control/basket changes exercise store scope, category switch, cross-category search, add/remove, count/total updates, mobile basket and empty state. Preserve existing user selections: prefer an isolated supported test context; otherwise restore only exact reversible test changes.
5. Check relevant dialog keyboard/Escape/focus/scroll behavior. For branding check image load/aspect ratio and home/account pages. Save relevant screenshots under ignored `output/` and distinguish actual app errors from expected development notices.
6. Use the PDF guide if exports changed and release guide only for authorized publication. No fresh weekly collection for UI-only work.

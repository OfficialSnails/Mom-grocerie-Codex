---
name: Bons spéciaux de la semaine — Québec
brand_identity:
  personality: "Pratique, fiable, serein, québécois."
  tone: "Utile et direct, centré sur l'économie et la clarté."
  target_audience: "Shoppers au Québec, incluant une utilisatrice de 60 ans cherchant la simplicité."

colors:
  surface: "#faf9f6"
  primary: "#2d4739"
  on_primary: "#ffffff"
  secondary: "#5c7066"
  surface_container: "#f4f3f1"
  border: "#dadad7"
  error: "#b3261e"
  success: "#2d4739"

typography:
  family_display: "Playfair Display, Georgia, serif"
  family_body: "Inter, system-ui, sans-serif"
  scales:
    headline_lg: "display, 3xl, bold"
    headline_md: "display, 2xl, bold"
    title_md: "body, lg, semibold"
    body_md: "body, base, normal, relaxed"
    label_sm: "body, xs, medium, uppercase"

spacing:
  container_padding: "16px"
  item_gap: "12px"
  section_margin: "24px"

components:
  card:
    bg: "surface_container"
    radius: "12px"
    border: "1px solid border"
    padding: "12px"
  button_primary:
    bg: "primary"
    text: "on_primary"
    radius: "8px"
    height: "56px"
    text_style: "body, bold, base"
  total_block:
    bg: "primary"
    text: "on_primary"
    radius: "12px"
    layout: "horizontal centered"
    height: "56px"

design_principles:
  - "Une seule ligne par information clé pour éviter le chaos visuel."
  - "Centrage vertical des éléments dans les blocs de résumé."
  - "Hiérarchie claire : le prix est l'information la plus importante."
  - "Boutons larges pour une manipulation facile."
  - "Utilisation de preuves visuelles pour valider les prix."
---

# Guide d'intégration web

## Catalogue alphabetical order — 2026-10-04

Sort displayed product cards by French Canadian product name in both modes,
all categories, `Tous` and search results. Ignore case, accents and punctuation
for ordering; use natural numeric order, then store and stable offer ID for
ties. Apply this after offer selection/filtering for every loaded week, without
changing the source deal ranking, product names, IDs, prices or saved baskets.

## Dated-price navigation — 2026-10-03

The shared chart banner centers the selected price, date and change in one
vertical stack. Previous/next controls have equal widths; narrow containers
use 44 px arrow buttons with accessible labels. Current-week and historical-low
reference values sit in a centered summary with 16 px separation below the
banner. Do not restore the two removed historical-format disclaimer paragraphs
in product dialogs. Assessment and savings eligibility remain unchanged.

## Responsive header and archive photos — 2026-10-03

Header actions share typography, padding and row height. Reserve their natural
width on desktop; move search to its own row at 1200 px and navigation to a
full-width row at 900 px. Below 600 px the three navigation actions retain
equal columns and the existing mobile basket remains separate. Never truncate
the basket label or use a different breakpoint for the history button.
The account control stays at the far right in a reserved column, with a distinct
outlined treatment and stable label during sign-in initialization. Account page
button styles must not affect the embedded identity provider's controls.
Products use two columns on phones, three from 700–900 px, and the existing
desktop columns beside the basket. Keep full names, unit prices and 44 px add
and comparison controls; wrap card content instead of truncating it.

Archive results show source-photo thumbnails. The selected chart date controls
the larger photo and its date caption; clicking enlarges it inside the site.
Attach proof only with an exact archived store/product/date/price/unit/size
match. Missing or ambiguous proof uses a clear unavailable state, never a
different week's image. Keep the product title below the sticky modal header
when a mobile result scrolls into view.

Ce document est la source de vérité visuelle pour le site statique `website/`.
Le site doit utiliser ces jetons sans réécrire la structure de l'app: le flux
`Bons prix`, `Tous les produits`, filtres d'épiceries, panier final et PDF
reste prioritaire sur toute exploration visuelle.

## CSS Tokens

Les couleurs sont mappées dans `website/styles.css`:

```css
:root {
  --color-linen-bg: #faf9f6;
  --color-evergreen: #2d4739;
  --color-border-subtle: #dadad7;
}
```

## Cartes Produit

Chaque produit doit garder une grille stable:

- image de preuve ou placeholder stable
- nom du produit
- prix et unité
- magasin
- bouton `Ajouter`

## Bloc Total

Le total doit rester lisible et prudent:

- libellé `TOTAL ESTIMÉ`
- montant en évidence
- note courte pour taxes, dépôts, quantités réelles et prix au poids
- aucun calcul de prix au poids sans quantité réelle

## Shopping workspace — 2026-10-03 (supersedes earlier October 3 pass)

Reference: Bâtir à rabais catalogue, product comparison and in-site circular reader.
Identity: Ma liste d’épicerie; transparent wordmark in `website/assets/ma-liste-epicerie-logo.png`. Preserve the grocery-bag illustration, evergreen ink and two-line serif lettering.
The palette remains linen / evergreen. Inter now handles interface headings as
well as body text; the serif wordmark remains in the logo. This is the user's
reference-led revision of the earlier Playfair interface-heading direction.

`website/shopping-workspace.css` is the component layer over `styles.css`.

| Token | Contract |
| --- | --- |
| Spacing | 4, 8, 12, 16, 24, 32 px |
| Touch controls | 44 px minimum on mobile |
| Corners | 8 px controls, 12 px panels |
| Type | 11–12 px metadata, 14–15 px product text, 24–30 px headings |
| Workspace | 1440 px maximum, 24 px desktop / 16 px phone gutters |

- Three zones remain: controls, active product category, right shopping list. Dark evergreen store banners distinguish destinations from item amounts.
- Store banners show verified street addresses when available. Known branch choices open an in-site searchable dialog. Save the chosen address
  per region/store and use it in both PDF paths; never invent an address from a
  city label. Directory coverage is partial, with source/date provenance.
- Store shortcuts are left aligned. Store/rayon grids wrap with complete labels.
- Phone filters collapse. Cards use one readable column below 600 px, two on
  tablet, and two or three beside the desktop list according to available width.
- Cards share equal heights within each grid row and use natural height on phones.
  A 44 px photo control shows “+” or “✓ Ajouté”; the full name, sale price and
  unit sit compactly below. A compact pill beside the price opens a native
  comparison dialog. It shows only the competing reference, never the current
  offer again or a circular photo. Neutral comparison pills list alternative
  offers; regular-price savings show that reference explicitly. This supersedes
  the inline layout at the user’s 15:13 request and follows the 15:55 refinement.
  No external circular button or process explanation appears on cards.
- Unknown or different formats use a neutral “N prix” pill. Dollar savings
  require matching product/format/unit/period or a regular price explicitly
  visible in that exact flyer. The modal identifies the competing reference. Verified loyalty conditions
  stay beside the affected offer (“Avec carte Moi” for Metro), including the
  list; the compact PDF exception below supersedes the earlier PDF requirement.
  Do not repeat a generic warning below savings. Weight-based savings remain per unit and are excluded from totals.
- Basket savings are prospective and appear beside the estimated total, also
  in PDF exports. Historical median/low prices appear only with at least three
  prior weeks for the same store/product/format; they are not regular prices.
- On phones only (≤600 px), a bottom list bar shows count, estimated total and savings.
  Bottom page padding keeps the final product reachable. The list opens with a
  return action, focus containment and all PDF/share/remove controls.
- At 601–900 px, the same list control moves into a sticky top bar in the page
  flow, so totals and the full basket stay reachable while browsing. Above
  900 px, desktop retains the right sidebar. Match the access-control and
  sidebar breakpoints; a weight-only basket displays “Total à calculer”.
- Circulars open in a native dialog with real covers and scrollable full pages.
  Image loading failures have an explicit message and source link.
- Preserve default Bons prix, all items, store selections, Costco optional/off,
  week window, price collection/scoring, original subtotal rules and PDF flow.
  No new pagination, historical rescoring or unknown-unit subtotal exclusion.
- City options require genuine source datasets. Joliette, Montréal (H2X1Y4),
  and Québec (G1R4P5) have separate snapshots and saved lists. New regions show
  advertised flyer reductions; a selected branch address does not confirm its
  inventory or eligibility for every regional flyer offer.
  Do not claim nationwide, radius-based, inventory or branch-specific coverage.

- Disclosure chevrons share one 14 px shape, with 20 px inset on selectors.
  Phone filter disclosures use the same shape; stack them below 360 px.
  Branch and comparison dialogs share their 44 px close control.

### Dropdowns and modal fit — 2026-10-03

- Reuse `.disclosure-icon`, `--chevron-size` and `--dropdown-inset` for every
  new dropdown. Keep the arrow separate from the label, with a 16 px gap;
  never use a text glyph or leave a native arrow against the border.
- Long or dynamic option lists use `enhanceDropdown` in `website/dropdown.js`.
  Overlay the menu without moving surrounding content. Align it to its field,
  open above when there is more room, and cap its scroll area at the available
  dialog/viewport height (maximum `min(260px, 35dvh)`). Wrap complete labels.
  Preserve keyboard selection, Escape,
  focus and explicit empty states. Do not rely on a native popup for long names.
- History filters stack below 480 px; dialog content scrolls vertically while
  its close control stays visible. Test open menus and long selections at
  320 px and 390 px, not just closed fields. No horizontal overflow or clipped
  text; touch controls remain at least 44 px.
- Chart previous/next controls belong inside the dated-price banner on one
  horizontal row. Use full accessible labels and 44 px targets; hide the visible
  navigation words in narrow containers so date, price and change remain readable.


## Savings and price context — 2026-10-03, 17:35 (supersedes percentage pills)

- Compare the same product at an equivalent quantity when both formats are
  confirmed. Convert mass/volume/count only within their own dimension. Keep
  exact package prices visible, show the equivalent calculation in the modal,
  and sum estimated savings for the selected package. Per-weight savings stay
  outside the total without a weight. The Bons prix view uses the lower unit
  price for a matching product; the full catalogue keeps every offer.
- The savings filter includes verified dollar savings. Never subtract package
  sticker prices across different sizes. Unknown count-to-weight conversions
  stay neutral. Historical price changes do not count as basket savings.
- Remove supplier-percentage-only pills and their empty photo-link popups.
  A product with no competing offer can open an interactive price chart. Only
  comparable prior observations support Prix bas / Prix habituel / Prix élevé;
  show dates, median, prior equal price and source context. Unconfirmed past
  formats remain visible without a recommendation. No invented narrative.
- Competitor dialogs remain compact. Voir l’offre opens the real source photo
  in a nested in-site viewer. Do not append an unrelated historical chart to a
  direct competitor comparison.
- Store shortcuts form a segmented option group, and flyer close uses one
  contained Fermer × control. Preserve the side-conversation history and list
  archive refinements.
- Mes listes stores a frozen weekly snapshot on this device. Re-saving updates
  the week/region; it does not multiply savings. Offer save-and-export choices.
  Never present local persistence as account synchronization or paid-service
  readiness. The service proposal is in reports/service-audit-2026-10-03.md.


### Location and saved-list stability — 2026-10-03

- Mes listes / Archives share a fixed 560 px dialog height, capped to the
  viewport; content scrolls inside while the heading and close button stay put.
- Location search keeps a 520 px shell, capped to the viewport, with scrollable
  search results. Remove explanation blocks from the location picker; source
  attribution stays in the closed Sources disclosure in the footer.
- Device location is explicitly requested fresh (no cached position), with a
  bounded wait and actionable failure. A new origin resets old branch choices.
  Town-center distances and device distances must remain distinguishable.
- Distances use “À X km”, adding “de toi” only for a device-derived origin.
  They remain geographic distances; never label them as driving distances.

### Compact store destinations — 2026-10-03

- Basket store banners keep name/distance at left and street/city plus Modifier
  at right. Omit postal codes and mailing boxes from the compact label only;
  preserve the complete address for exports. Wrap naturally at phone widths.
- Maps links use a named store and known address; incomplete branches open a
  named search around their coordinates. Keep Modifier a 44 px touch target.

### Compact grocery PDFs — 2026-10-03

- Use compact print typography: 18 pt title, 12 pt store names, 9.5 pt product
  rows and 32 pt page margins. Keep complete addresses beside store names,
  prices aligned right, thin separators, and a small final evergreen total.
- Separate each grocery with a slim evergreen banner, including on continued
  pages. Vertically center names and prices within their rows, including when
  a product wraps onto multiple lines. Keep the banner address aligned right.
- Show the top total and savings on one line. Remove membership annotations,
  repeated exclusion counts and redundant table column headings from PDFs at
  the user's request; retain units, conservative calculations and one short
  taxes/deposits/weight caveat. Website loyalty labels remain unchanged.
- Browser download and local print exports share the same compact hierarchy.
  Each grocery starts on a separate page. Short rows have balanced padding;
  wrapped descriptions and longer lists paginate with repeated store headings.
  Item prices use regular weight; totals and subtotals use bold. Currency
  explanation labels are omitted (October 4 refinement).

## Guest ordering review — 2026-10-04

`Mon espace` always opens the list/profile page; optional sign-in lives inside that space. Guest preferences, favorite branches and saved lists persist on the device. A cloud failure cannot prevent opening the already-saved local copy.

Prepare an entire store list in one action. Every item is prefilled; editing is optional for quantities, formats and alternative offers. Never claim that a retailer home link populates a cart. If the provider is unavailable, show that before the review and keep copy/open-retailer options secondary. Preserve flyer prices separately from current checkout prices.

The order dialog uses a bounded 680 px desktop width and viewport-relative phone width with 12 px outer margins. Its heading/close control stays outside the scrollable body. All account/order selects use the shared visual chevron shape, 20 px right inset and reserved label space. No horizontal scrolling or minimum-width overflow; controls retain 44 px targets.

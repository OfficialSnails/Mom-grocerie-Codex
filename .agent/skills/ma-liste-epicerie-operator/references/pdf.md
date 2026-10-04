# PDF export, printing and sharing

Preserve both real export paths, not browser-print-only or a replacement PDF stack:

- Hosted/download/share and account lists: `website/list-pdf.js` → `pdf-document.js` (jsPDF), with share handling in `app.js`/account consumers.
- Local Desktop export: `src/serve-website.ts` → existing model builder/shared `website/print-document.js` → Chrome PDF output on Desktop.

Read `tests/pdf-document.test.ts`, relevant `tests/report-generation.test.ts` cases and `DESIGN.md`. Inspect callers so both paths retain the same grouping, source prices, chosen addresses, notes and conservative totals.

## Presentation contract

- **Ma liste d’épicerie** heading; compact context and estimated total near the top.
- Each grocery starts a page. Compact evergreen store banner: name left, address right; repeat on continued pages.
- Regular item prices, bold totals/subtotals. Balanced padding and aligned columns even with wrapped names.
- No redundant CAD note, methodology/reason columns or extra membership annotations. Keep sale units and caveat for taxes, deposits, real quantities and variable prices.
- Keep the final total with the last product when possible. No orphan headings, clipped prices, footer collisions or unnecessary blank final page.
- Download/print actions use consistent button styling, loading/error states and correct page-count grammar.

## Verify actual artifacts

1. Run `npx vitest run tests/pdf-document.test.ts` plus affected pricing/report tests.
2. Generate source-backed samples through both affected renderers. Fictional stress samples stay clearly labeled in ignored `output/`, never in production weeks/baskets. Inspect any existing ignored preview script before reuse; it is not a guaranteed entrypoint.
3. Use the `pdf` skill to extract text and render pages. Check every amount, subtotal/total, actual page count, wrapping and page bottoms visually.
4. Browser-test the real download/export control and its `.pdf`. Local mode must yield the named Desktop file; hosted mode yields a download, not a silent Desktop write.
5. Sharing generates the same PDF, uses native file sharing only if supported, and handles cancellation/download fallback. Do not complete an outbound share merely to test the sheet.

Read [pricing.md](pricing.md) for arithmetic discrepancies and [release.md](release.md) only for authorized publication.

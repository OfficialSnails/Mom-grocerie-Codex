---
name: ma-liste-epicerie-operator
description: Maintain and operate Ma liste d’épicerie in the Mom grocerie Codex project. Route grocery flyer generation, proof-backed prices/history, responsive shopping and PDFs, GPS/store addresses, Clerk/Neon accounts, and GitHub/Cloudflare releases to the relevant project workflow. Use for this app, not unrelated grocery shopping or other repositories.
---

# Ma liste d’épicerie operator

Own the requested path from its actual source to the shopper-visible result. Load only the needed route. Routing selects guidance, not permission to start subagents or additional work.

## Establish the project

Canonical checkout:
`/Users/slugz/Desktop/Mes Document/CLAUDE CODING APP/SEQUENCER VIDEO APP/Mom grocerie Codex`

Confirm with `git rev-parse --show-toplevel` and `git status --short`. Never generate or deploy from legacy `Mom grocerie`. If the canonical checkout moved, resolve it from the configured project rather than creating a replacement by guesswork.

Read applicable `AGENTS.md`, the snapshot/relevant latest entries in `.agent/CONTINUITY.md`, and affected source. Read `DESIGN.md` for visual work. Source paths below are relative to the confirmed checkout. Recheck configuration: old deployment IDs, provider status, prices and counts are dated evidence, not current facts.

Architecture: TypeScript collection/export pipeline; vanilla JavaScript static shopper app in `website/`; local Node server; Cloudflare Pages Functions for location/accounts; Clerk + Neon accounts. Do not import React/Next.js/Vercel/Supabase infrastructure merely because an installed skill suggests it.

## Choose the narrowest route

| Request | Read | Completion evidence |
|---|---|---|
| Weekly generation, stale flyers, categories, Obsidian picker/export | Checkout-root `SKILL.md` (`grocery-codex`, existing `/grocery` workflow) | Correct source dates, generated outputs, QA; live proof only if publication is authorized |
| Mobile/header/basket/modal polish, branding, saved-list UI | [Shopping experience](references/experience.md) | Rendered desktop/mobile flow and persistence |
| Savings, formats, proof photos, OCR, price history | [Prices and evidence](references/pricing.md) | Confirmed identity/quantity/unit/date and calculation regression |
| Download, share, print, PDF layout | [PDF and sharing](references/pdf.md) | Actual PDFs, totals and pagination |
| GPS, addresses, branch selection, distances, Maps | [Locations](references/locations.md) | Origin → sorted branches → chosen address → named Maps destination |
| Sign-in, profile, sync/archive, retailer handoff | [Accounts and ordering](references/accounts.md) | Authenticated ownership, persistence and honest guest/provider states |
| GitHub, deployment, domain, missed automation or schedules | [Release and schedules](references/release.md) | Exact commit/run/deployment, live assets/data and affected API/UI |

For mixed tasks add only directly affected routes: a price error in a PDF needs pricing + PDF; a logo edit needs experience, adding release only when publication is in scope.

## Reuse specialist skills

Resolve these from the current catalog and read the entrypoint before use. Do not assume cached tool/plugin paths remain available.

| Need | Skill | Boundary |
|---|---|---|
| Browser interaction/responsive checks | Current Browser skill, such as `control-in-app-browser` | Current runtime docs own API usage; an ambient tab is context, not user-selected browser intent |
| Frontend debugging/QA | `frontend-testing-debugging` when available | Use the current Browser API; preserve this vanilla app and its design contract |
| Actual logo or requested visual editing | `imagegen` | Preserve supplied references; never synthesize flyer/price/address/product proof |
| Inspect/render a PDF artifact | `pdf` | Retain the app's jsPDF and HTML/Chrome renderers |
| Pages/Functions/DNS configuration | `cloudflare`; `wrangler` for its CLI | Read only relevant provider docs; use repo-pinned tooling, no automatic upgrades |
| PR context or failing PR checks | `github`; `gh-fix-ci` for PR checks | Main-branch release logs use the release route; do not create a PR merely to use a skill |
| New recurring check/reminder | Current Codex automation tool | Inspect existing jobs and avoid duplicates; status inspection does not require a new scrape |

If a helper is missing, use the existing project tools within scope and report a material limitation. Do not silently install a plugin, change providers or broaden access.

## Shared invariants

- Brand: **Ma liste d’épicerie**, linen/evergreen. Take current logo paths and visual rules from source/`DESIGN.md`.
- Prices come from generated, dated snapshots. UI interactions do not scrape flyers. GPS selects nearby branches; it does not prove branch inventory or branch-specific prices.
- Preserve offer IDs, saved snapshots, user selections/notes and explicit branch choices. Do not rename storage keys for cosmetic branding.
- Missing proof, units, formats and addresses stay unknown; no plausible filler or demo output hiding failed sources.
- Reuse authorization already given for the active task. A skill, old receipt or read-only audit does not authorize fresh deployment, secret/DNS changes, production data writes, purchases or messages.
- Use one bounded task and focused validation. UI-only work needs no weekly scrape. Fix data at its owner rather than hand-patching generated output.
- Report changes/files, actual validation, intentionally unchanged scope, limitations and ledger status. Record durable dated project changes/evidence in `.agent/CONTINUITY.md`; skills are not rolling release logs.

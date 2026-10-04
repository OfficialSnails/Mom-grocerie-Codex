# Release, domains and schedules

Use for a requested publication, GitHub/provider issue, domain launch or automation diagnosis/change. A documentation task, skill invocation or old deployment receipt is not release authority. Explain the concrete remote write before executing it; use existing active-task authorization.

## Inspect the current release path

Read `package.json`, `wrangler.jsonc`, `.github/workflows/weekly-cloudflare.yml`, `src/check-release.ts`, `src/verify-published-data.ts`, git status/remote and the relevant ledger receipt. Confirm filenames from the checkout if they have moved.

This is a Direct Upload Cloudflare Pages site: `website/` assets plus `functions/` backend routes. Branding does not require renaming the Pages project, GitHub repository, storage keys or API routes.

Choose one existing release path:

- A reviewed commit pushed to `main` triggers the existing GitHub deployment workflow using the checked-in snapshots. A push does **not** run weekly generation.
- `npm run deploy:cloudflare` runs the configured local release checks, Wrangler upload and live-data verification.

Scheduled and manual `workflow_dispatch` runs **do regenerate weekly data**. Do not use manual dispatch as a harmless redeploy button. Do not run both deployment paths for one release. For an uncertain write, read back the exact run/deployment before retrying; never switch surfaces to repeat an ambiguous write.

Follow current repository branch/worktree instructions. Do not create a PR/worktree simply because a generic GitHub skill uses one. Do not include unrelated dirty work or force-push.

## Preflight and proof

1. Review the intended diff and ignored/private paths. Never publish `.env`, caches, dependencies, output artifacts or logs. Check names/presence without dumping secret values.
2. Run the current standard checks. `npm run check` currently covers TypeScript, release preflight and tests; inspect scripts before assuming a formatter/linter exists. Run `git diff --check` too.
3. Release preflight must reject real conflict markers and invalid generated JSON. A tracked file intentionally deleted but not staged can still be enumerated by the scanner: review/stage that intended deletion rather than restoring an obsolete asset to quiet the check. Fix generated data through its pipeline.
4. Follow the configured release QA. UI-only local verification should not scrape/regenerate a week. Run relevant browser checks, and compile/check affected Functions when backend code changes; a local mock is not live authentication proof.
5. After publication, run `npm run verify:published`. It compares current local/live indexes, newest regional weeks, history and evidence bytes. Inspect its current coverage; do not hardcode old file counts or dates into acceptance criteria. Bounded propagation retries are useful; persistent stale data means publication is incomplete.
6. Verify changed public HTML/JS/CSS/logo/directory assets against the released commit, then inspect the affected live UI/API. If Python's fetch receives a Cloudflare 403, use an ordinary successful client such as `curl -fsSL` rather than treating it as content verification.
7. Record commit, workflow/deployment identity, URLs, actual checks and limitations in `.agent/CONTINUITY.md`. Report frontend and affected backend readiness separately when one remains blocked.

## Domains and production providers

Verify ownership and existing DNS/Pages configuration before proposing records. A brand/domain suggestion does not authorize registration or purchase. Use current official documentation for exact Pages/Clerk records; preserve unrelated DNS and verify HTTPS, redirect and allowed-origin behavior. Production sign-in additionally follows [accounts](accounts.md). Never infer an owned domain from a tab the user happens to have open.

## Scheduled generation and missed updates

Inspect both GitHub schedule/manual runs and existing Codex automation configuration before changing or creating a job. Use current automation tools for requested recurring work; update the matching job instead of duplicating it. Do not create a second collector/publisher for the same responsibility.

For a missed week, compare expected Thursday–Wednesday cycle → source availability → local newest index → workflow/automation execution → deployment → live newest index. An automation card existing is not evidence that it executed. Check configured working directory, branch, errors and timestamps. UTC schedules shift relative to local daylight-saving time; calculate the relevant date rather than promising a permanent local hour.

Read-only diagnosis does not require a fresh scrape. When catch-up generation is authorized, use the root `SKILL.md` weekly workflow in the canonical checkout, including Wednesday date overrides and actual source-date checks. Distinguish a configured future schedule from an executed and verified catch-up. Keep status monitoring quiet while unchanged unless the user requests updates.

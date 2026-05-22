# vendor/

This folder is **reserved for Story 2.2**, which populates `vendor/design-md/` with a frozen copy of the `design-md` Claude Code skill (Alan Nicolas, MIT) — see Aria Amendment A-1.

## Policy

- `vendor/design-md/` will be a **frozen vendored copy** synced from `.claude/skills/design-md/` at a specific commit
- A `VENDORED.md` file inside will document: source SHA, copy date, and "DO NOT edit in place — re-vendor instead"
- Story 2.6 ships `scripts/check-vendor-drift.cjs` to detect when upstream `design-md` diverges from the vendored copy (gap G-8)

## Why vendor instead of npm dep or symlink

- **Reproducibility:** every install gets identical design-md regardless of user's local version
- **Portability:** the skill works without requiring user to have `.claude/skills/design-md/` installed
- **Atomic dep tree:** vendored deps live under `vendor/design-md/node_modules/` (gitignored)

## Hybrid model (Aria A-1)

- Full pipeline invoked via `child_process spawn vendor/design-md/run.cjs`
- Shared utilities (`lib/utils.cjs`, `lib/llm.cjs`) `require()`-d directly — saves duplication

## Why empty in v0.1

Story 2.1 ships the orchestration shell + stubs. The adapter at `lib/adapters/design-md-adapter.cjs` is a stub returning `{ skipped: true }`. Story 2.2 will:

1. Copy `.claude/skills/design-md/` → `vendor/design-md/` (excluding `node_modules/`, `outputs/`, `.git*`)
2. Write `vendor/design-md/VENDORED.md` with SHA + policy
3. Add `postinstall` script in `package.json`: `(cd vendor/design-md && npm install)`
4. Replace the adapter stub with a real `spawn` + result-parsing implementation

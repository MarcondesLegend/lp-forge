# Vendored Copy — design-md

**Vendored:** 2026-05-22
**Source:** `~/.claude/skills/design-md/` (Alan Nicolas, MIT)
**Upstream:** https://github.com/oalanicolas
**License:** MIT (preserved — see LICENSE-equivalent in `package.json`)
**Excluded paths:** `node_modules/`, `outputs/`, `.git*`

## Policy

**DO NOT edit files in this directory.** This is a frozen vendor copy. To upgrade:

1. Re-run vendoring script (`scripts/check-vendor-drift.cjs` in Story 2.6 will detect when upstream evolves)
2. Or manually: `rm -rf vendor/design-md && cp -r ~/.claude/skills/design-md/ vendor/design-md/ && rm -rf vendor/design-md/{node_modules,outputs,.git}`
3. Update this file's "Vendored" date
4. Run `npm install` in lp-forge root (triggers postinstall → vendor `npm install`)
5. Run lp-forge test suite to verify compatibility

## Why vendoring (per Aria Amendment A-1)

- **Reproducibility:** every install ships identical design-md
- **Portability:** no dependency on user having `~/.claude/skills/design-md/`
- **Hybrid model:** full pipeline invoked via `child_process spawn run.cjs`; shared utilities (`lib/utils.cjs`, `lib/llm.cjs`) `require()`-d directly

## What lp-forge uses from this copy

- `vendor/design-md/run.cjs` — invoked as child process (full extraction pipeline)
- `vendor/design-md/lib/utils.cjs` — slug helpers (future: when lp-forge consolidates utils)
- `vendor/design-md/lib/llm.cjs` — provider abstraction (future: Story 2.5 generation phase)

## Updating

Story 2.6 ships `scripts/check-vendor-drift.cjs` which compares this VENDORED.md timestamp + SHA against the user's local design-md to warn on drift. Manual re-vendor is acceptable; do not edit in place.

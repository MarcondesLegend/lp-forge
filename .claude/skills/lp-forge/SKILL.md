---
name: lp-forge
description: 'URL → analysis report + brand-preserving Next.js redesign. Composes design-md (extraction) + huashu-design protocol (brand capture) + frontend-design (aesthetic discipline). Produces a complete analysis document plus a runnable Next.js 15 application with the source site brand preserved (logo, hero, colors, fonts) and a dramatically improved design.'
version: 0.1.0
---

# /lp-forge — URL → Analysis + Redesigned Next.js

**Status:** v0.1.0 — Foundation only (Story 2.1). Phases 2-7 are stubs awaiting Stories 2.2-2.6.

## When to invoke

- User asks to "redesign this site": `<URL>`
- User asks to "analyze + regenerate" a small-business landing page
- User wants the source site's brand DNA preserved but the design dramatically improved
- User has a prospect URL and wants both a written analysis and a working Next.js app to demo

Skip if the user wants pure extraction only → use `/design-md`. Skip if the user wants HTML prototypes → use `/huashu-design`. Skip if no specific URL is in scope → use `/frontend-design` alone.

## Install

```bash
# 1. Drop the folder into your project (already done if you're reading this in-place)
cp -R lp-forge .claude/skills/

# 2. Install Node deps
cd .claude/skills/lp-forge
npm install

# 3. (Optional) Install Playwright for SPA/bot-block fallback
npm run install-playwright
```

Requires Node 18+. Provider cognition layer is `claude -p` CLI (default for local) or OpenRouter (set `OPENROUTER_API_KEY`).

## Quick run

```bash
node .claude/skills/lp-forge/run.cjs \
  --url https://restauranteexemplo.com.br \
  --business-name "Restaurante Exemplo" \
  --category "restaurante" \
  --city "São Paulo" \
  --lang pt-BR
```

Outputs land under `outputs/lp-forge/{slug}/` relative to CWD.

## CLI flags

| Flag | Default | Notes |
|---|---|---|
| `--url <url>` | **required** | Public http(s) URL of source site |
| `--business-name <name>` | inferred | Override LLM inference |
| `--category <cat>` | inferred | Business category (drives direction picker) |
| `--city <city>` | inferred | City context (drives copy regionalization) |
| `--lang <lang>` | `pt-BR` | Only `pt-BR` supported in v0.1 |
| `--out <dir>` | `outputs/lp-forge/{slug}/` | Output directory |
| `--direction <name>` | auto-picked | One of: `editorial`, `industrial`, `luxury`, `playful`, `brutalist`, `organic` |
| `--from-phase <N>` | 1 | Resume from phase N (1-7) |
| `--no-reuse` | off | Disable phase-reuse cache (force cold run) |
| `--allow-playwright` | off | Enable Playwright fallback when static fetch hits content-gate |
| `--provider <id>` | auto | `claude-cli` (local) or `openrouter` (CI/Vercel) |
| `--model <id>` | provider default | Allow-list enforced |
| `--verbose` / `--quiet` / `--silent` | normal | Control stdout verbosity (JSON log always written) |

## Pipeline (7 phases)

1. **Fetch + Extract** — invokes vendored `design-md` for HTML/CSS bundle, tokens, style fingerprint, stack detection, page markdown
2. **Brand Capture** — huashu §1.a 5-step: logo (3-tier fallback with typography logotype), hero imagery, UI screenshots, palette, fonts → `brand-spec.md`
3. **Business Info** — LLM-grounded extraction of services, hours, contact, social proof → `business-spec.md` (zero invention)
4. **Direction Pick** — category + fingerprint + brand keywords → 1 of 6 aesthetic directions
5. **Analysis Synth** — synthesizes all of the above into `analysis-report.md` (deliverable #1)
6. **Generate Next.js** — direction-aware Next.js 15 + Tailwind + (optional shadcn) with grounded copy and audit watermark
7. **Validate** — inverse design-md drift check + aesthetic-lint + LLM self-rubric → `validation-report.json`

Each phase emits structured JSON logs to `outputs/lp-forge/_logs/{date}.jsonl` and a summary to `run-telemetry.json`.

## Exit codes

| Code | Meaning | Recovery |
|---|---|---|
| 0 | Success — both deliverables produced + validation pass | — |
| 1 | Usage error (missing required flags) | Read help; re-run |
| 4 | Content-gate failure (bot block / SPA shell / paywall) | Retry with `--allow-playwright` |
| 5 | LLM exhausted budget or repeatedly failed | Check `inputs/prompt.txt`; raise `--max-tokens` |
| 6 | Provider misconfigured (`openrouter` without API key) | Set `OPENROUTER_API_KEY` |
| 7 | HTTP error from upstream | Retry or check URL |
| 8 | Brand assets insufficient (no logo AND no business-name to generate logotype) | Provide `--business-name` or manual asset |
| 9 | Business info too thin | Provide `--business-name` and `--category` |
| 10 | Next.js template generation error (broken JSX from LLM) | Re-run phase 6 |
| 11 | Validation/aesthetic-lint flagged issues (non-blocking by default; `--strict` makes it blocking) | Review `validation-report.json` |
| 12 | Playwright fallback requested but Playwright not installed | Run `npm run install-playwright` |
| 13 | Sanitization hard-block (source content overwhelmingly hostile to prompt injection) | Manual review of source URL |

## Anti-patterns

- Don't bypass huashu §1.a brand-asset protocol — use CSS silhouettes instead of real logos = exit 8
- Don't disable `temperature: 0` in production — idempotency contract depends on it
- Don't invent business facts — copywriter only paraphrases `business-spec.md`
- Don't use Playwright by default — static-first is the ethos; activate only when content-gate fires
- Don't edit `vendor/design-md/` — re-vendor instead via documented procedure (Story 2.6 `scripts/check-vendor-drift.cjs`)

## References

- **Architecture:** `../../docs/architecture/Wave2-3-lp-forge/architecture.md` + `architecture-review-aria.md`
- **Research:** `../../docs/research/skills-synthesis-lp-forge.md`
- **Epic:** `../../docs/stories/epics/epic-002-lp-forge/README.md`
- **Source skills:** `design-md`, `huashu-design`, `frontend-design`

## Authors

- Pipeline architecture: AIOX squad (Story 2.1 implemented by @dev Dex; reviewed by @architect Aria; validated by @po Pax)
- Source skill: `design-md` by Alan Nicolas ([@oalanicolas](https://github.com/oalanicolas)) — vendored under MIT
- Brand protocol doctrine: `huashu-design` by 花叔
- Aesthetic manifesto: `frontend-design` (Claude Plugins official)

# lp-forge

> URL → comprehensive analysis report + brand-preserving Next.js redesign

`lp-forge` takes a single URL and produces two deliverables: (1) `analysis-report.md` — a comprehensive site assessment, and (2) `redesign/` — a working Next.js 15 application with the source site brand identity preserved but the design dramatically improved.

**Status:** v0.1.0 — Story 2.1 (Foundation) complete. Stories 2.2–2.6 implement Phases 2–7.

## Quick start

```bash
# From the skill directory
cd .claude/skills/lp-forge
npm install

# Run on a URL
node run.cjs --url https://example.com.br --business-name "Example Corp" --category "restaurante"
```

Outputs land in `outputs/lp-forge/{slug}/` relative to your CWD.

## Installation

```bash
# 1. Copy the skill folder into any Claude Code project's .claude/skills/
cp -R lp-forge /path/to/your-project/.claude/skills/

# 2. Install Node dependencies
cd /path/to/your-project/.claude/skills/lp-forge
npm install

# 3. (Optional, ~300MB) Install Playwright for SPA/bot-block fallback
npm run install-playwright
```

Requirements:
- Node.js 18+
- One of:
  - `claude` CLI on `PATH` (local dev), OR
  - `OPENROUTER_API_KEY` env var (CI / cloud)

## Three example invocations

### 1. Single URL with full hints

```bash
node run.cjs \
  --url https://restauranteexemplo.com.br \
  --business-name "Restaurante Exemplo" \
  --category "restaurante" \
  --city "São Paulo" \
  --lang pt-BR
```

### 2. Resume from a specific phase

```bash
# Skip Phase 1 (extraction) if it already ran successfully
node run.cjs --url https://restauranteexemplo.com.br --from-phase 2
```

### 3. Force aesthetic direction

```bash
node run.cjs \
  --url https://oficinadoze.com.br \
  --business-name "Oficina do Zé" \
  --category "oficina mecânica" \
  --direction industrial
```

## What gets produced

```
outputs/lp-forge/{slug}/
├── analysis-report.md       # Deliverable #1 — analysis doc (Story 2.4)
├── DESIGN.md                # From vendored design-md
├── tokens.json              # Design tokens YAML frontmatter parsed
├── style-fingerprint.json   # Detected aesthetic archetype
├── brand-spec.md            # huashu §1.a 5-step output (Story 2.3)
├── business-spec.md         # Business facts (Story 2.3)
├── direction.yaml           # Picked aesthetic direction (Story 2.4)
├── before-preview.html      # Preview of source site (from design-md)
├── redesign/                # Deliverable #2 — runnable Next.js (Story 2.5)
│   ├── app/
│   ├── components/
│   ├── public/brand/
│   └── README.md
├── validation-report.json   # Drift + aesthetic lint (Story 2.6)
├── run-telemetry.json       # Timing, cost, decisions
└── _logs/{date}.jsonl       # Structured logs (Amendment A-5)
```

## Architecture decisions (locked by Aria review)

| Decision | Choice |
|---|---|
| Vendoring `design-md` | Frozen vendor + library import hybrid |
| Playwright | `optionalDependencies`, on-demand |
| Stack | Tailwind across all 6 directions; shadcn for 4/6 |
| Logo fallback | 3-tier: huashu protocol → typography logotype → exit 8 |
| Language | pt-BR v0.1, i18n-ready structure for v0.2 |
| Idempotency | `temperature: 0` hard-locked in production |
| Asset hosting | `public/brand/` in generated Next.js (self-contained) |
| Wave 1 coupling | None — pure CLI v0.1 |

See `docs/architecture/Wave2-3-lp-forge/architecture-review-aria.md` for full rationale.

## Troubleshooting (top issues)

### Bot block on source URL (exit 4)
Cloudflare or similar bot detection on the source site. Retry with `--allow-playwright`:
```bash
npm run install-playwright   # one-time, ~300MB
node run.cjs --url <url> --allow-playwright
```

### Logo not found (exit 8)
The source has no extractable logo AND no business name provided to generate typography fallback. Provide `--business-name`:
```bash
node run.cjs --url <url> --business-name "Your Business Name"
```

### Build failures in generated Next.js (exit 10)
Phase 6 LLM produced broken JSX. Re-run with `--from-phase 6`. If persistent, inspect `outputs/lp-forge/{slug}/inputs/generation-prompt.txt`.

### Vercel deploy
Manual:
```bash
cd outputs/lp-forge/{slug}/redesign
npx vercel
```
Interactive auth required on first use. Not automated by `lp-forge` in v0.1.

### Font loading slow on dev mode
Generated `next/font` config uses Google Fonts. For air-gapped dev, swap to local `@font-face` with files in `public/fonts/` — see generator's font-loader fallback path.

## Status of phases

| # | Phase | Status |
|---|---|---|
| 1 | Fetch + Extract | 🚧 Story 2.2 |
| 2 | Brand Capture | 🚧 Story 2.3 |
| 3 | Business Info | 🚧 Story 2.3 |
| 4 | Direction Pick | 🚧 Story 2.4 |
| 5 | Analysis Synth | 🚧 Story 2.4 |
| 6 | Generate Next.js | 🚧 Story 2.5 |
| 7 | Validate | 🚧 Story 2.6 |
| 0 | Foundation (CLI, orchestrator, telemetry, logger, stubs, tests) | ✅ Story 2.1 |

## Links

- [SKILL.md](./SKILL.md) — canonical skill spec (Claude Code consumed)
- Architecture: `../../docs/architecture/Wave2-3-lp-forge/architecture.md`
- Architecture review: `../../docs/architecture/Wave2-3-lp-forge/architecture-review-aria.md`
- Research: `../../docs/research/skills-synthesis-lp-forge.md`
- Epic: `../../docs/stories/epics/epic-002-lp-forge/README.md`

## License

MIT

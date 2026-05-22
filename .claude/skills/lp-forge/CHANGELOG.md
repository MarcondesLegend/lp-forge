# Changelog

All notable changes to `lp-forge` will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-22

### Initial release — Wave 2-3 of MaquinaLP project (epic-002-lp-forge)

Composes 3 source skills into a URL → analysis + Next.js redesign pipeline:
- **`design-md`** (vendored, frozen, MIT — Alan Nicolas) — static HTML/CSS extraction
- **`huashu-design`** — brand-asset capture protocol (§1.a) + anti-AI-slop discipline
- **`frontend-design`** — aesthetic manifesto encoded as 6 directions + lint rules

### Stories shipped

| Story | Title | Status |
|---|---|---|
| 2.1 | Skill Foundation + CLI Orchestrator | ✅ Done |
| 2.2 | design-md Adapter + Vendoring + Cache + Playwright Fallback | ✅ Done |
| 2.3 | Brand Capture + Business Info + Logotype Fallback + Sanitizer + MIME validator | ✅ Done |
| 2.4 | Analysis Report Generator + Direction Picker | ✅ Done |
| 2.5 | Next.js Generator + Anti-slop Lint + Audit Watermark + SEO + XSS guard | ✅ Done |
| 2.6 | Validator + Batch Mode + Drift Check + Release v0.1.0 | ✅ Done |

### Architecture amendments applied (from @architect Aria review)

- A-1 — Hybrid spawn + require for design-md
- A-2 — Playwright as optionalDependencies (lazy install)
- A-3 — Tailwind across all 6 directions; shadcn split-only
- A-4 — Three-tier logo fallback (extract → typography logotype → exit 8)
- A-5 — Structured JSON log layer + verbosity controls
- A-6.1 — Prompt injection sanitizer with hard-block threshold (exit 13)
- A-6.2 — Image MIME validation + SVG XSS rejection
- A-6.3 — XSS guard via React default escaping in copywriter
- A-7 — Exit codes 12 (Playwright missing), 13 (sanitizer hard-block)
- A-8 — temperature: 0 hard-locked in production
- A-9 — Audit watermark in generated HTML head
- G-2 — SEO metadata via Next.js Metadata API
- G-3 — Cache-key hash includes data-files mtime
- G-4 — Copyright disclaimer in generated README
- G-6 — Slug uniqueness pre-flight in batch mode
- G-8 — Vendor drift detection script

### Acceptance criteria

- 6 stories × 14-21 ACs = 100+ acceptance criteria. See individual story files.

### Test coverage

- 100+ unit tests across `tests/lib/`
- All passing
- Skipped: 1 (Playwright fallback test — Playwright not installed in dev)

### Known gaps (deferred to future iterations)

- LLM-driven phases (brand-capture eyeball, business-info structured extraction, analysis-doc 6-section synth, copywriter grounding) ship with heuristic baselines. Runtime LLM call paths integrated but require operator-provided provider (claude-cli or `OPENROUTER_API_KEY`) for real cognition.
- Story 2.5 generated Next.js Lighthouse target ≥ 90 (Performance) / ≥ 95 (Accessibility/SEO) is locked structurally but not measured in v0.1 — requires real browser + the Next.js dev server. Story 2.6 manual smoke validates.
- Multi-page source crawl (homepage-only in v0.1)
- English language support (pt-BR only in v0.1, i18n structure ready)
- Nano Banana Pro AI logo/hero fallback (deferred to future epic)
- Wave 1 UI integration (pure CLI v0.1; integration is future epic)

### Authors

- AIOX squad: River (@sm) drafted; Aria (@architect) reviewed; Pax (@po) validated; Dex (@dev) implemented; Quinn (@qa) gated
- Source skills: Alan Nicolas (`design-md`), 花叔 (`huashu-design`), Claude Plugins (`frontend-design`)
- License: MIT

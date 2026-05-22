# Architecture — `lp-forge` Skill (Wave 2-3)

**Owner:** @architect (Aria) — ✅ **REVIEWED 2026-05-22** by Aria. Status: **APPROVED WITH MANDATORY AMENDMENTS A-1 through A-9**.
**Created:** 2026-05-22 (draft by @sm River) · **Reviewed:** 2026-05-22 (Aria)
**Companion docs (READ IN ORDER):**
1. `docs/research/skills-synthesis-lp-forge.md` — analytical foundation (@sm)
2. **`docs/architecture/Wave2-3-lp-forge/architecture-review-aria.md`** — ⚠️ **authoritative amendments** (@architect)
3. This document — baseline structure (some sections superseded by review §3)

> ⚠️ **READ THE REVIEW FIRST.** This baseline doc is *not* the source of truth on its own — amendments in `architecture-review-aria.md §3` override §5, §6, §7 of this doc on specific points (vendoring strategy, Playwright handling, Tailwind/shadcn split, logo fallback, exit codes, idempotency NFR, observability layer, security layer, audit watermark).

---

## 1. System Context

```
                    ┌─────────────────────────────────────────┐
                    │   Wave 1 (parallel squad)               │
                    │   Apify Google Maps → Supabase leads    │
                    └───────────────┬─────────────────────────┘
                                    │ lead.website (URL)
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │   lp-forge skill (THIS WORK)            │
                    │   .claude/skills/lp-forge/run.cjs       │
                    │                                          │
                    │   URL ─▶ Analyze ─▶ Capture ─▶ Generate │
                    └───────────────┬─────────────────────────┘
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
              ┌─────────────────┐      ┌─────────────────────┐
              │ analysis-report │      │ redesign/           │
              │ .md             │      │ (Next.js app)       │
              │                 │      │ deployable to Vercel│
              └─────────────────┘      └─────────────────────┘
```

`lp-forge` is **invoked by humans** (or eventually by Wave 1 UI's "Redesenhar" button) — not auto-triggered. It is a **CLI-first** skill.

---

## 2. Skill Structure

```
.claude/skills/lp-forge/
├── SKILL.md                          ← canonical skill doc (consumed by Claude Code)
├── README.md                          ← human-facing docs
├── run.cjs                            ← CLI entry; orchestrates all phases
├── package.json                       ← Node deps (axios, cheerio, turndown, motion, playwright)
├── lib/
│   ├── orchestrator.cjs               ← phase runner with reuse cache
│   ├── adapters/
│   │   └── design-md-adapter.cjs      ← invokes vendored design-md, parses outputs
│   ├── brand-capture.cjs              ← 5-step huashu protocol implementation
│   ├── business-info.cjs              ← captures hours / services / contact (LLM + regex)
│   ├── analysis-doc.cjs               ← synthesizes the deliverable analysis-report.md
│   ├── direction-picker.cjs           ← category → 1 of 6 aesthetic directions
│   ├── nextjs-generator.cjs           ← writes the Next.js project tree
│   ├── copywriter.cjs                 ← rewrites headlines/CTAs from business-spec only
│   ├── aesthetic-lint.cjs             ← anti-slop rule enforcer (frontend-design encoded)
│   ├── validator.cjs                  ← uses design-md drift mode on output
│   ├── playwright-fallback.cjs        ← SPA / bot-block recovery (gated)
│   └── llm.cjs                        ← claude-cli / openrouter abstraction (copied from design-md)
├── data/
│   ├── prompts/
│   │   ├── business-info-extract.txt
│   │   ├── analysis-doc-synthesize.txt
│   │   ├── copy-rewrite.txt
│   │   └── generation-prompt.txt      ← system prompt for Next.js generator
│   ├── category-to-direction.yaml     ← business category → aesthetic direction map
│   ├── aesthetic-lint-rules.yaml      ← anti-slop catalog (huashu §6 encoded)
│   ├── forbidden-fonts.yaml           ← Inter/Roboto/Arial blocklist with exceptions
│   ├── curated-font-pairs.yaml        ← ~30 display+body pairs per direction
│   └── pt-br-cliche-blocklist.yaml    ← Brazilian-market slop catalog
├── templates/
│   └── nextjs-base/                   ← Next.js 15 + Tailwind + shadcn scaffolding
│       ├── app/
│       ├── components/
│       ├── public/
│       └── package.json.tmpl
├── vendor/
│   └── design-md/                     ← frozen copy of design-md skill (vendored)
├── tests/
│   ├── fixtures/                      ← sample URLs (anonymized)
│   ├── lib/*.test.cjs                 ← unit tests per lib module
│   └── e2e/
│       └── full-pipeline.test.cjs     ← URL → redesign on a known fixture
└── outputs/                            ← gitignored runtime outputs
    └── {slug}/
        ├── analysis-report.md          ← deliverable #1
        ├── DESIGN.md                   ← from design-md
        ├── tokens.json                 ← from design-md
        ├── brand-spec.md               ← from huashu protocol
        ├── business-spec.md            ← net-new
        ├── before-preview.html         ← design-md preview
        ├── redesign/                   ← deliverable #2: runnable Next.js
        └── run-telemetry.json          ← timing, cost, decisions
```

---

## 3. Pipeline Phases (deterministic order, reuse-cacheable)

| # | Phase | Module | Inputs | Outputs | Exit-code-on-fail |
|---|---|---|---|---|---|
| 1 | **Fetch + Extract** | `adapters/design-md-adapter.cjs` | URL | `DESIGN.md`, `tokens.json`, `style-fingerprint.json`, `stack.json`, `page.md` | 4 (content-gate) / 7 (HTTP) |
| 2 | **Brand Capture** | `brand-capture.cjs` | URL, HTML, fingerprint | `brand-spec.md`, `assets/brand/{logo,hero,ui,...}` | 8 (insufficient assets) |
| 3 | **Business Info** | `business-info.cjs` | page.md, business name/category (optional) | `business-spec.md` | 9 (insufficient business signal) |
| 4 | **Direction Pick** | `direction-picker.cjs` | category, fingerprint, brand-spec | `direction.yaml` (1 of 6) | — (always succeeds; logs reasoning) |
| 5 | **Analysis Synth** | `analysis-doc.cjs` | all of the above | `analysis-report.md` (deliverable #1) | 5 (LLM exhausted) |
| 6 | **Generate Next.js** | `nextjs-generator.cjs` + `copywriter.cjs` | all + chosen direction | `redesign/` (deliverable #2) | 5 (LLM) / 10 (template error) |
| 7 | **Validate** | `validator.cjs` + `aesthetic-lint.cjs` | `redesign/`, original tokens | `validation-report.json` | 11 (validation fail — warning, not block by default) |

Each phase emits a JSON status to `run-telemetry.json` and a row to stdout. `--from-phase=N` allows resumption.

---

## 4. CLI Contract (Story 2.1 implements)

```bash
node .claude/skills/lp-forge/run.cjs \
  --url https://restauranteexemplo.com.br \
  --business-name "Restaurante Exemplo" \
  --category "restaurante" \
  --city "São Paulo" \
  --lang pt-BR \
  [--out outputs/lp-forge/{slug}/] \
  [--direction editorial|industrial|luxury|playful|brutalist|organic] \
  [--from-phase 1..7] \
  [--no-reuse] \
  [--allow-playwright] \
  [--provider claude-cli|openrouter] \
  [--model <id>]
```

`--business-name`, `--category`, `--city` are **optional but recommended**. When omitted, inferred from page content (less reliable). When provided, override inference.

`--direction` is **escape hatch** — by default `direction-picker.cjs` chooses.

---

## 5. Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| **Vendoring design-md** | Frozen copy at `vendor/design-md/` (option A) | Reproducible builds; isolated from user's local design-md edits. v2 may switch to peer-dep. |
| **Playwright fallback** | Local dep, **off by default** (option A) | Static-first is core ethos. Activates only via `--allow-playwright` when phase 1 hits exit 4. |
| **Next.js stack** | Tailwind + shadcn for 4/6 directions; **bare CSS + custom tokens** for `editorial` and `brutalist` (option C-hybrid) | Tailwind utility-class soup conflicts with editorial/brutalist aesthetics. Direction-aware templating. |
| **Deployment** | `npm install && npm run dev` MVP. **Vercel CLI integration as Story 2.6 optional sub-AC** | Don't block MVP on auth flows. Manual `vercel` from generated dir works fine. |
| **Asset hosting** | `public/brand/` in generated Next.js (option A) | Self-contained deliverable. Wave 1's Supabase Storage is per-lead and Wave-1-coupled. |
| **LLM provider** | Inherit design-md's abstraction; default `openrouter` + Haiku 4.5 for prod, `claude-cli` for dev | Same model policy as Wave 1 |
| **Cache TTL** | 24h per phase (inherits design-md) | Lets iteration on same URL be near-free |
| **Concurrency** | Sequential phases per URL; **batch mode** runs N URLs in parallel via `--batch=path/to/urls.txt` | Story 2.6 covers batch. Phase reuse + concurrency makes 50-lead batch tractable. |

---

## 6. Exit Code Map

| Code | Meaning | Recovery |
|---|---|---|
| 0 | Success — both deliverables produced + validation pass | — |
| 1 | Usage error (missing required flags) | Read help; re-run |
| 4 | Content-gate failure (bot block / SPA shell / paywall) | Retry with `--allow-playwright` |
| 5 | LLM exhausted budget or repeatedly failed | Check `inputs/prompt.txt`; raise `--max-tokens` |
| 6 | Provider misconfigured (`openrouter` without API key) | Set `OPENROUTER_API_KEY` |
| 7 | HTTP error from upstream | Retry or check URL |
| 8 | Brand assets insufficient (no logo, no hero, no UI capturable) | Provide assets manually; rerun from phase 2 |
| 9 | Business info too thin (can't form sentence about what the business sells) | Provide `--business-name` and `--category` |
| 10 | Next.js template generation error (broken JSX from LLM) | Re-run phase 6; check `inputs/generation-prompt.txt` |
| 11 | Validation/aesthetic-lint flagged issues (non-blocking by default; `--strict` makes it blocking) | Review `validation-report.json` |

---

## 7. Non-Functional Requirements

| NFR | Target |
|---|---|
| **Cold run (1 URL, no cache)** | ≤ 5 min wall-clock |
| **Warm run (phase reuse)** | ≤ 30 sec |
| **LLM cost per URL (Haiku 4.5 via OpenRouter)** | ≤ $0.15 |
| **Batch 50 URLs cold** | ≤ 45 min with 5-way concurrency |
| **Generated Next.js builds clean** | `npm run build` returns 0, zero ESLint errors |
| **Generated Next.js Lighthouse score** | ≥ 90 Performance, ≥ 95 Accessibility, ≥ 95 SEO on `npm run dev` localhost |
| **Idempotency** | Same URL + same seed = identical output (sans LLM stochasticity within tolerance) |

---

## 8. Open Questions for @architect Review

Numbered from research doc §9 — copying here for visibility:

1. **Q-1 (Vendoring)** — confirm frozen `vendor/design-md/` vs. symlink
2. **Q-2 (Playwright)** — confirm local dep vs. peer-dep expectation
3. **Q-3 (Stack hybrid)** — confirm 4-direction Tailwind + 2-direction bare CSS split
4. **Q-4 (Deploy)** — confirm Vercel CLI is optional Story 2.6 AC, not blocker
5. **Q-5 (Assets)** — confirm `public/brand/` over Supabase Storage proxy
6. **Q-6 (Wave 1 coupling)** — does `lp-forge` get invoked from Wave 1 UI in v1, or is it pure CLI? **(I recommend pure CLI for v1 — integration is its own future epic.)**
7. **Q-7 (Lang)** — confirm `--lang pt-BR` as only supported value in v1; `--lang en` deferred
8. **Q-8 (Brand fallback to AI gen)** — confirm Nano Banana Pro (or equivalent) integration for logo/hero AI generation when assets missing — **or** we hard-fail with exit 8 and require human-provided assets?

Q-6 and Q-8 are highest-risk for scope creep. Recommend defaults: pure CLI v1; hard-fail exit 8 v1 (Nano Banana integration = future epic).

---

## 9. Test Strategy (informs Story 2.6 AC)

| Layer | Tool | What |
|---|---|---|
| Unit | `node --test` | Each `lib/*.cjs` has `.test.cjs` sibling. Mock LLM at module boundary. |
| Integration | `node --test` + fixtures | Phase-by-phase against 3 anonymized fixture HTMLs (restaurant, oficina, salão) — no live HTTP |
| E2E | `node --test` + recorded HTTP | Full pipeline against 1 fixture URL using `nock` to replay recorded responses |
| Manual smoke | `npm run smoke -- <real-url>` | Operator runs on a real prospect URL; checks deliverables manually |
| Aesthetic | `lint-aesthetic.cjs` + LLM rubric | Generated Next.js passes anti-slop catalog + 5-axis self-eval |

E2E recorded fixtures live in `tests/fixtures/` — recorded once, replayed forever. Real-HTTP smoke is operator-driven, not CI.

---

## 10. Dependencies on Wave 1 (parallel squad)

**None at v1.** `lp-forge` is fully independent:
- No reads from Supabase
- No writes to Supabase
- No coupling to Wave 1 UI
- Operates on URL-as-input, outputs filesystem deliverables

**Future integration epic** (Wave 4? Wave 5?):
- Wave 1 UI adds "Analisar + Redesenhar" button → spawns background job
- Job invokes `lp-forge` CLI → uploads outputs to Supabase Storage
- Lead detail page renders `analysis-report.md` inline + links to deployed redesign

That epic is **out of scope** for this epic 002. Mention only to signal awareness.

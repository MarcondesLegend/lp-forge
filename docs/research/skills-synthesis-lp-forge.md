# Skills Synthesis — `design-md` + `frontend-design` + `huashu-design`

**Doc Owner:** @sm (River) — research artifact for Wave 2-3 epic kickoff
**Created:** 2026-05-22
**Status:** Final v1 — feeds `docs/architecture/Wave2-3-lp-forge/` and Epic 002
**Audience:** @architect (for design decisions), @pm (for PRD expansion), @dev (for implementation context)
**Purpose:** Decide which capabilities of each skill compose the `lp-forge` framework that turns a URL into (a) a complete analysis document and (b) a fully redesigned Next.js application.

---

## 0. TL;DR (60 seconds)

Three skills, three clean responsibilities, **zero functional overlap**:

| Skill | What it does | Role in `lp-forge` |
|---|---|---|
| **`design-md`** | Static URL scrape → Google-spec `DESIGN.md` + `tokens.json` + lint + drift report | **INGESTION + EXTRACTION** layer. Pulls HTML/CSS/fingerprint and emits machine-readable design tokens. |
| **`huashu-design`** | "Designer using HTML"; brand-asset protocol, Junior-Designer flow, anti-AI-slop discipline, brand-spec.md | **ANALYSIS + BRAND CAPTURE** layer. The 5-step "Core Asset Protocol" becomes our doctrine for logo/product/UI capture. |
| **`frontend-design`** | Creative direction principles for distinctive, production-grade UI code (anti-slop, bold aesthetic commitment) | **GENERATION** layer. Output of our pipeline is judged against its aesthetic principles. Used as system-prompt scaffold for the LLM that writes the Next.js code. |

**Composition formula:**
```
URL → design-md (extract)
    → huashu-design (capture brand assets + write brand-spec.md)
    → analysis-doc.md (synthesize)
    → frontend-design (generate Next.js with bold aesthetic)
    → packaged deliverable
```

The framework is the **orchestration layer** between these three — there is no existing tool that wires them together.

---

## 1. Deep Dive — `design-md`

### What it is

A self-contained Node.js skill (`run.cjs`) that takes a URL and emits a Google-spec `DESIGN.md` plus 8+ supporting artifacts via **static analysis only** (no headless browser).

### Capabilities we will reuse

| Capability | File / Phase | Why it matters for `lp-forge` |
|---|---|---|
| `axios.get(url)` + `cheerio` walk | Phase 1-2 | Pure HTML/CSS bundle without Playwright. Fast, cheap, deterministic. |
| Stack fingerprint (Next.js / Tailwind / Radix / GSAP detect) | Phase 3 → `stack.json` | Lets us **mirror** the source's actual framework when relevant, or **explicitly break** away from it. |
| Style fingerprint classifier (`shadcn-neutral` / `apple-glass` / `marketing-gradient` / …) | Phase 3 → `style-fingerprint.json` | Critical input for our **redesign direction decision** — we know what archetype the original belongs to, so we know what to subvert or polish. |
| Token extraction (hex/rgb/hsl, font-family, sizes, radii, spacing) | Phase 3 + 7 → `tokens.json` (YAML frontmatter) | Direct feed into `frontend-design`'s CSS-variable system. Saves manual design audit. |
| Provenance grading (high / medium / low confidence per token) | Confidence ladder C1 | Tells our generator which tokens to **trust verbatim** vs. **regenerate from scratch**. |
| Single-file `preview.html` with Prism + Google Fonts | Phase 8 | Becomes the "before" half of our **before/after deliverable** to the prospect. |
| Drift mode (`--compare`) | Optional Phase | We will inverse this — comparing **generated** site against extracted spec to validate "we kept the brand DNA". |
| Phase reuse (24h cache) | Default-on | Re-runs on the same lead are nearly free → enables iterative redesign without re-scraping. |
| LLM provider abstraction (`claude-cli` / `openrouter`) | `lib/llm.cjs` | We adopt the same abstraction — no direct Anthropic SDK calls in `lp-forge`. |

### Constraints to inherit

- **No Playwright / Puppeteer / Hyperbrowser.** Static-first. We add browser fallback only if content-validation gate fails (bot detection / SPA shell).
- **No direct Anthropic API.** All cognition via `claude -p` or OpenRouter pass-through.
- **Content-validation gate (R1)** must pass before LLM spend — same heuristic we will inherit.

### Limitations / gaps that `lp-forge` must fill

1. **No screenshot / OCR** — design-md is pure DOM. Logos as background-images or canvas-rendered text are invisible to it. **Solved by:** huashu-style asset hunting (Step 2 search paths).
2. **No business-information extraction** — design-md doesn't pull headline copy, pricing, CTAs, social proof. **Solved by:** a new `business-spec.md` capture phase (turndown + LLM summarization).
3. **No multi-page crawl** — only the URL given. **Solved by:** explicit homepage-only contract; if user wants multi-page later, that's a v2 epic.
4. **No image asset download** — only references in CSS. **Solved by:** brand-asset protocol from huashu (logo / hero / UI).

---

## 2. Deep Dive — `huashu-design`

### What it is

A **discipline document** (812 lines) for "designers who use HTML as their medium". It is not a runnable pipeline — it is a **doctrine** with operating principles, anti-pattern catalogs, and step-by-step protocols.

### The 7 principles we adopt verbatim

| # | Principle | How `lp-forge` enforces it |
|---|---|---|
| **#0** | **Fact-Verification Before Assumption** — any product/version/spec claim must be `WebSearch`-verified first | We `WebSearch` the business name + city before generating copy. No invented hours, no invented services. |
| **#1.a** | **Core Asset Protocol** — 5-step process for logo, product images, UI screenshots, brand-spec.md | This is **the** brand-capture phase of our pipeline. Story 2.4 implements it end-to-end. |
| **§3.4** | **5-10-2-8 quality threshold** — search 5 rounds, find 10 assets, pick 2, each ≥ 8/10 | Encoded as a scoring loop in brand-capture. Below 8 → AI-generated fallback or honest placeholder. |
| **§5.4** | **Placeholder > bad implementation** | If we can't find a logo, we ship `assets/brand/logo-PLACEHOLDER.svg` with explicit `<!-- logo not found, replace before delivery -->` comment in Next.js. Never CSS-silhouette substitute. |
| **§6** | **Anti-AI-slop catalog** — purple gradients, emoji-as-icons, generic Inter, SVG-painted faces | Becomes a `lint-aesthetic.cjs` rule set that fails the generation if the LLM output contains banned patterns. |
| **§7** | **System-first, no filler content** | Code-gen prompt explicitly forbids "stats decoration", "icon for every heading", "gradient backgrounds by default". |
| **§9.5** | **Honest placeholder > stock photo** | If business doesn't have hero imagery, we **leave hero text-only** rather than slap an Unsplash photo. |

### Why we don't reuse `huashu-design`'s code

`huashu-design`'s output is **HTML decks / animation demos / iOS prototypes** — not Next.js apps. The 24 showcase folder, the `narration_stage.jsx`, the `ios_frame.jsx`, the BGM mixing — **none of it applies** to our generated landing pages.

What we take is the **methodology**, encoded as:
- `lp-forge/data/aesthetic-lint-rules.yaml` (anti-slop catalog)
- `lp-forge/lib/brand-capture.cjs` (5-step protocol as code)
- `lp-forge/data/prompts/generation-prompt.txt` (system prompt scaffold)

### The "Design Consultant Fallback" — adapted

When the source site is **too thin** (bot block / SPA shell / one-pager Linktree) to extract a real direction, huashu prescribes the **20-philosophy library** across 5 streams. We adapt:

- We don't ask the user to pick — the **business category** (`category` from Apify scrape) picks for us.
- Mapping: `restaurante popular` → Wheaties-style **editorial appetite**; `oficina mecânica` → **industrial/utilitarian**; `salão de beleza premium` → **soft pastels / luxury**; etc.
- This mapping lives in `lp-forge/data/category-to-philosophy.yaml`.

### Asset-protocol violation = pipeline failure

This is non-negotiable. If `brand-spec.md` cannot be written with a logo (even placeholder explicitly marked), the generator **halts with exit code 8** ("brand assets insufficient — manual review required"). No silent CSS-silhouette substitution.

---

## 3. Deep Dive — `frontend-design`

### What it is

A **short, dense aesthetic manifesto** (~40 lines of doctrine). No pipeline, no code, no scripts. It is the **judge** of generated frontend output.

### The 5 axes we encode as prompt scaffold

| Axis | What `frontend-design` demands | How we encode it |
|---|---|---|
| **Typography** | Distinctive display + refined body; **NEVER** Inter/Roboto/Arial as primary | Generation prompt forbids those by name; brand-spec.md must list 2 fonts (or we pick from a curated 30-pair library) |
| **Color & Theme** | Dominant color + sharp accent; CSS variables | Direct map from `tokens.json` (design-md output) → CSS custom properties in Next.js `globals.css` |
| **Motion** | High-impact moments (page load stagger), not scattered micro-interactions | Next.js generation includes Motion-React for 1-2 hero animations only; no hover-everywhere |
| **Spatial Composition** | Asymmetry, overlap, grid-breaking, generous negative space OR controlled density | Prompt includes 3 layout-archetype options based on business category |
| **Backgrounds & Detail** | Gradient meshes, noise, geometric patterns, dramatic shadows — not solid colors | Generator picks 1 atmosphere technique aligned to chosen aesthetic direction |

### The "BOLD direction" mandate

> "Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity."

Encoded in our pipeline as: **the generation phase MUST commit to one of 6 directions** before writing code. The 6 directions are:

1. **Editorial/Magazine** — for restaurants, cafés, food artisans
2. **Industrial/Utilitarian** — for oficinas, construção, serviços técnicos
3. **Luxury/Refined** — for clínicas, salões premium, advocacia
4. **Playful/Toy-like** — for pet shops, escolas infantis, festas
5. **Brutalist/Raw** — for studios criativos, gyms, bares
6. **Organic/Natural** — for produtos naturais, yoga, terapia, estética holística

Mapping owned by `lp-forge/data/category-to-direction.yaml`. Story 2.3 (analysis) outputs the chosen direction; story 2.5 (generator) consumes it.

### "Never converge on common choices"

`frontend-design` explicitly warns against AI converging on Space Grotesk + dark mode + purple gradient. We enforce via:

- **Forbidden combinations**: dark bg + accent purple/cyan → blocked
- **Display font picker**: random-with-bias from curated 30-list; deterministic seed per URL (so same URL re-runs identical, different URLs vary)
- **Theme variance**: light/dark mode forced to alternate every other generation if categories are similar

---

## 4. Capability Matrix — Who Owns What

| Capability | `design-md` | `huashu-design` | `frontend-design` | **`lp-forge` orchestrates** |
|---|---|---|---|---|
| HTTP fetch + CSS bundle | ✅ | — | — | reuse via Node module |
| HTML → markdown copy extract | ✅ | — | — | reuse |
| Token extraction (color/type/spacing) | ✅ | — | — | reuse |
| Stack/style fingerprint | ✅ | — | — | reuse |
| `DESIGN.md` Google-spec emit | ✅ | — | — | reuse |
| `tokens.json` + `preview.html` | ✅ | — | — | reuse as "before" preview |
| Logo download (SVG / inline) | — | ✅ (Step 3.1) | — | new code, doctrine from huashu |
| Hero / product image download | — | ✅ (Step 3.2) | — | new code, doctrine from huashu |
| UI screenshot capture | — | ✅ (Step 3.3) | — | new code (Playwright-as-fallback) |
| `brand-spec.md` writer | — | ✅ (Step 5) | — | new code |
| Asset quality 8/10 scoring | — | ✅ (§3.4) | — | new heuristic + LLM rubric |
| Business info extraction (hours, services, contact) | — | — | — | **net-new** to `lp-forge` |
| Analysis doc synthesis | — | — | — | **net-new** to `lp-forge` |
| Aesthetic direction picker (6 directions) | — | — | partial | new mapping table |
| Anti-slop lint | — | ✅ (§6 catalog) | ✅ (manifesto) | encoded as `lint-aesthetic.cjs` |
| Next.js code generation | — | — | — | **net-new** to `lp-forge` |
| Output packaging (zip / repo / Vercel deploy) | — | — | — | **net-new** to `lp-forge` |

**Net-new code** lives in `.claude/skills/lp-forge/lib/`. **Reused code** is `require()`-d from `design-md` (which we'll vendor or sibling-install).

---

## 5. Gaps the Synthesis Reveals

### 5.1 Static analysis vs. SPA-shell sites
`design-md`'s static-first stance breaks on Wix / Shopify / heavy React SPAs that render content client-side. **`lp-forge` must add a Playwright fallback** triggered by content-validation gate failure — but only inside a flagged path, never default.

### 5.2 Multi-language sites
None of the three skills handle pt-BR specifically. Our prospects are 99% Brazilian businesses. **We need a `--lang pt-BR` flag** that biases:
- LLM prompts to Portuguese
- Curated font list to include Portuguese-friendly faces (no decorative-only Latin sets)
- Anti-slop catalog to include pt-BR specific clichés (the "açúcar pastel" gradients, etc. — TBD)

### 5.3 Business-information capture
Restaurants need hours, menus, location, phone. Oficinas need services list, payment methods. **No skill captures these.** Story 2.3 must include a structured business-info extraction phase (regex + LLM ladder).

### 5.4 Conversion-focused copy
`frontend-design` is silent on conversion copywriting. Our prospect's existing site copy is usually bad. We need to **rewrite** headlines and CTAs. **New: `lp-forge/lib/copywriter.cjs`** with templates per business category, output validated against the captured business-info (no invented services).

### 5.5 Validation feedback loop
None of the three skills have a "did the output preserve brand DNA?" check. **We will inverse-use `design-md --compare`** on our generated output to verify it stays in-spec with the captured brand. CI gate.

---

## 6. Architecture Implication (preview — full doc in `docs/architecture/Wave2-3-lp-forge/`)

```
                    ┌──────────────────────────────────────────────┐
                    │   .claude/skills/lp-forge/                   │
                    │                                              │
   URL ─────▶  run.cjs ──┬─ Phase 1: design-md (vendored)          │
                         │  → DESIGN.md, tokens.json, fingerprint  │
                         │                                          │
                         ├─ Phase 2: brand-capture.cjs (new)        │
                         │  → assets/brand/logo, hero, ui, …       │
                         │  → brand-spec.md                         │
                         │                                          │
                         ├─ Phase 3: business-info.cjs (new)        │
                         │  → business-spec.md                      │
                         │                                          │
                         ├─ Phase 4: analysis-doc.cjs (new)         │
                         │  → analysis-report.md (deliverable)      │
                         │                                          │
                         ├─ Phase 5: nextjs-generator.cjs (new)     │
                         │  → output/{slug}-redesign/  (Next.js)   │
                         │     ↳ uses frontend-design doctrine     │
                         │                                          │
                         └─ Phase 6: validate.cjs                  │
                            → design-md --compare on generated     │
                            → aesthetic-lint pass                  │
                                                                   │
                    └──────────────────────────────────────────────┘

   Outputs land in:  outputs/lp-forge/{slug}/
                      ├── analysis-report.md       (delivered to user/prospect)
                      ├── DESIGN.md, tokens.json   (from design-md)
                      ├── brand-spec.md            (from huashu protocol)
                      ├── business-spec.md         (net-new)
                      ├── before-preview.html      (design-md preview)
                      └── redesign/                (Next.js app — runnable)
                          ├── app/
                          ├── components/
                          ├── public/brand/
                          └── README.md
```

---

## 7. Risks Identified

| Risk | Severity | Mitigation |
|---|---|---|
| Local commercial sites often have bot detection (Cloudflare) → static fetch fails | **HIGH** | Playwright fallback gated behind explicit flag; honest exit code 4 with reason |
| Logo extraction from SVG inline can pull the wrong `<svg>` (decorative chevrons, not the actual logo) | **HIGH** | Heuristic: largest top-of-page SVG within first 800px viewport AND containing brand text — verified via LLM eyeball pass |
| LLM hallucinating business services not present on the source | **CRITICAL** (commercial fraud risk) | Hard rule: copy generator can only paraphrase content present in `business-spec.md`; any new claim flagged as `<!-- INVENTED — needs human review -->` |
| Generated Next.js looks "AI-default" despite our anti-slop rules | **MEDIUM** | Lint catalog + 6-direction commitment + LLM rubric self-evaluation step |
| Cost: 5+ LLM calls per URL × 50 leads = expensive | **MEDIUM** | Phase reuse cache (24h) + claude-cli local for dev + OpenRouter Haiku for prod = ~$0.03-0.10 per lead |
| Skill becomes too large to maintain (huashu is 812 lines doctrine, design-md is ~30 files) | **MEDIUM** | Vendor design-md as nested skill folder (don't fork); keep `lp-forge` lean — orchestration + new code only |

---

## 8. Decisions Locked (from user 2026-05-22)

| Decision | Locked Value | Rationale |
|---|---|---|
| Location | `.claude/skills/lp-forge/` | Maximally portable; copy-pasteable to other Claude Code projects; mirrors design-md's own packaging |
| Output format | Next.js app (production-grade) | Deployable to Vercel; can be handed to prospect as functioning site; not just a mockup |
| Brand capture | Strict huashu 5-step protocol | Non-negotiable for brand identity preservation; fallback to Nano Banana for missing assets |
| Granularity | Lean epic, 6 stories | Faster end-to-end validation than 12 micro-stories |

---

## 9. Open Questions for @architect

1. **Vendoring design-md**: copy `design-md/` into `lp-forge/vendor/design-md/` (forked, frozen) or symlink to user's `.claude/skills/design-md/` (live, evolving)?
2. **Playwright fallback**: install as `lp-forge`'s own dep or expect user to have it globally?
3. **Generated Next.js stack**: Tailwind + shadcn (matches Wave 1) or letting aesthetic-direction pick (some directions reject Tailwind utility-class soup)?
4. **Deployment**: do we wire Vercel CLI for one-click deploy, or stop at "run `npm install && npm run dev`"?
5. **Asset hosting**: brand assets stored in `public/brand/` of generated Next.js, or proxied via Supabase Storage (matching Wave 1 screenshot pattern)?

These are blockers for Story 2.1 (Foundation). @architect must answer before stories enter Ready.

---

## 10. References

- `.claude/skills/design-md/SKILL.md` — full canonical skill doc
- `.claude/skills/huashu-design/SKILL.md` — 812-line doctrine, key sections §0, §1.a, §3.4, §6
- `.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md` — aesthetic manifesto
- `docs/prd/MVP-prospeccao-local.md` — Wave 1 PRD (parallel work — DO NOT collide)
- `docs/stories/1.1.foundation-setup.md` — Wave 1 first story, shows house-style for story files

---

**Next step:** @architect designs the orchestration layer; @sm (this agent) drafts the 6 stories; @po validates the drafts.

# Architecture Review — `lp-forge` (Wave 2-3)

**Reviewer:** @architect (Aria)
**Date:** 2026-05-22
**Reviewed doc:** `docs/architecture/Wave2-3-lp-forge/architecture.md` (draft by @sm River)
**Companion:** `docs/research/skills-synthesis-lp-forge.md` (research by @sm River)
**Story files reviewed:** 2.1 through 2.6
**Verdict:** ✅ **APPROVED WITH MANDATORY AMENDMENTS** — see §3

---

## 1. Executive Summary

River's draft is **structurally sound** — the 3-skill synthesis is correct, the pipeline phasing is right, the exit-code map is well-thought, and the test strategy is appropriate. The decision to vendor `design-md` rather than fork it is correct.

**Approved as the architectural baseline**, subject to the **9 mandatory amendments** in §3 and the **8 Q&A answers** in §4. Once amendments are merged into `architecture.md` and stories 2.1-2.6 updated to reflect them, stories may transition Draft → Ready via @po validation.

**What River got right** (no changes needed):
- 7-phase pipeline order
- Filesystem deliverable contract (`analysis-report.md` + `redesign/`)
- Phase-reuse cache strategy (24h TTL inherited from design-md)
- Strict huashu §1.a enforcement at brand-capture phase
- 6-direction commitment for aesthetic discipline
- Test strategy (unit + integration + recorded-HTTP E2E + manual smoke)
- pt-BR lock for v1
- Wave 1 decoupling (pure CLI v1)

**What needs amendment** — high-level:
- Library import over child_process where possible
- Add Playwright as `optionalDependencies` (not local dep)
- Single Tailwind stack across all 6 directions; shadcn split only
- Three-tier logo fallback (typography-based logotype generation) instead of hard-fail
- Add observability layer (structured JSON logs)
- Add security layer (prompt-injection sanitization, MIME validation)
- Add license attribution + audit watermark
- Tighten idempotency NFR with explicit temperature/seed semantics
- Add concurrent-safety guards in batch mode

---

## 2. What I Audited

| Source | Audited | Finding |
|---|---|---|
| `architecture.md` (River's draft) | full read | Sound baseline; needs amendments listed in §3 |
| `skills-synthesis-lp-forge.md` (River's research) | full read | High-quality analysis; honored in all decisions below |
| Story files 2.1 → 2.6 | full read | Acceptance criteria reasonable; need updates per §3 amendments |
| `.claude/skills/design-md/package.json` | full | License MIT (vendoring legal); deps minimal (axios, cheerio, js-yaml, turndown, yaml); `bin` field exists (CLI-invokable) |
| `.claude/skills/design-md/lib/design-md.cjs` | sampled | Exports `classifySource`, `parseFrontmatter` — confirms `lib/` modules are `require()`-able |
| `.claude/skills/design-md/run.cjs` | sampled | Pipeline lives in `run.cjs` (not in `lib/`) — confirms `child_process spawn` is the path of least resistance for v1 |
| `.claude/skills/design-md/lib/` directory | full listing | 22 files, well-modularized; `lib/llm.cjs`, `lib/extractors.cjs`, `lib/fetch.cjs` are good portable candidates |
| Wave 1 PRD (`docs/prd/MVP-prospeccao-local.md`) | sampled | Confirmed: Wave 2-3 explicitly listed as OUT of MVP scope — zero collision risk with parallel squad |

---

## 3. Mandatory Amendments (9)

These are non-negotiable for production-quality. River's draft will be edited inline to absorb them; this section is the audit trail.

### Amendment A-1 — Library Import for design-md utilities (revises Q-1)

**Original (§5):** "Frozen copy at `vendor/design-md/`."
**Amended:** Frozen vendor copy is correct, **but** we additionally expose specific `lib/` modules via `require()` for the modules we share (slugify, LLM abstraction). The full pipeline is still invoked via `child_process spawn vendor/design-md/run.cjs` because the pipeline logic lives in `run.cjs`, not in an exported library function.

**Concretely in lp-forge/lib/adapters/design-md-adapter.cjs:**

```js
const { spawn } = require('child_process');
const path = require('path');
const designMdRoot = path.join(__dirname, '..', '..', 'vendor', 'design-md');

// Reuse what's already library-exportable:
const { slugifyUrl } = require(path.join(designMdRoot, 'lib', 'utils.cjs'));
const { invokeLlm } = require(path.join(designMdRoot, 'lib', 'llm.cjs'));

// Spawn the full pipeline (until upstream exposes runPipeline()):
async function runFullExtraction(ctx) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [
      path.join(designMdRoot, 'run.cjs'),
      '--url', ctx.url,
      '--out', ctx.outDir,
      '--provider', ctx.provider,
      // …
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    // … exit-code mapping, stdout streaming
  });
}
```

**Story impact:** Story 2.2 AC-3 updated to clarify hybrid model. No new story needed.

**Future epic note:** propose upstream PR to design-md exposing `runPipeline(opts)` as a library function. Removes child_process overhead. Not blocking.

---

### Amendment A-2 — Playwright as optionalDependencies (revises Q-2)

**Original (§5):** "Local dep, off by default."
**Amended:** `playwright` is an **`optionalDependencies` entry** in `lp-forge/package.json`. npm continues install even if Playwright's binary download fails. The fallback module checks availability via `try { require.resolve('playwright') } catch { /* not available */ }` at runtime.

**Rationale:**
- Playwright + Chromium = ~300MB. Forcing it on every install of a skill marketed as portable is hostile.
- Operators who never hit content-gate failures (good static sites) shouldn't pay the cost.
- Operators who need it: `cd .claude/skills/lp-forge && npm install playwright` is one-time setup.

**lp-forge/package.json:**
```json
"optionalDependencies": {
  "playwright": "^1.48.0"
},
"scripts": {
  "install-playwright": "npm install playwright --save-optional && npx playwright install chromium"
}
```

**Behavior when `--allow-playwright` requested but Playwright not installed:**
- Exit code **12** (NEW — see Amendment A-7) with message: `"Playwright fallback requested but not installed. Run: cd .claude/skills/lp-forge && npm run install-playwright"`

**Story impact:** Story 2.2 AC-5 + AC-6 updated. Story 2.1 AC-3 `package.json` deps amended.

---

### Amendment A-3 — Single Tailwind stack; shadcn-only split (revises Q-3)

**Original (§5):** "Tailwind+shadcn for 4 directions; bare CSS for editorial and brutalist."
**Amended:** All 6 directions use **Tailwind CSS**. The split is on **shadcn primitives**:

| Direction | Tailwind | shadcn |
|---|---|---|
| Industrial | ✅ | ✅ (Card, Button, Input) |
| Luxury | ✅ | ✅ (full primitives) |
| Playful | ✅ | ✅ (Card, Button, Badge) |
| Organic | ✅ | ✅ (Card, Button) |
| **Editorial** | ✅ | ❌ (custom from scratch) |
| **Brutalist** | ✅ | ❌ (custom from scratch) |

**Rationale:**
- Tailwind is a utility layer, philosophically neutral; it doesn't impose aesthetic. `@layer` directives and arbitrary values handle editorial/brutalist fine.
- shadcn's components carry an aesthetic (rounded corners, subtle shadows, "modern SaaS" defaults). Stripping it gives editorial/brutalist their authenticity.
- Single stack = single mental model for `@dev`, single dependency graph, faster onboarding, easier maintenance.

**Concrete differences for editorial/brutalist:**
- Custom Tailwind config with extended theme (e.g., `editorial` has 12-col asymmetric grid, drop-cap utilities; `brutalist` has harsh-border utility, no shadow utilities)
- Bespoke `components/` written without shadcn — pure Tailwind + minimal CSS
- May use `@layer base` for typography defaults that override Tailwind's preflight

**Story impact:** Story 2.5 AC-2 updated. Direction overlay template structure simplified.

---

### Amendment A-4 — Three-tier logo fallback (revises Q-8)

**Original (§5 / Q-8):** "Hard-fail exit 8 if no logo found."
**Amended:** Three-tier fallback ladder:

| Tier | Strategy | Outcome |
|---|---|---|
| 1 | huashu §1.a Steps 1-3 (independent file → inline SVG → social avatar) | Real logo extracted |
| 2 | **Typography-based logotype generation** (NEW) — use `<businessName>` text styled with brand display font + brand primary color, rendered as SVG | Brand "wordmark" |
| 3 | Hard-fail exit 8 | Manual asset required |

**Tier 2 implementation** (`lib/logotype-generator.cjs`):
- Input: `businessName` from `business-spec.md` + display font from `tokens.json` + primary color
- Output: `assets/brand/logo.svg` containing `<svg><text>BusinessName</text></svg>` with proper font embedding (via `@font-face` data: URL or `xlink:href`)
- Annotation: file includes comment `<!-- generated-logotype: typography-based fallback, no source logo found -->`
- This is what Stripe (pre-2018), Linear, Vercel, Anthropic all do — a wordmark IS a logo

**Rationale:**
- Local SMBs in Brazil (our prospect base from Wave 1) frequently have NO downloadable logo. Hard-failing on them eliminates the most common use case.
- Typography wordmarks are an established design tradition, not a degradation.
- Cost: ~50 lines of code, zero external API spend, zero risk of AI hallucination.
- Future v2 may add Nano Banana for ICON generation when logotype isn't enough — but that's an epic, not a blocker.

**Hero imagery** stays hard-fail-tolerant: if no hero found, generated site uses text-only hero (per huashu §9.5). Not a hard-fail at exit 8.

**Story impact:** Story 2.3 AC-1 updated. New file `lib/logotype-generator.cjs` added to Story 2.3 file list.

---

### Amendment A-5 — Observability layer (NEW — gap not in original)

**Gap:** SM's draft only emits stdout + `run-telemetry.json`. For batch mode (50 URLs) this is unworkable.

**Required:**
1. **Structured JSON logs** at `outputs/lp-forge/_logs/{YYYY-MM-DD}.jsonl` (one event per line)
2. Each event: `{ timestamp, runId, slug, phase, level: info|warn|error, message, data }`
3. **Verbosity flag** `--verbose | --quiet | --silent` controls stdout; JSON log is always written
4. **Batch summary** writes `outputs/lp-forge/_batch-<runId>.json` with per-URL outcome (already in Story 2.6 AC-6 — confirmed)
5. **Error events MUST include** the phase, exit code, and a remediation hint string

**New module:** `lib/logger.cjs` with `logger.info(event, data)`, `logger.warn`, `logger.error`. All modules use it instead of `console.log`.

**Story impact:** Story 2.1 adds AC-16 (logger module bootstrap). All other stories updated to use `logger` not `console`.

---

### Amendment A-6 — Security layer (NEW — gap not in original)

**Gap:** SM's draft doesn't address prompt injection or image-asset security.

**Required minimum:**

#### A-6.1 Prompt injection sanitization
Before sending source-site content to LLM, scan for known attack patterns:
- `(?i)ignore (previous|all) instructions`
- `(?i)you are now`
- `(?i)system prompt`
- `(?i)<\|im_(start|end)\|>`
- Markdown injection in alt-text, comments, schema-org JSON-LD

If matched: tag the content with `[SANITIZED]` marker; log warning; **do not block** (some legitimate copy may have these tokens — log and let LLM see sanitized version).

**Module:** `lib/sanitizer.cjs` with `sanitizeForLlm(text)` → returns sanitized text + list of removed/flagged patterns.

#### A-6.2 Image MIME validation
For every downloaded image, after download:
1. Verify Content-Type header matches file extension
2. For SVG: parse and **reject if contains `<script>`, `<foreignObject>`, `onload=`, `href=javascript:`**
3. For PNG/JPG: check magic bytes (first 8 bytes) match the declared type
4. Reject and log if mismatch; treat as "asset not found"

**Module:** `lib/asset-validator.cjs` invoked from `brand-capture.cjs`.

#### A-6.3 Generated site XSS guard
- All copy from `business-spec.md` injected into JSX MUST use React's default escaping (i.e., `{text}` not `dangerouslySetInnerHTML`)
- Test in Story 2.5: integration test feeds `<script>alert(1)</script>` as a "service name" and asserts it renders as text, not executes

**Story impact:** Story 2.3 adds AC-14 (sanitization + MIME validation). Story 2.5 adds AC-18 (XSS guard test).

---

### Amendment A-7 — Exit code reservations (extends §6)

Two new exit codes:

| Code | Meaning | Recovery |
|---|---|---|
| 12 | Playwright fallback requested but Playwright not installed | Run `npm run install-playwright` in skill dir |
| 13 | Sanitization triggered hard-block (rare — only if content is overwhelmingly hostile) | Manual review of source URL |

**Story impact:** Story 2.1 AC-6 exit-code constants module updated.

---

### Amendment A-8 — Idempotency NFR clarified (revises §7)

**Original:** "Same URL + same seed = identical output (sans LLM stochasticity within tolerance)."
**Amended:**

Idempotency contract has **two tiers**:

| Tier | Guarantee | Mechanism |
|---|---|---|
| **Structural** | Identical file tree, identical CSS variables, identical assets, identical metadata across runs | Cache + seeded picker functions |
| **Content** | LLM-generated copy may vary across runs within semantic tolerance | LLM `temperature: 0` mandatory for production; `--temperature 0` is the default in `lib/llm.cjs` for `lp-forge` |

**Hard requirement:** `temperature` is locked to `0` for all generation calls. `--temperature N` flag is **dev-only** (rejected with exit 1 in non-dev mode).

**Verification (Story 2.6):** Re-run same URL 3x cold; assert structural identity (`diff -r` of all non-LLM outputs). Content drift between runs allowed but logged.

**Story impact:** Story 2.1 AC-7 LLM module updated with temperature constraint.

---

### Amendment A-9 — Generated site audit watermark (NEW — gap not in original)

**Required:** Every generated `redesign/` site MUST embed a generation audit comment in HTML head:

```html
<!--
  Generated by lp-forge v0.1.0
  Source URL: https://example.com.br
  Generated at: 2026-05-22T15:30:00-03:00
  Brand assets: extracted | logotype-fallback | manual
  Direction: editorial
  Run ID: <uuid>
-->
```

**Rationale:**
- Operator accountability when delivering to prospect
- Audit trail when something looks wrong post-delivery
- License compliance (we attribute our work)

**Implementation:** `nextjs-generator.cjs` writes `app/_audit-watermark.tsx` component that injects the comment via Next.js `<head>` API.

**Story impact:** Story 2.5 AC-15 (generated README) extended; add new AC for watermark.

---

## 4. Open Questions — Definitive Answers

| Q | Original SM Recommendation | Aria's Decision | Rationale |
|---|---|---|---|
| **Q-1 Vendoring** | Frozen vendor copy | **APPROVED — with library-import hybrid** (Amendment A-1) | Vendor is correct base; library import for shared utils is a free optimization |
| **Q-2 Playwright** | Local dep, off by default | **AMENDED — `optionalDependencies`** (Amendment A-2) | Avoids forcing 300MB on every install |
| **Q-3 Stack split** | Tailwind+shadcn vs bare CSS (4/2) | **AMENDED — Tailwind everywhere; shadcn split only** (Amendment A-3) | Single stack, mental simplicity; aesthetic split is on components not utility framework |
| **Q-4 Vercel CLI** | Optional Story 2.6 sub-AC | **APPROVED** | Document `npx vercel`; don't automate the interactive auth |
| **Q-5 Asset hosting** | `public/brand/` in generated Next.js | **APPROVED** | Self-contained = portable = deployable |
| **Q-6 Wave 1 coupling** | Pure CLI v1; integration is future epic | **APPROVED** | Parallel squads, parallel epics. Integration epic comes after Wave 1 v1 + lp-forge v1 both ship |
| **Q-7 Language** | pt-BR only v1 | **APPROVED — with structural i18n readiness** | Structure prompts under `data/prompts/pt-BR/`; v2 just adds `en/` folder |
| **Q-8 AI fallback** | Hard-fail exit 8 | **AMENDED — three-tier ladder with typography fallback** (Amendment A-4) | Most common SMB failure case (no downloadable logo) gets graceful degradation, not exit code |

---

## 5. Additional Gaps Flagged (Beyond the 9 Amendments)

These are noted for tracking — not blocking v0.1 but should be addressed in v0.2 / future epics:

| Gap | Severity | Owner | Tracking |
|---|---|---|---|
| **G-1** No source-site screenshot capture (the "before" preview is just design-md's CSS sample, not a real screenshot) | MEDIUM | future Story 2.7 or v0.2 | Requires Playwright in always-on mode just for screenshots — separate from content-gate fallback |
| **G-2** No SEO metadata generation in `redesign/` (Lighthouse SEO ≥95 NFR has no path) | MEDIUM | Add to Story 2.5 AC list | `business-spec.md` → `app/layout.tsx` metadata API |
| **G-3** Cache invalidation key doesn't include data-file hashes (e.g., `category-to-direction.yaml` updates don't invalidate) | LOW | Add cache key hash to data files in Story 2.2 | Hash data dir mtime into cache key |
| **G-4** No prospect-copyright disclaimer in generated site README (operator assumes copyright of source assets) | MEDIUM | Story 2.5 generated README addition | Add to AC-15 |
| **G-5** No "decline list" — operator can't say "never use this asset/color from source" mid-pipeline | LOW | v0.2 feature | Add `--decline assets/brand/hero-1.png` flag |
| **G-6** Concurrent slug collision in batch (two URLs map to same slug if they differ only in fragments/query) | LOW | Add slug-uniqueness check at batch start | Story 2.6 AC-5 amend |
| **G-7** No metrics on LLM cost per phase per URL (telemetry has totals only) | LOW | Story 2.1 AC-5 telemetry already covers; just lock per-phase cost field | — |
| **G-8** Vendored design-md drift detection | LOW | Story 2.6 CI script | Compare `vendor/design-md/VENDORED.md` SHA against user's local design-md SHA; warn if behind |

---

## 6. Story-by-Story Impact Summary

| Story | Amendments Affecting It | Net Effect |
|---|---|---|
| **2.1 Foundation** | A-1 (lib import), A-2 (optionalDeps), A-5 (logger), A-7 (exit codes), A-8 (temperature) | +1 AC (logger), package.json deps amended, exit-codes module gets 2 new constants |
| **2.2 design-md Adapter** | A-1 (hybrid pattern doc), A-2 (Playwright handling), G-3 (cache key hash) | AC-3 + AC-5 + AC-6 reworded |
| **2.3 Brand + Business** | A-4 (logotype fallback), A-6.1 + A-6.2 (sanitization + MIME) | +1 AC (sanitization), +1 AC (MIME), AC-1 logo extraction gets Tier-2 step |
| **2.4 Analysis Report** | No structural changes — sound as drafted | — |
| **2.5 Next.js Generator** | A-3 (Tailwind everywhere), A-6.3 (XSS guard), A-9 (audit watermark), G-2 (SEO metadata), G-4 (copyright disclaimer) | AC-2 simplified (one stack); +3 ACs (XSS, watermark, SEO) |
| **2.6 E2E + Batch** | A-8 (idempotency verification test), G-6 (slug collision check), G-8 (drift detection CI) | +2 ACs |

---

## 7. Approval & Handoff

**Verdict:** ✅ **APPROVED WITH AMENDMENTS**

**Conditions for stories to enter Ready (via @po):**
1. ✅ This review document is filed
2. ⏭️ `architecture.md` is amended in place to incorporate Amendments A-1 through A-9
3. ⏭️ Stories 2.1, 2.2, 2.3, 2.5, 2.6 ACs updated per §6
4. ⏭️ @po runs `*validate-story-draft` on each amended story (10-point checklist)

**Recommended next handoff sequence:**

```
1. ✅ @architect (me, now)  → review filed
2. ⏭️ @architect or @sm     → amend architecture.md inline with A-1..A-9
3. ⏭️ @sm                   → amend story files 2.1, 2.2, 2.3, 2.5, 2.6 with revised ACs
4. ⏭️ @po                   → *validate-story-draft on each story (10-point check)
5. ⏭️ @dev                  → *develop-story 2.1
6. ⏭️ @qa                   → *qa-gate
7. 🔁 Stories 2.2 → 2.6     → same loop
```

**Recommendation:** Since the architecture amendments touch 5 of 6 stories with mostly mechanical AC edits, the cleanest path is for @sm (River) to re-enter and apply all amendments in one pass. I can do it directly as @architect if the operator prefers — but @sm owns story files per the agent authority matrix.

---

## 8. Architectural Principles Reaffirmed

For posterity, restating the principles this design honors:

- **Holistic system thinking:** lp-forge is one node in a 4-wave pipeline; it stays decoupled from Wave 1 while preserving integration paths for Wave 4+
- **User experience drives architecture:** the operator's workflow (URL → real prospect conversation) drives every decision — including typography-fallback logotype
- **Pragmatic technology selection:** boring tech where possible (axios, cheerio, Tailwind, Next.js) — exciting only where necessary (LLM cognition layer)
- **Progressive complexity:** v0.1 covers single-URL CLI; batch is bolted on cleanly; Wave 1 integration is a future epic with no v0.1 coupling
- **Developer experience as first-class concern:** single Tailwind stack, single test framework (`node --test`), single config language (YAML), library-import shortcut for design-md utils
- **Security at every layer:** prompt injection sanitization, MIME validation, XSS guard, audit watermark, license attribution
- **Cost-conscious engineering:** Haiku 4.5 default, 24h cache, temperature 0, optional Playwright
- **Living architecture:** every amendment carries forward a hook for future evolution (upstream design-md PR, Wave 1 integration, Nano Banana v2)

---

— Aria, arquitetando o futuro 🏗️

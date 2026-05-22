# data/prompts/pt-BR/

LLM prompt templates in Portuguese (Brazilian).

## Structure (i18n-ready per Aria Q-7)

- `data/prompts/pt-BR/` — v0.1 (this folder)
- `data/prompts/en/` — v0.2 (planned, not yet present)

`lib/prompt-loader.cjs` exposes `loadPrompt(name, lang)` that resolves the path with `pt-BR` fallback.

## Expected files (populated by Stories 2.3-2.5)

| File | Used by | Story |
|---|---|---|
| `logo-verify.txt` | brand-capture.cjs LLM eyeball verification | 2.3 |
| `image-score.txt` | brand-capture.cjs 5-10-2-8 scoring | 2.3 |
| `logotype-style.txt` | logotype-generator.cjs (Aria A-4 Tier-2) | 2.3 |
| `business-info-extract.txt` | business-info.cjs structured extraction | 2.3 |
| `section-summary.txt` | analysis-doc.cjs executive summary section | 2.4 |
| `section-design-diagnosis.txt` | analysis-doc.cjs design scoring | 2.4 |
| `section-ux-diagnosis.txt` | analysis-doc.cjs UX scoring | 2.4 |
| `section-content-diagnosis.txt` | analysis-doc.cjs content scoring | 2.4 |
| `section-opportunities.txt` | analysis-doc.cjs top-5 opportunities | 2.4 |
| `direction-pick.txt` | direction-picker.cjs reasoning | 2.4 |
| `generate-hero.txt` | nextjs-generator.cjs hero section copy | 2.5 |
| `generate-services.txt` | nextjs-generator.cjs services section | 2.5 |
| `generate-about.txt` | nextjs-generator.cjs about section | 2.5 |
| `seo-metadata.txt` | nextjs-generator.cjs SEO meta API | 2.5 |
| `direction-self-rubric.txt` | nextjs-generator.cjs aesthetic self-eval | 2.5 |
| `build-error-repair.txt` | nextjs-generator.cjs JSX repair on build failure | 2.5 |

## Template variable convention

Use `{{varName}}` Mustache-like placeholders. `lib/prompt-loader.renderPrompt(template, ctx)` interpolates from a context object.

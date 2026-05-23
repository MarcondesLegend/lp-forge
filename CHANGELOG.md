# Changelog

All notable changes to `lp-forge` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

---

## [0.1.2] — 2026-05-23

### Highlights

- ✅ **Funciona com qualquer modelo OpenAI agora** (gpt-4o-mini, gpt-4o, gpt-4.1) — patch no prompt vendored
- ✅ **Logos REAIS via Playwright HTML parse** — strategy D adicionada à brand-capture
- ✅ **Cor primária inteligente** (saturação × frequência) — não pega mais cinza neutro como brand
- ✅ **`--primary-color` e `--accent-color` override** — escape hatch quando synthesizer erra
- ✅ **Hero específico por negócio** — prompt do copywriter com few-shot examples por categoria
- ✅ Validado em **3 casos reais** (clínica × 2, salão de beleza) com heroes únicos

### Added

- `--primary-color #hex` e `--accent-color #hex` flags (CLI override Tier 0)
- Strategy D em `brand-capture.cjs`: parse de `inputs/rendered.html` (Playwright output) atrás de `<img>` com `alt`/`class` contendo "logo" → baixa o binário real
- Função `saturationOf(hex)` e `pickAccent()` em `design-md-adapter.cjs` para escolha de cor brand
- Lista de **forbidden heroes** no prompt do copywriter ("Transforme seu sorriso", "Excelência em cada detalhe", "Bem-vindo a [nome]")
- Few-shot examples por categoria no prompt do copywriter (clínica, restaurante, oficina, salão, café, médica)
- Tokens.json re-synthesis quando design-md sucede mas retorna `__parseError` (LLM output sem YAML frontmatter)

### Changed

- `vendor/design-md/data/url-extract-prompt.txt`: instrução final reescrita para não referenciar "Write tool" — funciona em todos providers (Claude, OpenAI, OpenRouter)
- Sintetizador de cores agora **scored** por `saturação × 2 + log(usage_count)`, não só por frequência
- `extractPalette` em `nextjs-generator.cjs` aceita `ctx.primaryColor`/`accentColor` como Tier 0 override
- Soft-success do design-md trigga `synthesizeTokensFromStatic` mesmo em exit 0 quando tokens.json tem parseError

### Fixed

- gpt-4o e gpt-4.1 retornavam "I'll write the file" em vez de gerar DESIGN.md (prompt fix)
- Sintetizador às vezes escolhia cor WhatsApp (`#25d366`) ou Bootstrap (`#69727d`) como primary
- Heroes idênticos entre clientes da mesma categoria ("Transforme seu sorriso com excelência" em todas as clínicas)

### Tests

- 103/104 passing (1 skipped — Playwright optional)

### Validated end-to-end

| Site | Categoria | URL | Local |
|---|---|---|---|
| Orto Implant | Clínica odontológica | https://ortoimplant.com.br | http://localhost:5000 |
| Clínica Mariana Lourenço | Clínica odontológica | https://clinicamarianalourenco.com.br | http://localhost:5001 |
| Salão Piazza | Salão de beleza | https://salaopiazza.com.br | http://localhost:5002 |

Heroes gerados:
- Orto: "Implantes de qualidade em Nova Serrana"
- Mariana: "Sorriso perfeito com tecnologia de ponta em São Paulo"
- Piazza: "Beleza refinada em São Paulo, há 24 anos"

---

## [0.1.1] — 2026-05-22

### Added

- **Phase 5 (`analysis-doc.cjs`)** agora é LLM-driven com prompt rico de 200 linhas (`data/prompts/pt-BR/analysis-synth.txt`). Saída: 1200-1800 palavras de análise consultiva profissional. Fallback heurístico se LLM indisponível.
- **Phase 6 copywriter** agora é LLM-driven (`data/prompts/pt-BR/copywriter.txt`) — gera hero/sub/CTA/services/about/contact intro grounded em business-spec. Zero invenção; fallback templates.
- **Playwright fallback completo** em `lib/playwright-fallback.cjs` — auto-aciona quando `page.md` < 200 chars (SPA detection). Renderiza, captura screenshot, converte body em markdown.
- **Soft-success** no `design-md-adapter.cjs` — quando LLM falha mas estática OK, continua o pipeline com tokens sintetizados a partir de `inputs/tokens-detected.json`.
- **Synthesizer de tokens** com blocklist de cores externas (WhatsApp `#25d366`, Facebook `#1877f2`, etc.).
- `MANUAL.md` completo (~5K palavras) com troubleshooting + comandos práticos.

### Changed

- `max_completion_tokens` default no design-md OpenAI provider: 8192 → 16384 (env override via `DESIGN_MD_MAX_TOKENS`).
- Logger verbosity gating (F-1 QA finding fix): `normal` agora imprime INFO events.

### Fixed

- Hero headline com `\n` literal não rendia em 2 linhas → agora usa `<span class="block">` via `dangerouslySetInnerHTML`.
- Logger não imprimia phase events em modo `normal` (default).

### Tests

- 103/104 passing.

---

## [0.1.0] — 2026-05-22

### Initial release — Wave 2-3 do MaquinaLP (epic-002-lp-forge)

Composição de 3 skills source em um pipeline URL → análise + redesign Next.js:
- **`design-md`** (vendored, frozen, MIT — Alan Nicolas) — extração estática HTML/CSS
- **`huashu-design`** — protocolo §1.a de captura de marca + anti-AI-slop
- **`frontend-design`** — manifesto estético com 6 direções + lint rules

### Pipeline 7 fases

1. Fetch + Extract (design-md)
2. Brand Capture (huashu §1.a, 3-tier logo fallback)
3. Business Info Extraction
4. Direction Pick (30+ BR categorias → 6 direções)
5. Analysis Synth (deliverable #1)
6. Next.js Generate (deliverable #2)
7. Validate (drift + lint)

### Amendments aplicados (Aria review)

A-1 hybrid spawn+require · A-2 Playwright optionalDeps · A-3 Tailwind everywhere
A-4 three-tier logo fallback · A-5 JSON logger · A-6 sanitizer/MIME/XSS
A-7 exit codes 12/13 · A-8 temperature:0 production lock · A-9 audit watermark
Q-7 i18n-ready · G-2 SEO metadata · G-3 cache hash · G-4 copyright disclaimer
G-6 slug uniqueness · G-8 vendor drift detection

### Authors

AIOX squad: River (sm) · Aria (architect) · Pax (po) · Dex (dev) · Quinn (qa)
Source skills: Alan Nicolas (design-md, MIT) · 花叔 (huashu-design) · Claude Plugins (frontend-design)

License: MIT

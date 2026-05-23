# lp-forge

> **URL → análise consultiva + redesign Next.js automatizado.**
> Um skill do Claude Code que recebe um site qualquer e devolve (a) um documento de análise profissional e (b) um Next.js 15 redesenhado preservando a identidade visual do site original.

[![CI](https://github.com/MarcondesLegend/lp-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/MarcondesLegend/lp-forge/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-v0.1.2-blue)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-103%2F104%20pass-brightgreen)](#)
[![OpenAI](https://img.shields.io/badge/openai-gpt--4o--mini-purple)](#)

---

## O problema

Você prospecta comércios locais que têm site ruim. A venda pelo telefone é fraca: *"olha, seu site tá desatualizado, posso refazer"* — o prospect ouve isso 10 vezes por semana. O que converte é mostrar o site **já refeito**, com a logo dele, com as cores dele, com o telefone dele.

Mas redesenhar manualmente um site por prospect leva 4-8 horas. Não escala.

## A solução

`lp-forge` automatiza esse pitch. Você roda um comando e em ~60 segundos tem:

1. **Análise consultiva** — 1200-1800 palavras em PT-BR, diagnóstico profissional do site atual (paleta, tipografia, UX, conversão, conteúdo) com 5 oportunidades concretas.
2. **Site Next.js redesenhado** — aplicação completa, com paleta + fontes + logo do site original preservados, mas direção estética dramaticamente melhor. Roda local OU deploy em Vercel.

**Custo:** ~$0.01 por URL (OpenAI gpt-4o-mini).

## Demo rápido

```bash
node .claude/skills/lp-forge/run.cjs \
  --url https://clinicaexemplo.com.br/ \
  --business-name "Clínica Exemplo" \
  --category "clínica" \
  --city "São Paulo" \
  --provider openai \
  --model gpt-4o-mini \
  --allow-playwright
```

Output:

```
outputs/lp-forge/com-clinicaexemplo/
├── analysis-report.md       ← deliverable #1 (manda pro prospect)
├── redesign/                ← deliverable #2 (cd redesign && npm install && npm run dev)
├── brand-spec.md
├── business-spec.md
├── tokens.json
├── direction.yaml
└── validation-report.json
```

## Como funciona — 7 fases

```
URL
 │
 ▼
 1. FETCH + EXTRACT       → design-md (vendored, MIT) extrai paleta, fontes, arquétipo
                            do CSS. LLM gera DESIGN.md.
 ▼
 2. BRAND CAPTURE         → huashu §1.a 5-step. Logo: 3-tier fallback (real → tipográfico → fail).
 ▼
 3. BUSINESS INFO         → Extrai telefone, WhatsApp, email, endereço, horários, serviços.
                            ZERO INVENÇÃO. Sanitizer contra prompt injection.
 ▼
 4. DIRECTION PICK        → Categoria do negócio → 1 de 6 direções estéticas:
                            editorial, industrial, luxury, playful, brutalist, organic.
 ▼
 5. ANALYSIS SYNTH        → LLM gera análise consultiva de 1400 palavras com prompt rico.
                            Grounded em todos os dados capturados.
 ▼
 6. NEXT.JS GENERATE      → Scaffolda Next.js 15 + Tailwind + 6 direction overlays.
                            Copywriter LLM-driven (hero/services/about) grounded em business-spec.
                            Anti-slop lint + audit watermark + SEO metadata.
 ▼
 7. VALIDATE              → Drift check (brand DNA preservada?) + aesthetic lint.
```

Cada fase pode ser pulada/re-executada com `--from-phase N`.

## Composição: 3 skills consolidadas

`lp-forge` é a junção de três skills do Claude Code:

| Skill | Origem | Papel no lp-forge |
|---|---|---|
| **[design-md](https://github.com/oalanicolas)** | Alan Nicolas (MIT) | **Vendored.** Faz a extração estática + LLM-generated DESIGN.md |
| **huashu-design** | 花叔 | **Doutrina aplicada.** Protocolo §1.a 5-step de captura de marca + anti-AI-slop catálogo |
| **frontend-design** | Claude Plugins | **Manifesto aplicado.** 6 direções estéticas + lista de fontes proibidas |

## Stack

- **Node.js 18+** (testado em 22.18)
- **Next.js 15** + TypeScript + Tailwind 3 (gerado)
- **OpenAI API** (gpt-4o-mini default, allow-list: gpt-4o, gpt-4.1, o3-mini)
- **Playwright** (opcional, para SPAs) via `optionalDependencies`
- **design-md vendored** (axios, cheerio, turndown)

Suporta provider routing:
- `--provider openai` (default quando `OPENAI_API_KEY` setada)
- `--provider openrouter` (default quando `OPENROUTER_API_KEY`)
- `--provider claude-cli` (local, se `claude` CLI instalado)

## Instalação

### Pré-requisitos
- Node.js ≥ 18
- Conta OpenAI com créditos (~$0.01 por URL processada)
- (Opcional) Playwright para sites SPA: `cd .claude/skills/lp-forge && npm run install-playwright`

### Setup

```bash
# 1. Clone
git clone https://github.com/MarcondesLegend/lp-forge.git
cd lp-forge

# 2. Configure a OpenAI key
echo "OPENAI_API_KEY=sk-..." > .env.local

# 3. Instale dependências
cd .claude/skills/lp-forge
npm install

# 4. Teste
npm test
# Esperado: 103/104 PASS (1 skipped = Playwright opcional)
```

### Rodando o primeiro caso

```bash
cd /caminho/onde/clonou
node .claude/skills/lp-forge/run.cjs \
  --url https://exemplo.com.br/ \
  --business-name "Nome" \
  --category "categoria" \
  --city "Cidade" \
  --provider openai \
  --allow-playwright
```

## Casos validados (já testados)

| Site | Categoria | Stack | Hero gerado | Resultado |
|---|---|---|---|---|
| `ortoimplant.com.br` | Clínica odontológica | Tailwind v4 SPA | "Implantes de qualidade em Nova Serrana" | ✅ Playwright + logo real .webp + análise 1379 palavras |
| `clinicamarianalourenco.com.br` | Clínica | WordPress | "Sorriso perfeito com tecnologia de ponta em São Paulo" | ✅ Soft-success + logo Tier 1 + análise 1410 palavras |
| `salaopiazza.com.br` | Salão de beleza | — | "Beleza refinada em São Paulo, há 24 anos" | ✅ Direction luxury + análise 1391 palavras |

## Flags principais

| Flag | Descrição |
|---|---|
| `--url` | URL público do site (obrigatório) |
| `--business-name "..."` | **Sempre forneça** — inferência da página é frágil |
| `--category` | Categoria (clínica, restaurante, oficina, etc.) — direciona escolha estética |
| `--city` | Cidade — aparece na copy e análise |
| `--direction` | Forçar uma direção: `editorial`, `industrial`, `luxury`, `playful`, `brutalist`, `organic` |
| `--provider` | `openai` (default), `openrouter`, `claude-cli` |
| `--model` | `gpt-4o-mini` (default), `gpt-4o`, `gpt-4.1`, `o3-mini` |
| `--allow-playwright` | Habilita render via browser para SPAs / sites com bot-block |
| `--primary-color #hex` | **Força cor primária** (6-dígitos hex). Override quando synthesizer escolhe errado |
| `--accent-color #hex` | Força cor accent |
| `--from-phase N` | Pula fases anteriores (debug / re-rodar parte do pipeline) |
| `--batch arquivo.txt` | Processa N URLs em paralelo |
| `--verbose` / `--quiet` / `--silent` | Controla verbosidade |

Lista completa: rode `node .claude/skills/lp-forge/run.cjs --help` ou veja [`MANUAL.md`](.claude/skills/lp-forge/MANUAL.md).

## As 6 direções estéticas

O picker automático escolhe uma das 6 baseado na categoria do negócio + arquétipo do site fonte. Você pode forçar via `--direction`.

| Direção | Cara | Categorias típicas |
|---|---|---|
| **editorial** | Magazine/revista, serif display, grids assimétricos | Restaurantes, cafés, advocacia |
| **industrial** | Mono display, uppercase, raw | Oficinas, construção, eletrônicos |
| **luxury** | Refinado, Cormorant, espaçamento generoso | Clínicas, salões premium, joalherias |
| **playful** | Rounded, color-rich, hover animations | Pet shops, escolas infantis, sorveterias |
| **brutalist** | Harsh, sem shadows, type gigante | Bares, barbearias, gyms, studios criativos |
| **organic** | Warm, soft serif, motion gentil | Yoga, terapia, produtos naturais |

## Arquitetura — diretórios

```
lp-forge/
├── .claude/skills/lp-forge/         # O skill propriamente dito
│   ├── SKILL.md                     # Canonical spec
│   ├── MANUAL.md                    # Manual ponta-a-ponta detalhado
│   ├── README.md                    # README do skill
│   ├── run.cjs                      # CLI entry
│   ├── lib/                         # 15+ módulos core
│   │   ├── orchestrator.cjs         # 7-phase runner
│   │   ├── adapters/                # design-md adapter (spawn + soft-success)
│   │   ├── brand-capture.cjs        # huashu §1.a
│   │   ├── business-info.cjs        # extração + sanitizer
│   │   ├── direction-picker.cjs     # 6 direções
│   │   ├── analysis-doc.cjs         # LLM-driven analysis
│   │   ├── nextjs-generator.cjs     # template + overlays
│   │   ├── copywriter.cjs           # LLM-driven copy
│   │   ├── aesthetic-lint.cjs       # anti-slop
│   │   ├── validator.cjs            # drift + structural
│   │   ├── playwright-fallback.cjs  # SPA render
│   │   └── llm.cjs                  # provider abstraction
│   ├── data/
│   │   ├── prompts/pt-BR/           # analysis-synth, copywriter
│   │   ├── category-to-direction.yaml
│   │   ├── curated-font-pairs.yaml
│   │   ├── forbidden-fonts.yaml
│   │   └── aesthetic-lint-rules.yaml
│   ├── templates/
│   │   ├── nextjs-base/             # Next.js 15 base template
│   │   └── directions/              # 6 direction overlays (CSS @layer)
│   ├── vendor/
│   │   └── design-md/               # Vendored design-md (Alan Nicolas, MIT)
│   └── tests/                       # 100+ unit tests
│
├── docs/
│   ├── research/                    # Análise das 3 skills source
│   ├── architecture/                # Arquitetura + review
│   ├── stories/epics/               # 6 stories AIOX da implementação
│   └── qa/                          # Gate reports
│
├── .env.local                       # OPENAI_API_KEY (gitignored)
├── .gitignore
├── LICENSE                          # MIT
└── README.md                        # este arquivo
```

## Limitações honestas

| Limitação | Workaround | Fix em |
|---|---|---|
| LLM design-md falha em sites grandes (>16k output tokens) | Soft-success usa tokens estáticos. Pipeline continua. | v0.2: chunked prompts |
| `gpt-4o` e `gpt-4.1` respondem "Write file:" no design-md (prompt foi otimizado pro Claude tool calling) | Use `--model gpt-4o-mini` que funciona | v0.2: patchar prompt vendored |
| Copywriter dá hero parecido entre clientes da mesma categoria | Forneça `--business-name` mais específico | v0.2: prompt com exemplos variados |
| Synthesizer de cor pode pegar cor errada (ex: WhatsApp green em site com botão flutuante) | Tem blocklist; v0.2 vai ter `--primary-color` override | v0.2 |
| Logo Tier 1 só pega arquivos diretos (não baixa do sourceUrl) | Logo Tier 2 (tipográfico) funciona | v0.2: brand-capture baixa via sourceUrl |
| Suporta só `pt-BR` em v0.1 | Estrutura `data/prompts/{lang}/` pronta | v0.2: adicionar `en/` |

## Roadmap

- [x] **v0.1.0** — Pipeline completo end-to-end, 6 direções, anti-slop
- [x] **v0.1.1** — LLM-driven analysis + copywriter, Playwright fallback, soft-success
- [x] **v0.1.2** — Prompt OpenAI-friendly, logo via Playwright HTML parse, saturação-based color, `--primary-color` override, hero específico por categoria
- [ ] **v0.2** — Chunked prompts pra sites grandes, multi-page crawl, Vercel deploy automatizado, batch UI
- [ ] **v0.3** — English support, Nano Banana Pro fallback, screenshot real do site fonte como anexo
- [ ] **v1.0** — Integração UI MaquinaLP (botão "Analisar + Redesenhar" no painel de leads)

## Custo típico

100 URLs processadas com OpenAI gpt-4o-mini ≈ **$1 USD**.

Detalhamento por URL:
- design-md DESIGN.md: 1-2 calls, ~30k prompt + ~5k completion = $0.008
- analysis-report.md: 1 call, ~2k prompt + ~2k completion = $0.0015
- copywriter: 1 call, ~800 prompt + ~800 completion = $0.0006
- **Total: ~$0.01 por URL**

## Exemplos de output

Veja [`examples/`](examples/) — 3 casos reais rodados end-to-end:

| Caso | Hero gerado | Pasta |
|---|---|---|
| Orto Implant (clínica odontológica SPA) | "Implantes de qualidade em Nova Serrana" | [`examples/orto-implant/`](examples/orto-implant/) |
| Clínica Mariana Lourenço (WordPress) | "Sorriso perfeito com tecnologia de ponta em São Paulo" | [`examples/clinica-mariana/`](examples/clinica-mariana/) |
| Salão Piazza (salão de beleza) | "Beleza refinada em São Paulo, há 24 anos" | [`examples/salao-piazza/`](examples/salao-piazza/) |

Cada exemplo inclui `analysis-report.md` (1300-1400 palavras), `brand-spec.md`, `business-spec.md`, e `page.tsx.example`.

## Documentação

| Documento | Onde |
|---|---|
| Manual completo | [`.claude/skills/lp-forge/MANUAL.md`](.claude/skills/lp-forge/MANUAL.md) |
| Changelog | [`CHANGELOG.md`](CHANGELOG.md) |
| Contribuindo | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Skill spec (Claude Code) | [`.claude/skills/lp-forge/SKILL.md`](.claude/skills/lp-forge/SKILL.md) |
| Skill README | [`.claude/skills/lp-forge/README.md`](.claude/skills/lp-forge/README.md) |
| Análise das 3 skills source | [`docs/research/skills-synthesis-lp-forge.md`](docs/research/skills-synthesis-lp-forge.md) |
| Arquitetura | [`docs/architecture/Wave2-3-lp-forge/architecture.md`](docs/architecture/Wave2-3-lp-forge/architecture.md) |
| Review do arquiteto | [`docs/architecture/Wave2-3-lp-forge/architecture-review-aria.md`](docs/architecture/Wave2-3-lp-forge/architecture-review-aria.md) |
| Epic + 6 stories | [`docs/stories/epics/epic-002-lp-forge/`](docs/stories/epics/epic-002-lp-forge/) |
| QA gate | [`docs/qa/gates/2.1-skill-foundation.yml`](docs/qa/gates/2.1-skill-foundation.yml) |

## Créditos

Construído como parte do projeto **MaquinaLP** (Wave 2-3 do epic 002) usando o framework AIOX. Squad de implementação:

- **River** (@sm) — drafts research + architecture + 6 stories
- **Aria** (@architect) — review + 9 amendments mandatórios
- **Pax** (@po) — validação 10-point GO 9/10
- **Dex** (@dev) — implementação
- **Quinn** (@qa) — gate CONCERNS → PASS

Skills source:
- `design-md` por **Alan Nicolas** ([@oalanicolas](https://github.com/oalanicolas)) — vendored sob MIT
- `huashu-design` por **花叔** — doutrina aplicada
- `frontend-design` — Claude Plugins official — manifesto aplicado

## Licença

[MIT](LICENSE) — compatível com a licença do `design-md` vendored.

## Troubleshooting rápido

| Erro | Fix |
|---|---|
| `exit 4` content-gate | `--allow-playwright` |
| `exit 6` OPENAI_API_KEY | Crie `.env.local` com `OPENAI_API_KEY=sk-...` |
| `exit 8` brand assets | Forneça `--business-name "Nome"` (dispara Tier 2) |
| `exit 9` business info | `--allow-playwright` (provavelmente SPA) |
| Servidor `EADDRINUSE :::3000` | Use `npx next start -p 5000` na pasta redesign |

Mais detalhes em [`MANUAL.md`](.claude/skills/lp-forge/MANUAL.md#12-troubleshooting).

---

**Status do projeto:** v0.1.1 funcional em produção. 103/104 tests passing. Pronto pra uso real em prospects do MaquinaLP.

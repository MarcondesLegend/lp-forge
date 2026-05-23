# Manual ponta-a-ponta — `lp-forge` v0.1.1

> **O que é, o que faz, e como usar.**
> Última atualização: 2026-05-22 (com melhorias #1-#4: LLM analysis, LLM copywriter, Playwright fallback, max_tokens bump, soft-success fallback)

---

## 1. O que você tem agora

`lp-forge` é uma ferramenta de linha de comando que, **a partir de um URL de site**, produz dois entregáveis em ~30-60 segundos:

| Entregável | Onde fica | Pra que serve |
|---|---|---|
| **1. Análise consultiva (`analysis-report.md`)** | `outputs/lp-forge/{slug}/analysis-report.md` | Você manda esse PDF/MD pro prospect — diagnóstico profissional de ~1400 palavras |
| **2. Site Next.js redesenhado (`redesign/`)** | `outputs/lp-forge/{slug}/redesign/` | Você roda local OU deploya pra mostrar o site novo ao prospect |

Ambos preservam a **identidade visual capturada do site original** (paleta de cores, logo, fontes detectadas) mas com design e copy dramaticamente melhores.

---

## 2. O fluxo: 7 fases, em cascata

```
URL fornecida
   │
   ▼
1. FETCH + EXTRACT
   design-md (vendored, MIT, Alan Nicolas)
   • Baixa HTML + CSS sem browser (axios + cheerio)
   • Detecta paleta, fontes, espaçamento, motion, shadows
   • Identifica arquétipo visual (apple-glass, shadcn-neutral, ...)
   • Identifica stack (WordPress, Tailwind v4, Next.js, ...)
   • Chama LLM para gerar DESIGN.md
   • Se LLM falha mas estática OK → soft-success continua o pipeline
   • Se site é SPA com body vazio → Playwright renderiza
   │
   ▼
2. BRAND CAPTURE (huashu §1.a)
   • Procura logo em 3 caminhos: arquivo direto, inline SVG, fontes comuns
   • Se NÃO acha → gera logotype tipográfico Tier 2 (nome + fonte display + cor brand)
   • Valida MIME (rejeita SVG com <script>)
   • Sintetiza tokens.json mesmo se LLM falhou (a partir dos hex reais usados)
   • Escolhe cor brand inteligente (skip grayscale, branco/preto puro, e cores de canais externos como WhatsApp #25d366)
   │
   ▼
3. BUSINESS INFO
   • Extrai do page.md: telefone, WhatsApp, email, endereço, horários, serviços
   • Sanitiza contra prompt injection (Aria A-6.1)
   • Marca [NÃO CAPTURADO] tudo que não tá literalmente na fonte
   │
   ▼
4. DIRECTION PICK
   • Mapa de 30+ categorias BR → 1 de 6 direções estéticas
     - editorial: revista/serif/grid assimétrico
     - industrial: técnico/mono/raw
     - luxury: refinado/serif elegante/espaçoso
     - playful: caloroso/rounded/color-rich
     - brutalist: cru/harsh/sem sombra
     - organic: humano/warm/sereno
   • Tie-break por fingerprint visual quando ambíguo
   │
   ▼
5. ANALYSIS SYNTH (LLM-driven)
   • Chama OpenAI (gpt-4o-mini) com prompt rico de 200 linhas
   • Inputs: paleta extraída, fontes, arquétipo, stack, page.md, business info
   • Saída: 1200-1800 palavras de análise consultiva profissional
   • Estrutura fixa: sumário / identidade / 5 dimensões com notas / UX&conversão / conteúdo&copy / arquétipo / stack / 5 oportunidades / observações
   • Fallback heurístico se LLM falhar
   │
   ▼
6. NEXT.JS GENERATE
   • Scaffolda Next.js 15 + TypeScript + Tailwind
   • Aplica overlay da direção escolhida (CSS @layer)
   • Copywriter LLM-driven gera: hero/subhead/CTA/services/about/contact intro
     - Voz alinhada à direção (luxury polido, brutalist cru, etc.)
     - ZERO INVENÇÃO: usa só dados do business-spec
   • Brand wired: logo, paleta, fontes como CSS variables
   • SEO Metadata API + audit watermark + XSS guard
   • Anti-slop lint: rejeita gradiente roxo, emoji em heading, etc.
   │
   ▼
7. VALIDATE
   • Drift check: hex values do brand-spec vs globals.css gerado
   • Aesthetic lint final pass
   • Verdict: in-sync / minor-drift / notable-drift / major-drift / fail
```

---

## 3. Como você usa — comandos práticos

### Configuração inicial (uma vez)

```bash
# Criar .env.local na raiz do projeto (já criado se seguiu o setup):
cat > .env.local <<EOF
OPENAI_API_KEY=sk-proj-...sua-key...
EOF

# Verificar dependências (já instaladas):
cd .claude/skills/lp-forge
npm install
```

### Caso típico: 1 prospect

```bash
cd C:/Users/Darkr/ClaudeCode/MaquinaLP

node .claude/skills/lp-forge/run.cjs \
  --url https://seuclientealvo.com.br/ \
  --business-name "Nome do Negócio" \
  --category "categoria" \
  --city "Cidade" \
  --provider openai \
  --model gpt-4o-mini \
  --allow-playwright
```

**Onde sai:** `outputs/lp-forge/{slug}/`
- `analysis-report.md` — manda pro prospect
- `redesign/` — `cd redesign && npm install && npm run dev` pra ver

### Caso especial: site SPA (Wix, Shopify SPA, React-only)

Adicione **`--allow-playwright`** sempre. Vai renderizar o site e capturar o body real.

```bash
node .claude/skills/lp-forge/run.cjs \
  --url https://siteSPA.com.br/ \
  --business-name "..." \
  --category "..." \
  --allow-playwright
```

### Caso: site bloqueia bot (Cloudflare)

Mesma coisa — `--allow-playwright`.

### Caso: re-rodar só uma fase (debug)

```bash
# Só regerar análise (phase 5):
node run.cjs --url <url> --from-phase 5

# Só regerar Next.js (phase 6):
node run.cjs --url <url> --from-phase 6
```

### Batch (vários prospects de uma vez)

```bash
# Crie urls.txt com 1 URL por linha
node run.cjs --batch urls.txt --concurrency 3
```

---

## 4. O que cada flag faz

| Flag | Pra que serve |
|---|---|
| `--url <url>` | URL do site fonte (obrigatório, salvo se `--batch`) |
| `--business-name "Nome"` | **Sempre forneça** — inferência da página é frágil |
| `--category "x"` | Direciona o picker de aesthetic (clínica, restaurante, oficina, ...) |
| `--city "x"` | Aparece na copy e na análise |
| `--lang pt-BR` | Default. Estrutura preparada para `en/` em v0.2 |
| `--direction luxury` | Força uma das 6 direções, ignorando o picker automático |
| `--provider openai` | LLM provider — `openai`, `openrouter`, ou `claude-cli` |
| `--model gpt-4o-mini` | Allow-list: gpt-4o-mini (default barato), gpt-4o, gpt-4.1, o3-mini |
| `--allow-playwright` | Habilita render via Playwright para SPAs ou sites bloqueados |
| `--from-phase <N>` | Re-roda a partir da fase N (1-7). Reaproveita outputs anteriores |
| `--no-reuse` | Ignora cache de 24h, força cold run |
| `--strict` | Aborta se aesthetic-lint detecta issue CRITICAL |
| `--verbose` | Logs detalhados de cada fase |
| `--quiet` / `--silent` | Suprime stdout (JSON log sempre escrito) |

---

## 5. O que sai do outro lado

```
outputs/lp-forge/{slug}/
├── 📄 analysis-report.md          ← DELIVERABLE #1 (manda pro prospect)
├── 🌐 redesign/                   ← DELIVERABLE #2 (npm run dev → mostra)
│   ├── app/
│   │   ├── layout.tsx             SEO meta + audit watermark
│   │   ├── page.tsx               Hero, serviços, sobre, contato
│   │   └── globals.css            Brand tokens + direction overlay
│   ├── components/
│   ├── public/brand/              Logo + assets
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── README.md                  Instruções pro prospect + copyright disclaimer
│
├── brand-spec.md                  Spec da marca (huashu §1.a)
├── business-spec.md               Dados do negócio capturados
├── business-info.json             Versão JSON com confidence levels
├── direction.yaml                 Direção escolhida + reasoning
├── tokens.json                    Cores + fontes parseadas
├── style-fingerprint.json         Arquétipo visual detectado
├── validation-report.json         Drift + lint verdict
├── aesthetic-lint.json            Findings detalhados
├── run-telemetry.json             Timing + custo + decisões
│
└── inputs/                        Cache da Fase 1 (raw HTML/CSS, page.md, ...)
    ├── page.md                    Markdown turndown'd (rendered se SPA)
    ├── rendered.html              ← Quando Playwright rodou
    ├── rendered-screenshot.png    ← Screenshot full-page (Playwright)
    ├── tokens-detected.json       Cores reais extraídas estaticamente
    ├── stack-summary.json         Stack detectado
    └── (outros artefatos do design-md)
```

---

## 6. Custos típicos (OpenAI gpt-4o-mini)

| Fase | Chamadas LLM | Tokens médios | Custo USD |
|---|---|---|---|
| 1. design-md DESIGN.md | 1-2 (com retry) | 30k prompt + 5k completion | $0.008 |
| 5. analysis-report.md | 1 | 2k prompt + 2k completion | $0.0015 |
| 6. copywriter | 1 | 800 prompt + 800 completion | $0.0006 |
| **Total por URL** | **3-4** | **~40k tokens** | **~$0.01** |

100 URLs = ~$1. **Muito barato.**

---

## 7. Casos validados

### Caso 1: **Clínica Mariana Lourenço** (`clinicamarianalourenco.com.br`) — WordPress

- ✅ Estática completa: 245 tokens, 1038 CSS vars
- ⚠️ design-md LLM falhou (site grande, > 16k tokens output)
- ✅ Soft-success: pipeline continuou com tokens sintetizados
- ✅ Analysis LLM: 1437 palavras
- ✅ Copywriter LLM: hero "Transforme seu sorriso com excelência / Tratamentos personalizados para saúde e estética"
- ✅ Contato real: tel:5537999770041
- 🌐 **http://localhost:5001**

### Caso 2: **Orto Implant** (`ortoimplant.com.br`) — SPA Tailwind v4

- ✅ Estática completa: 112 tokens, 297 CSS vars
- ✅ Playwright rodou (site era SPA): 150KB HTML, 4.6KB markdown
- ⚠️ design-md LLM falhou (content policy ou tokens)
- ✅ Soft-success com tokens sintetizados — primary `#c3ae5c` (dourado real)
- ✅ Analysis LLM: 1403 palavras
- ✅ Copywriter LLM: hero personalizado
- ✅ Contato real: tel:5537999712030
- 🌐 **http://localhost:5000**

---

## 8. Limitações honestas (v0.1.1)

| Limitação | Workaround | Fix em |
|---|---|---|
| LLM design-md falha em sites grandes (>16k output tokens) | Soft-success usa tokens estáticos. Ainda OK. | v0.2: chunked prompts |
| LLM gpt-4o e gpt-4.1 respondem "Write file:" em vez de gerar | Use `--model gpt-4o-mini` | v0.2: patchar prompt do design-md |
| Copywriter ainda dá hero parecido entre clientes da mesma categoria | Adicionar diferencial no `--business-name` | v0.2: prompt com exemplos mais variados |
| Synthesizer de tokens pode pegar cor errada se brand color não é o mais usado | Adicionar `--primary-color #hex` override | v0.2: heuristic com saturação |
| Logo Tier 1: design-md acha favicon mas não baixa o binário | Logo Tier 2 (tipográfico) funciona como fallback | v0.2: brand-capture baixa via sourceUrl |
| Servico/horario depende de page.md ter conteúdo | Playwright resolve em sites SPA | OK |

---

## 9. Sequência completa: como um prospect novo flui

```
1. Wave 1 squad (paralelo) → identifica lead "Restaurante X"
                            ↓
2. Você abre terminal:
   $ node .claude/skills/lp-forge/run.cjs \
       --url <site-do-restaurante> \
       --business-name "Restaurante X" \
       --category restaurante \
       --city "São Paulo" \
       --provider openai \
       --model gpt-4o-mini \
       --allow-playwright
                            ↓
3. ~60 segundos depois:
   outputs/lp-forge/restaurante-x/
     analysis-report.md   ← 1400 palavras
     redesign/            ← Next.js completo
                            ↓
4. Você manda o PDF da análise pro prospect via WhatsApp:
   "Maria, fiz um diagnóstico do seu site. Veja em anexo."
                            ↓
5. Você abre o redesign local:
   $ cd outputs/lp-forge/restaurante-x/redesign
   $ npm install && npm run dev
   $ open http://localhost:3000
                            ↓
6. Grava um Loom de 30s navegando o site novo
                            ↓
7. Manda Loom pra Maria:
   "Maria, esse é o site que faria pra você. O que acha?"
                            ↓
8. Maria responde: "Quero! Quanto custa?"
                            ↓
9. Você fecha venda.
```

---

## 10. Próximas evoluções óbvias (v0.2 +)

| # | Melhoria | Por quê |
|---|---|---|
| 1 | Patchar prompt do design-md pra ser OpenAI-friendly (sem "Write tool") | gpt-4o/4.1 deixariam de falhar |
| 2 | Chunked prompts pro design-md em sites grandes | Resolve max_tokens em sites WordPress complexos |
| 3 | Heurística de cor brand por saturação (não só por frequência) | Sintetizador escolhe cor real, não cor mais usada |
| 4 | brand-capture baixa logo via sourceUrl do logo.json | Tier 1 funciona em mais sites |
| 5 | LLM prompt com exemplos por categoria (restaurante, oficina, salão...) | Hero copy mais diferenciado entre clientes |
| 6 | Vercel deploy automatizado (`--deploy`) | Operador pula passo manual |
| 7 | Integração Wave 1 — botão "Redesenhar" no painel de leads | Workflow end-to-end |
| 8 | `--primary-color #hex` override | Operador corrige cor brand quando synthesizer erra |

---

## 11. Onde mexer se precisar

| Coisa | Arquivo |
|---|---|
| Mudar prompt da análise | `data/prompts/pt-BR/analysis-synth.txt` |
| Mudar prompt do copywriter | `data/prompts/pt-BR/copywriter.txt` |
| Adicionar categoria → direção | `data/category-to-direction.yaml` |
| Adicionar cor externa ao blocklist | `lib/adapters/design-md-adapter.cjs` (EXTERNAL_CHANNEL_HEXES) |
| Mudar fonts curadas | `data/curated-font-pairs.yaml` |
| Adicionar regra anti-slop | `data/aesthetic-lint-rules.yaml` |
| Adicionar overlay de direção | `templates/directions/<nova>/globals.append.css` |
| Trocar template Next.js | `templates/nextjs-base/` |

---

## 12. Troubleshooting

| Erro | Causa | Fix |
|---|---|---|
| `exit 4` content-gate failure | Site bloqueia bot | Adicione `--allow-playwright` |
| `exit 5` LLM exhausted | Site muito grande pra LLM em 1 turn | Soft-success deve continuar; se não, use `--from-phase 2` |
| `exit 6` PROVIDER_MISCONFIG | OPENAI_API_KEY não setada | Crie `.env.local` na raiz com a key |
| `exit 8` brand assets insufficient | Sem logo extraível E sem business-name | Forneça `--business-name "Nome"` (Tier 2 dispara) |
| `exit 9` business info too thin | Page.md vazio (SPA) | Adicione `--allow-playwright` |
| Hero idêntico entre 2 prospects | LLM cai em fórmula | Forneça `--business-name` mais específico, ou edite prompt |
| Cor primary errada (verde WhatsApp, branco) | Synthesizer pegou cor errada | v0.2 vai ter `--primary-color` override |
| Servidor diz "EADDRINUSE :::3000" | Porta ocupada pelo Wave 1 squad | Use `-p 5000` ou outra porta |

---

## 13. Onde a key vive (segurança)

```
C:/Users/Darkr/ClaudeCode/MaquinaLP/.env.local     ← sua OPENAI_API_KEY (gitignored)
```

**Importante:**
- `.env.local` está gitignored — não vaza pro repositório
- A key atual `sk-proj-pKY6...` foi colada em chat, portanto **comprometida**
- **REVOGUE** em https://platform.openai.com/api-keys e gere uma nova
- Coloque a nova diretamente no terminal:
  ```powershell
  [System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-proj-NOVA", "User")
  ```
  Ou edite o `.env.local` localmente — não passe pelo chat de novo.

---

## 14. Resumo de uma linha

> **Você dá um URL. Em 30-60s e ~$0.01 de OpenAI, lp-forge te entrega (a) uma análise consultiva de 1400 palavras do site atual e (b) um Next.js 15 redesenhado com a paleta/marca preservada, copy LLM-gerada grounded em dados reais, deployable em Vercel. Pra prospecção em escala da MaquinaLP.**

— Atualizado por @dev (Dex) em 2026-05-22 após implementar melhorias #1-#4

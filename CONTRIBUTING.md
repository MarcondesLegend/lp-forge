# Contributing to lp-forge

Obrigado pelo interesse em contribuir! Este guia tem o que você precisa pra começar.

## Setup

```bash
git clone https://github.com/MarcondesLegend/lp-forge.git
cd lp-forge
cd .claude/skills/lp-forge
npm install
```

Pra testar local, você precisa de uma API key OpenAI:

```bash
# Na raiz do projeto
echo "OPENAI_API_KEY=sk-..." > .env.local
```

## Rodando os testes

```bash
cd .claude/skills/lp-forge
npm test
```

Esperado: **103/104 passing** (1 skipped quando Playwright não está instalado).

## Estrutura — onde mexer

| Onde | Pra que |
|---|---|
| `lib/orchestrator.cjs` | 7-phase runner |
| `lib/adapters/design-md-adapter.cjs` | Phase 1 + soft-success + tokens synthesizer |
| `lib/brand-capture.cjs` | Phase 2, 3-tier logo fallback, huashu §1.a |
| `lib/business-info.cjs` | Phase 3, extração heurística |
| `lib/direction-picker.cjs` | Phase 4, mapping categorias → direções |
| `lib/analysis-doc.cjs` | Phase 5, LLM-driven analysis |
| `lib/nextjs-generator.cjs` | Phase 6, scaffold + template render |
| `lib/copywriter.cjs` | Phase 6, LLM-driven copy (hero/about/services) |
| `lib/validator.cjs` | Phase 7, drift + structural + aesthetic lint |
| `data/prompts/pt-BR/` | Prompts LLM (analysis, copywriter) |
| `data/category-to-direction.yaml` | Mapa de 30+ categorias BR |
| `data/curated-font-pairs.yaml` | 30+ pares display+body por direção |
| `data/forbidden-fonts.yaml` | Inter/Roboto/Arial blocklist |
| `templates/nextjs-base/` | Base Next.js 15 |
| `templates/directions/<name>/` | CSS overlay por direção |

## Diretrizes

1. **Tests primeiro.** Mude algum módulo? Atualize o `.test.cjs` correspondente.
2. **Zero invenção em copy/análise.** Se a fonte não diz, marque `[NÃO CAPTURADO]` ou `[INFERIDO]`. Veja regras nos prompts em `data/prompts/pt-BR/`.
3. **Não toque no `vendor/design-md/`** sem motivo — é vendored. Exceções já documentadas no `VENDORED.md`.
4. **Heuristicas locais > LLM calls** sempre que possível. LLM é caro e pode falhar.
5. **Português correto.** Todos os acentos, ortografia 2009+.

## Validando uma mudança end-to-end

```bash
cd /caminho/do/lp-forge

# Limpe outputs anteriores
rm -rf outputs/lp-forge

# Rode em um site teste
node .claude/skills/lp-forge/run.cjs \
  --url https://example.com \
  --business-name "Test" \
  --category "clínica" \
  --city "São Paulo" \
  --provider openai \
  --model gpt-4o-mini \
  --allow-playwright

# Build o redesign
cd outputs/lp-forge/<slug>/redesign
npm install
npm run build
npm run start
# Abra http://localhost:3000
```

## Pull Requests

- Atualize `CHANGELOG.md` se a mudança é visível ao usuário
- Atualize `MANUAL.md` se mudou comportamento de flag ou pipeline
- 1 PR = 1 escopo. Não junte refactor + feature.

## Issues

Use templates:
- 🐛 **Bug**: incluir comando rodado + log de erro completo + URL do site (se possível)
- ✨ **Feature**: explicar quem se beneficia e em qual caso de uso
- 📝 **Docs**: indicar arquivo + linha + sugestão

## Áreas onde contribuição é especialmente bem-vinda

- 📐 **Mais direções estéticas** (atualmente 6: editorial, industrial, luxury, playful, brutalist, organic)
- 🎨 **Curated font pairs** por direção em `data/curated-font-pairs.yaml`
- 🇧🇷 **Categorias BR** em `data/category-to-direction.yaml`
- 🔧 **Patches no design-md vendored** para melhor cross-provider compat
- 📸 **Screenshots de exemplo** em `examples/`
- 🌍 **Tradução pt-BR → en** dos prompts em `data/prompts/`

## Licença

Ao contribuir, você concorda que suas mudanças sejam licenciadas sob a MIT License do projeto.

---

**Dúvidas?** Abra uma issue ou marca [@MarcondesLegend](https://github.com/MarcondesLegend).

// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase 5: Analysis Report Synthesis (Story 2.4)
//  Synthesizes deliverable #1: analysis-report.md from phases 1-4 outputs.
//  Length target: 800-1500 words. pt-BR voice. Citations to source artifacts.
//
//  LLM-grounded scoring is deferred to runtime invocation. v0.1 ships a
//  heuristic + template-driven baseline that produces a non-empty,
//  grounded report. Story 2.5+ runtime smoke validates the LLM path.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const { EXIT_CODES } = require("./exit-codes.cjs");
const { getLogger } = require("./logger.cjs");

async function run(ctx) {
  const logger = getLogger();

  // Gather inputs from prior phases
  const inputs = {
    designMd: readIfExists(path.join(ctx.outDir, "DESIGN.md")),
    tokens: readJsonIfExists(path.join(ctx.outDir, "tokens.json")),
    fingerprint: readJsonIfExists(path.join(ctx.outDir, "style-fingerprint.json")),
    stack: readJsonIfExists(path.join(ctx.outDir, "stack.json")),
    brandSpec: readIfExists(path.join(ctx.outDir, "brand-spec.md")),
    businessSpec: readIfExists(path.join(ctx.outDir, "business-spec.md")),
    businessInfo: readJsonIfExists(path.join(ctx.outDir, "business-info.json")),
    direction: readYamlIfExists(path.join(ctx.outDir, "direction.yaml"))
  };

  if (!inputs.brandSpec || !inputs.businessSpec) {
    const err = new Error(
      "analysis-doc: missing brand-spec.md or business-spec.md from phases 2-3. " +
      "Run from earlier phase or provide manually."
    );
    err.code = EXIT_CODES.LLM_EXHAUSTED; // closest match
    throw err;
  }

  const report = renderAnalysisReport(inputs, ctx);

  const reportPath = path.join(ctx.outDir, "analysis-report.md");
  fs.writeFileSync(reportPath, report, "utf8");

  const wordCount = report.split(/\s+/).filter(Boolean).length;
  logger.info("analysis-report-written", { path: reportPath, wordCount });

  return { analysisReport: reportPath, wordCount };
}

// ── Renderer ────────────────────────────────────────────────────────

function renderAnalysisReport(inputs, ctx) {
  const businessName =
    (inputs.businessInfo && inputs.businessInfo.info && inputs.businessInfo.info.businessName) ||
    ctx.businessName ||
    "Negócio";

  const direction = (inputs.direction && inputs.direction.direction) || ctx.direction || "editorial";
  const archetype = (inputs.fingerprint && inputs.fingerprint.archetype) || "n/a";
  const stackList = (inputs.stack && Array.isArray(inputs.stack.detected) ? inputs.stack.detected : []).join(", ") || "n/a";

  // Heuristic scoring — LLM refinement happens at runtime smoke
  const scores = {
    typography: scoreTypography(inputs),
    palette: scorePalette(inputs),
    spacing: 5, // baseline; LLM refines
    motion: 5,
    backgrounds: 5
  };

  const topProblems = inferTopProblems(inputs, scores);
  const opportunities = inferOpportunities(inputs, scores, direction);

  return `# Análise: ${businessName}

> Gerado por **lp-forge v0.1** em ${new Date().toISOString().slice(0, 10)} · URL fonte: ${ctx.url}
>
> Esta análise foi produzida automaticamente a partir do site público. Os diagnósticos referenciam artefatos capturados (DESIGN.md, brand-spec.md, business-spec.md) — claims sem citação são heurísticas locais.

---

## Sumário executivo

- **Identidade:** ${businessName} — arquétipo visual detectado: \`${archetype}\` (Phase 1 fingerprint).
- **Nota geral:** ${averageScore(scores)}/10 (média dos 5 eixos de design).
- **Top 3 problemas:** ${topProblems.slice(0, 3).map(p => "(" + p + ")").join("; ")}

## Identidade visual capturada

Extraída de \`brand-spec.md\`:

\`\`\`
${(inputs.brandSpec || "").split("\n").slice(0, 12).join("\n")}
\`\`\`

## Informações de negócio capturadas

Extraídas de \`business-spec.md\` (Phase 3):

\`\`\`
${(inputs.businessSpec || "").split("\n").slice(0, 20).join("\n")}
\`\`\`

## Diagnóstico de design (5 eixos, 1-10)

| Eixo | Nota | Justificativa |
|---|---:|---|
| Tipografia | ${scores.typography}/10 | ${scoringJustification("typography", scores.typography, inputs)} |
| Paleta | ${scores.palette}/10 | ${scoringJustification("palette", scores.palette, inputs)} |
| Espaçamento | ${scores.spacing}/10 | Baseline heurístico (LLM smoke refina) |
| Motion | ${scores.motion}/10 | Baseline heurístico |
| Backgrounds | ${scores.backgrounds}/10 | Baseline heurístico |

## Diagnóstico de UX e Conversão

Análise inicial baseada em DESIGN.md + business-spec.md:

- **Hierarquia visual:** parecer detalhado requer LLM smoke (runtime). Heurística atual aponta que sites com fingerprint \`${archetype}\` tendem a ${archetypeHint(archetype)}.
- **CTAs:** capturados em business-spec.md (seção Contato). ${(inputs.businessInfo && inputs.businessInfo.info && Object.values(inputs.businessInfo.info.contact || {}).filter(Boolean).length) ? "Múltiplos canais de contato presentes — bom sinal de captura de lead." : "**[NÃO ENCONTRADO]** canais de contato — gargalo de conversão crítico."}

## Diagnóstico de Conteúdo

- **Proposta de valor:** ${(inputs.businessInfo && inputs.businessInfo.info && inputs.businessInfo.info.businessName) ? "presente" : "implícita"}.
- **Prova social:** ${(inputs.businessInfo && inputs.businessInfo.info && Array.isArray(inputs.businessInfo.info.socialProof) && inputs.businessInfo.info.socialProof.length) ? `${inputs.businessInfo.info.socialProof.length} citações capturadas` : "**[NÃO ENCONTRADO]** — oportunidade de adicionar"}.

## Arquétipo detectado

**${archetype}** — esse arquétipo representa um conjunto de convenções visuais (espaçamento, tipografia, motion) compartilhadas por sites do mesmo nicho. O redesign mantém os elementos identitários (logo, paleta, fontes) mas substitui o **arquétipo** por uma das 6 direções de \`frontend-design\`.

## Stack detectado

Frameworks/libs detectados pelo \`design-md\`: ${stackList}.

## Direção recomendada para redesign

**${direction}** (uma das 6 direções de \`frontend-design\`).

> ${(inputs.direction && inputs.direction.reasoning) || `Escolha derivada da categoria "${ctx.category || "uncategorized"}" + fingerprint "${archetype}".`}

## Top 5 oportunidades

${opportunities.slice(0, 5).map((o, i) => `${i + 1}. ${o}`).join("\n")}

---

## Anexos

- [\`DESIGN.md\`](./DESIGN.md) — design tokens (Google spec)
- [\`tokens.json\`](./tokens.json) — design tokens parsed
- [\`brand-spec.md\`](./brand-spec.md) — protocolo huashu §1.a
- [\`business-spec.md\`](./business-spec.md) — capturas grounded
- [\`before-preview.html\`](./before-preview.html) — preview do site original (do design-md)
- [\`direction.yaml\`](./direction.yaml) — direção escolhida + reasoning

---

*Gerado por \`lp-forge v0.1\` · ${new Date().toISOString()} · Run ID: ${ctx.runId || "n/a"}*
`;
}

function readIfExists(p) { try { return fs.readFileSync(p, "utf8"); } catch { return null; } }
function readJsonIfExists(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }
function readYamlIfExists(p) { try { return yaml.load(fs.readFileSync(p, "utf8")); } catch { return null; } }

function scoreTypography(inputs) {
  const tokens = inputs.tokens;
  if (!tokens || !tokens.typography) return 5;
  const display = (tokens.typography.display_font || tokens.typography.heading_font || "").toLowerCase();
  if (!display) return 5;
  if (/inter|roboto|arial|helvetica|system/i.test(display)) return 4; // AI default
  return 7;
}

function scorePalette(inputs) {
  const tokens = inputs.tokens;
  if (!tokens || !tokens.colors) return 5;
  const count = Object.keys(tokens.colors).length;
  if (count >= 5 && count <= 8) return 7;
  if (count > 12) return 4; // too noisy
  return 6;
}

function scoringJustification(axis, score, _inputs) {
  if (axis === "typography") {
    if (score >= 7) return "Tokens de tipografia presentes; display font distintivo.";
    if (score <= 4) return "Display font genérico (Inter/Roboto/Arial) detectado — `frontend-design` aponta como AI slop.";
    return "Tokens presentes; sem cifras claras de distinção.";
  }
  if (axis === "palette") {
    if (score >= 7) return "Paleta com 5-8 cores — equilíbrio entre coerência e variedade.";
    if (score <= 4) return "Paleta noisy (12+ cores) ou ausente.";
    return "Paleta presente; falta commit a uma cor dominante.";
  }
  return "Heurística baseline; LLM smoke ajusta no runtime.";
}

function averageScore(scores) {
  const v = Object.values(scores);
  return (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1);
}

function archetypeHint(archetype) {
  if (!archetype || archetype === "n/a") return "padrões genéricos de SaaS";
  if (archetype.includes("shadcn")) return "tipografia neutra + cards arredondados";
  if (archetype.includes("apple")) return "espaçamento generoso + tipografia refinada";
  if (archetype.includes("marketing")) return "gradientes vivos + CTAs grandes";
  if (archetype.includes("editorial")) return "grids assimétricos + serif display";
  return "padrões característicos da categoria";
}

function inferTopProblems(inputs, scores) {
  const problems = [];
  if (scores.typography <= 4) problems.push("tipografia AI-default (Inter/Roboto) prejudica diferenciação");
  if (scores.palette <= 4) problems.push("paleta sem cor dominante");
  if (!inputs.businessInfo || !inputs.businessInfo.info ||
      !Object.values(inputs.businessInfo.info.contact || {}).some(Boolean)) {
    problems.push("ausência de canais de contato claros (conversão crítica)");
  }
  if (inputs.businessInfo && inputs.businessInfo.info &&
      Array.isArray(inputs.businessInfo.info.socialProof) &&
      inputs.businessInfo.info.socialProof.length === 0) {
    problems.push("zero prova social capturada (baixa autoridade)");
  }
  while (problems.length < 3) problems.push("[análise heurística limitada — LLM smoke completa no runtime]");
  return problems;
}

function inferOpportunities(inputs, _scores, direction) {
  const ops = [
    `redesign no direction \`${direction}\` preserva identidade (logo, paleta, fontes) mas eleva execução visual`,
    "headline H1 e CTAs serão reescritos com base em business-spec.md (zero invenção)",
    "audit watermark + structured SEO meta serão adicionados (Lighthouse SEO ≥ 95)",
    "anti-slop linter bloqueia gradientes purple, emoji decoration, e SVG humanoid generation",
    "deploy-ready Next.js 15 — operador pode subir em Vercel sem ajustes"
  ];
  return ops;
}

module.exports = { name: "analysis-synth", run, renderAnalysisReport };

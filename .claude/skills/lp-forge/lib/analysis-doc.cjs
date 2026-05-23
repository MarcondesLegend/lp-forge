// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase 5: Analysis Report Synthesis (Story 2.4 v2)
//
//  Primary path: LLM-driven analysis with rich prompt (data/prompts/{lang}/analysis-synth.txt).
//  Fallback: heuristic template when LLM unavailable or fails.
//
//  Produces deliverable #1: analysis-report.md (1200-1800 words target).
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const { EXIT_CODES } = require("./exit-codes.cjs");
const { getLogger } = require("./logger.cjs");
const { invokeLlm, detectProvider } = require("./llm.cjs");
const { loadPrompt, renderPrompt } = require("./prompt-loader.cjs");
const { sanitizeForLlm } = require("./sanitizer.cjs");

async function run(ctx) {
  const logger = getLogger();

  // Gather inputs from prior phases
  const inputs = gatherInputs(ctx);

  if (!inputs.brandSpec || !inputs.businessSpec) {
    const err = new Error("analysis-doc: missing brand-spec.md or business-spec.md from phases 2-3.");
    err.code = EXIT_CODES.LLM_EXHAUSTED;
    throw err;
  }

  // Try LLM-driven analysis first
  let report = null;
  let mode = "heuristic-fallback";

  const provider = detectProvider(ctx);
  const hasLlmCredentials =
    (provider === "openai" && process.env.OPENAI_API_KEY) ||
    (provider === "openrouter" && process.env.OPENROUTER_API_KEY) ||
    provider === "claude-cli";

  if (hasLlmCredentials) {
    try {
      report = await synthesizeWithLlm(inputs, ctx);
      mode = "llm-driven";
      logger.info("analysis-doc-llm-success", { provider, wordCount: countWords(report) });
    } catch (e) {
      logger.warn("analysis-doc-llm-failed-falling-back-to-heuristic", { error: e.message });
    }
  }

  if (!report) {
    report = renderHeuristicReport(inputs, ctx);
    mode = "heuristic-fallback";
  }

  const reportPath = path.join(ctx.outDir, "analysis-report.md");
  fs.writeFileSync(reportPath, report, "utf8");

  const wordCount = countWords(report);
  logger.info("analysis-report-written", { path: reportPath, wordCount, mode });

  return { analysisReport: reportPath, wordCount, mode };
}

// ── LLM-driven synthesis (primary path) ─────────────────────────────

async function synthesizeWithLlm(inputs, ctx) {
  const template = loadPrompt("analysis-synth", ctx.lang || "pt-BR");
  if (!template) {
    throw new Error("analysis-synth prompt not found in data/prompts/{lang}/");
  }

  const businessName = (inputs.businessInfo && inputs.businessInfo.info && inputs.businessInfo.info.businessName) || ctx.businessName || "Negócio";
  const archetype = (inputs.fingerprint && inputs.fingerprint.archetype) || "n/a";
  const archetypeConfidence = inputs.fingerprint && inputs.fingerprint.confidence
    ? Math.round(Number(inputs.fingerprint.confidence) * 100) : "n/a";
  const stack = inputs.stack;
  const stackList = stackListFromInputs(stack);
  const direction = (inputs.direction && inputs.direction.direction) || ctx.direction || "editorial";
  const directionReasoning = (inputs.direction && inputs.direction.reasoning) || `category "${ctx.category || "uncategorized"}" → ${direction}`;

  // Build prompt context
  const promptCtx = {
    businessName,
    category: ctx.category || "(não fornecido)",
    city: ctx.city || "(não fornecida)",
    sourceUrl: ctx.url || "(URL não fornecida)",
    paletteList: formatPaletteList(inputs.tokens),
    typographyList: formatTypographyList(inputs.tokens),
    archetype,
    archetypeConfidence,
    stackList,
    cssVarsCount: stack && stack.css_vars_count || "n/a",
    fontFaceCount: stack && stack.font_face_count || "n/a",
    uniqueTokensCount: stack && stack.unique_tokens || "n/a",
    shadowsCount: stack && stack.shadows_count || "n/a",
    buttonRadius: stack && stack.button_radius || "n/a",
    pageContent: truncatePageContent(inputs.pageMd, 2000),
    servicesList: formatServicesList(inputs.businessInfo),
    contactStatus: formatContactStatus(inputs.businessInfo),
    hoursStatus: formatHoursStatus(inputs.businessInfo),
    socialProofStatus: formatSocialProofStatus(inputs.businessInfo),
    direction,
    directionReasoning
  };

  let prompt = renderPrompt(template, promptCtx);

  // Sanitize for prompt injection in source content
  const { sanitized, flagged } = sanitizeForLlm(prompt);
  if (flagged.length > 0) {
    const logger = getLogger();
    logger.warn("analysis-prompt-injection-flagged", { count: flagged.length });
  }
  prompt = sanitized;

  const result = await invokeLlm(prompt, {
    model: ctx.model || "gpt-4o-mini",
    maxTokens: 4096,
    temperature: 0
  });

  if (result.status === "stub") {
    throw new Error("LLM stub returned (provider not configured for direct invocation)");
  }
  if (!result.stdout || result.stdout.length < 200) {
    throw new Error("LLM returned empty/too-short response: " + (result.stderr || "").slice(0, 200));
  }

  // Append footer with provenance + anexos
  return result.stdout.trim() + "\n\n" + renderFooter(ctx, inputs, result);
}

function renderFooter(ctx, inputs, llmResult) {
  return `---

## Anexos

${inputs.designMd ? "- [`DESIGN.md`](./DESIGN.md) — design tokens (Google spec)\n" : "- ⚠️ DESIGN.md não gerado (phase 1 limitada — ver `inputs/` para artefatos brutos)\n"}- [\`tokens.json\`](./tokens.json) — paleta + tipografia parseadas
- [\`brand-spec.md\`](./brand-spec.md) — protocolo huashu §1.a
- [\`business-spec.md\`](./business-spec.md) — capturas grounded
- [\`direction.yaml\`](./direction.yaml) — direção escolhida + reasoning
- [\`redesign/\`](./redesign/) — Next.js 15 app gerado (rodar \`cd redesign && npm install && npm run dev\`)

---

*Análise gerada por **lp-forge v0.1** com **${llmResult.provider}** (${llmResult.model}) · ${new Date().toISOString()} · Run ID: ${ctx.runId || "n/a"}*
*Tokens consumidos: ${llmResult.usage ? `${llmResult.usage.prompt_tokens || "?"} prompt + ${llmResult.usage.completion_tokens || "?"} completion` : "n/a"}*`;
}

// ── Heuristic fallback (when LLM unavailable) ───────────────────────

function renderHeuristicReport(inputs, ctx) {
  // Keep prior simple template as fallback
  const businessName = (inputs.businessInfo && inputs.businessInfo.info && inputs.businessInfo.info.businessName) || ctx.businessName || "Negócio";
  const archetype = (inputs.fingerprint && inputs.fingerprint.archetype) || "n/a";
  return `# Análise: ${businessName}

> ⚠️ Modo heurístico (LLM indisponível). Análise limitada a métricas estáticas.

## Sumário executivo
- Identidade: ${businessName} — arquétipo: \`${archetype}\`
- Nota geral: 5.5/10 (média heurística)

## Para análise completa
Configure \`OPENAI_API_KEY\` ou rode com \`--provider openai\` e \`--model gpt-4o-mini\`.

*Gerado em modo fallback · ${new Date().toISOString()}*
`;
}

// ── Helpers — input gathering + formatting ──────────────────────────

function gatherInputs(ctx) {
  return {
    designMd: readIfExists(path.join(ctx.outDir, "DESIGN.md")),
    tokens: readJsonIfExists(path.join(ctx.outDir, "tokens.json")),
    fingerprint: readJsonIfExists(path.join(ctx.outDir, "style-fingerprint.json")),
    stack: readJsonIfExists(path.join(ctx.outDir, "stack.json")) ||
           readJsonIfExists(path.join(ctx.outDir, "inputs", "stack.json")),
    brandSpec: readIfExists(path.join(ctx.outDir, "brand-spec.md")),
    businessSpec: readIfExists(path.join(ctx.outDir, "business-spec.md")),
    businessInfo: readJsonIfExists(path.join(ctx.outDir, "business-info.json")),
    direction: readYamlIfExists(path.join(ctx.outDir, "direction.yaml")),
    pageMd: readIfExists(path.join(ctx.outDir, "inputs", "page.md"))
  };
}

function formatPaletteList(tokens) {
  const colors = (tokens && tokens.colors) || {};
  const entries = Object.entries(colors).filter(([, v]) => typeof v === "string" && v.startsWith("#"));
  if (entries.length === 0) return "(paleta não extraída)";
  return entries.slice(0, 12).map(([role, hex]) => `- ${role}: \`${hex}\``).join("\n");
}

function formatTypographyList(tokens) {
  const typo = (tokens && tokens.typography) || {};
  const entries = Object.entries(typo).filter(([, v]) => typeof v === "string");
  if (entries.length === 0) return "(tipografia não extraída)";
  return entries.slice(0, 6).map(([role, font]) => `- ${role}: ${font}`).join("\n");
}

function stackListFromInputs(stack) {
  if (!stack) return "(stack não detectado)";
  if (Array.isArray(stack.detected)) return stack.detected.join(", ");
  if (Array.isArray(stack.signals)) return stack.signals.map(s => s.name || s).join(", ");
  return "(stack não detectado)";
}

function formatServicesList(businessInfo) {
  const services = businessInfo && businessInfo.info && businessInfo.info.services;
  if (!Array.isArray(services) || services.length === 0) return "[NÃO CAPTURADO no site fonte]";
  return services.slice(0, 8).map(s => `- ${s}`).join("\n");
}

function formatContactStatus(businessInfo) {
  const contact = businessInfo && businessInfo.info && businessInfo.info.contact;
  if (!contact) return "[NÃO CAPTURADO]";
  const items = [];
  if (contact.phone) items.push(`telefone ${contact.phone}`);
  if (contact.whatsapp) items.push(`whatsapp ${contact.whatsapp}`);
  if (contact.email) items.push(`email ${contact.email}`);
  if (contact.address) items.push(`endereço ${contact.address}`);
  return items.length ? items.join("; ") : "[NÃO CAPTURADO]";
}

function formatHoursStatus(businessInfo) {
  const hours = businessInfo && businessInfo.info && businessInfo.info.hours;
  if (!hours || Object.keys(hours).length === 0) return "[NÃO CAPTURADO]";
  return Object.values(hours).slice(0, 4).join("; ");
}

function formatSocialProofStatus(businessInfo) {
  const proof = businessInfo && businessInfo.info && businessInfo.info.socialProof;
  if (!Array.isArray(proof) || proof.length === 0) return "[NÃO CAPTURADO — nenhuma citação/depoimento extraído]";
  return `${proof.length} citações capturadas: "${proof[0].slice(0, 100)}..."`;
}

function truncatePageContent(pageMd, maxChars) {
  if (!pageMd) return "[conteúdo da página não capturado — site pode ser SPA sem server-side rendering]";
  const trimmed = pageMd.trim();
  if (trimmed.length === 0) return "[conteúdo vazio]";
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars) + "\n\n[...truncado]";
}

function countWords(text) {
  return (text || "").split(/\s+/).filter(Boolean).length;
}

function readIfExists(p) { try { return fs.readFileSync(p, "utf8"); } catch { return null; } }
function readJsonIfExists(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }
function readYamlIfExists(p) { try { return yaml.load(fs.readFileSync(p, "utf8")); } catch { return null; } }

module.exports = { name: "analysis-synth", run };

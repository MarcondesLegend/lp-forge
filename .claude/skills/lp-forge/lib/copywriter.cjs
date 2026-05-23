// ────────────────────────────────────────────────────────────────────
//  lp-forge — Copywriter (Story 2.5 v2)
//
//  Primary: LLM-driven copy generation with grounded prompt + JSON output.
//  Fallback: templated headlines per direction (when LLM unavailable).
//
//  Zero invention rule: services list comes ONLY from business-spec.md.
//  If LLM tries to invent, prompt instructs [INFERIDO] prefix.
// ────────────────────────────────────────────────────────────────────
"use strict";

const { invokeLlm, detectProvider } = require("./llm.cjs");
const { loadPrompt, renderPrompt } = require("./prompt-loader.cjs");
const { getLogger } = require("./logger.cjs");

// ── Direction voice descriptions (for prompt) ────────────────────────
const DIRECTION_VOICE = {
  editorial: "prosa polida, tom revista, controle de espaço",
  industrial: "direto, técnico, sem ornamentos, frases curtas",
  luxury: "refinado, controlado, espaçoso, premium sem ser arrogante",
  playful: "caloroso, com personalidade, levemente lúdico, não infantil",
  brutalist: "cru, direto, sem floreio, frases curtas e impactantes",
  organic: "humano, acolhedor, sereno, sem urgência forçada"
};

// ── Fallback templates (when LLM unavailable) ────────────────────────
const FALLBACK_HEADLINES = {
  editorial: businessName => ({ primary: businessName + "." }),
  industrial: businessName => ({ primary: businessName, secondary: "Feito para durar." }),
  luxury: businessName => ({ primary: "Excelência em cada detalhe.", secondary: businessName + "." }),
  playful: businessName => ({ primary: "Bem-vindo a " + businessName + "." }),
  brutalist: businessName => ({ primary: businessName.toUpperCase() + "." }),
  organic: businessName => ({ primary: businessName + ".", secondary: "No seu ritmo." })
};
const FALLBACK_SUBHEADS = {
  editorial: () => "Conheça nossa proposta.",
  industrial: () => "Trabalho técnico, executado com método.",
  luxury: () => "Atendimento sob medida, do primeiro contato à entrega.",
  playful: () => "Um lugar feito para você.",
  brutalist: () => "Direto ao ponto. Sem ruído.",
  organic: () => "Pequenos detalhes, grande diferença."
};
const FALLBACK_CTAS = {
  editorial: () => "Saiba mais",
  industrial: () => "Solicitar orçamento",
  luxury: () => "Agendar atendimento",
  playful: () => "Vamos conversar",
  brutalist: () => "Contato",
  organic: () => "Fale conosco"
};

// ── Main: build copy with LLM-first, heuristic-fallback ──────────────

async function buildCopy(inputs) {
  const direction = inputs.direction || "editorial";
  const businessName = inputs.businessName || "Sua Empresa";
  const logger = getLogger();

  // Try LLM-driven generation first
  let llmCopy = null;
  const provider = detectProvider({ provider: inputs.provider });
  const hasCredentials =
    (provider === "openai" && process.env.OPENAI_API_KEY) ||
    (provider === "openrouter" && process.env.OPENROUTER_API_KEY) ||
    provider === "claude-cli";

  if (hasCredentials) {
    try {
      llmCopy = await generateCopyWithLlm(inputs, direction);
      logger.info("copywriter-llm-success", { provider, source: "llm" });
    } catch (e) {
      logger.warn("copywriter-llm-failed-falling-back", { error: e.message });
    }
  }

  const useLlm = !!llmCopy;
  const c = useLlm ? llmCopy : buildFallback(inputs, direction, businessName);

  return assembleCopyBundle(c, direction, inputs, useLlm);
}

async function generateCopyWithLlm(inputs, direction) {
  const template = loadPrompt("copywriter", inputs.lang || "pt-BR");
  if (!template) throw new Error("copywriter prompt not found");

  const businessName = inputs.businessName || "Sua Empresa";
  const services = Array.isArray(inputs.services) ? inputs.services : [];
  const contact = inputs.contact || {};

  const ctx = {
    businessName,
    category: inputs.category || "(não fornecido)",
    city: inputs.city || "(não fornecida)",
    direction,
    directionVoice: DIRECTION_VOICE[direction] || "(neutra)",
    servicesList: services.length ? services.map(s => `- ${s}`).join("\n") : "[NÃO CAPTURADO]",
    contactStatus: formatContactSummary(contact),
    hoursStatus: inputs.hours && Object.keys(inputs.hours).length ? "Disponível" : "[NÃO CAPTURADO]",
    socialProofStatus: Array.isArray(inputs.socialProof) && inputs.socialProof.length
      ? `${inputs.socialProof.length} citações disponíveis`
      : "[NÃO CAPTURADO]",
    pageContent: (inputs.pageContent || "[conteúdo não capturado — site pode ser SPA]").slice(0, 2000)
  };

  const prompt = renderPrompt(template, ctx);
  const result = await invokeLlm(prompt, {
    model: inputs.model || "gpt-4o-mini",
    maxTokens: 2048,
    temperature: 0
  });

  if (result.status === "stub") {
    throw new Error("LLM stub returned (no real provider)");
  }
  const raw = (result.stdout || "").trim();
  if (raw.length < 50) {
    throw new Error("LLM returned empty/too-short response");
  }
  const json = extractFirstJsonObject(raw);
  if (!json) throw new Error("Failed to parse JSON from LLM response: " + raw.slice(0, 200));
  return json;
}

function buildFallback(inputs, direction, businessName) {
  return {
    heroHeadline: FALLBACK_HEADLINES[direction](businessName),
    heroSubheadline: FALLBACK_SUBHEADS[direction](),
    heroCta: FALLBACK_CTAS[direction](),
    servicesIntro: "",
    services: (inputs.services || []).map(s => ({ title: s, description: "" })),
    aboutHeadline: "Sobre",
    aboutCopy: inferAboutCopy(inputs),
    contactIntro: "Entre em contato pelos canais abaixo."
  };
}

// ── Assemble JSX-ready bundle from copy object ───────────────────────

function assembleCopyBundle(c, direction, inputs, fromLlm) {
  const headline = c.heroHeadline || { primary: inputs.businessName || "" };
  const primary = String(headline.primary || "").trim();
  const secondary = headline.secondary ? String(headline.secondary).trim() : "";

  const heroHeadline = secondary
    ? `${escapeHtml(primary)}<span class="block">${escapeHtml(secondary)}</span>`
    : escapeHtml(primary);

  const heroSubheadline = jsxStringSafe(c.heroSubheadline || "");
  const heroCta = jsxStringSafe(c.heroCta || "Contato");

  const services = Array.isArray(c.services) ? c.services : [];
  const servicesBlock = services.length > 0
    ? services.slice(0, 6).map(s => renderServiceCard(s, direction)).join("\n")
    : `          <p className="text-brand-ink/60 col-span-3">Entre em contato para conhecer nossos serviços.</p>`;

  const aboutCopy = jsxStringSafe(c.aboutCopy || inferAboutCopy(inputs));
  const contactBlock = renderContactBlock(inputs.contact || {}, direction);

  return {
    heroHeadline,
    heroSubheadline,
    heroCta,
    servicesBlock,
    aboutCopy,
    contactBlock,
    _source: fromLlm ? "llm" : "fallback"
  };
}

function renderServiceCard(service, direction) {
  const cls = direction === "playful" ? "playful-card border border-brand-ink/10"
    : direction === "industrial" ? "industrial-card"
    : direction === "brutalist" ? "brutalist-box"
    : direction === "organic" ? "organic-card"
    : direction === "luxury" ? "border-l-2 border-brand-primary pl-6 py-2"
    : "border-t border-brand-ink/20 pt-4";

  const title = typeof service === "string" ? service : (service.title || "");
  const desc = typeof service === "object" && service.description ? service.description : "";

  const safeTitle = escapeJsx(title);
  const safeDesc = escapeJsx(desc);

  return `          <div className="${cls}">
            <h3 className="text-xl mb-2">${safeTitle}</h3>
            ${desc ? `<p className="text-brand-ink/70 text-sm">${safeDesc}</p>` : ""}
          </div>`;
}

function renderContactBlock(contact, direction) {
  void direction;
  const items = [];
  if (contact.phone) items.push(`<p><strong>Telefone:</strong> <a href="tel:${escapeAttr(contact.phone)}">${escapeJsx(contact.phone)}</a></p>`);
  if (contact.whatsapp) items.push(`<p><strong>WhatsApp:</strong> <a href="https://wa.me/${escapeAttr(contact.whatsapp)}">${escapeJsx(contact.whatsapp)}</a></p>`);
  if (contact.email) items.push(`<p><strong>Email:</strong> <a href="mailto:${escapeAttr(contact.email)}">${escapeJsx(contact.email)}</a></p>`);
  if (contact.address) items.push(`<p><strong>Endereço:</strong> ${escapeJsx(contact.address)}</p>`);
  if (items.length === 0) items.push(`<p>Entre em contato pelo formulário ou redes sociais.</p>`);
  return items.map(i => `        ${i}`).join("\n");
}

function inferAboutCopy(inputs) {
  const businessName = inputs.businessName || "Esta empresa";
  const category = inputs.category;
  const city = inputs.city;
  if (!category && !city) return `${businessName} atende seus clientes com atenção a cada detalhe.`;
  const parts = [businessName];
  if (category) parts.push(`atua em ${category}`);
  if (city) parts.push(`em ${city}`);
  return parts.join(" ") + ".";
}

function formatContactSummary(contact) {
  const parts = [];
  if (contact.phone) parts.push(`telefone ${contact.phone}`);
  if (contact.whatsapp) parts.push(`whatsapp ${contact.whatsapp}`);
  if (contact.email) parts.push(`email`);
  if (contact.address) parts.push(`endereço`);
  return parts.length ? parts.join("; ") : "[NÃO CAPTURADO]";
}

// ── Robust JSON extraction (handles LLM wrapping in ```json fences) ──

function extractFirstJsonObject(text) {
  if (!text) return null;
  // Strip ```json fences
  let t = text.replace(/```(?:json)?/g, "").trim();
  // Find first { and matching closing
  const start = t.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = t.slice(start, i + 1);
        try { return JSON.parse(slice); }
        catch (e) { return null; }
      }
    }
  }
  return null;
}

// ── String escape helpers ────────────────────────────────────────────

function escapeAttr(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function escapeJsx(s) { return String(s).replace(/[<>{}]/g, c => ({"<":"&lt;",">":"&gt;","{":"&#123;","}":"&#125;"}[c])); }
function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function jsxStringSafe(s) { return escapeJsx(String(s)); }

module.exports = { buildCopy, DIRECTION_VOICE, FALLBACK_HEADLINES, FALLBACK_SUBHEADS, FALLBACK_CTAS, extractFirstJsonObject };

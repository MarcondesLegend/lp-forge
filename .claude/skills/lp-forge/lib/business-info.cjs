// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase 3: Business Info Extraction (Story 2.3)
//  Extracts services, hours, contact, social proof from page markdown.
//  Static heuristics + sanitizer pre-pass. LLM-grounded refinement happens
//  when provider is configured; otherwise honest heuristic output.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");

const { EXIT_CODES } = require("./exit-codes.cjs");
const { getLogger } = require("./logger.cjs");
const { sanitizeForLlm } = require("./sanitizer.cjs");

async function run(ctx) {
  const logger = getLogger();

  // Load page markdown from design-md
  const pageMdPath = path.join(ctx.outDir, "inputs", "page.md");
  let pageMd = "";
  if (fs.existsSync(pageMdPath)) {
    pageMd = fs.readFileSync(pageMdPath, "utf8");
  } else {
    logger.warn("page-md-missing", { hint: "design-md should produce inputs/page.md; using empty input" });
  }

  // Sanitize before any LLM exposure (Aria A-6.1)
  const { sanitized, flagged, hardBlock } = sanitizeForLlm(pageMd);
  if (flagged.length > 0) {
    logger.warn("prompt-injection-flagged", { count: flagged.length, patterns: flagged.map(f => f.pattern) });
  }
  if (hardBlock) {
    const err = new Error(`Sanitizer hard-block: ${flagged.length} injection patterns exceed threshold`);
    err.code = EXIT_CODES.SANITIZATION_HARD_BLOCK;
    throw err;
  }

  // Heuristic extraction (no LLM needed for the structural form; refinements come from LLM in future)
  const info = {
    businessName: ctx.businessName || extractTitle(sanitized) || null,
    category: ctx.category || null,
    city: ctx.city || null,
    services: extractServices(sanitized),
    hours: extractHours(sanitized),
    contact: extractContact(sanitized),
    socialProof: extractSocialProof(sanitized),
    pricingHints: extractPricingHints(sanitized),
    differentiators: []
  };

  // Confidence tagging — high = found via explicit pattern; low = inferred or absent
  const confidence = {
    businessName: info.businessName && (ctx.businessName ? "high" : "medium"),
    services: info.services.length > 0 ? "medium" : "absent",
    hours: Object.keys(info.hours).length > 0 ? "medium" : "absent",
    contact: Object.values(info.contact).some(v => v) ? "high" : "absent",
    socialProof: info.socialProof.length > 0 ? "medium" : "absent"
  };

  // If business signal is too thin (no name AND no services AND no contact), fail
  const signalScore =
    (info.businessName ? 1 : 0) +
    (info.services.length > 0 ? 1 : 0) +
    (Object.values(info.contact).some(v => v) ? 1 : 0);

  if (signalScore === 0) {
    const err = new Error(
      "Business info too thin — no name, no services, no contact extractable. " +
      "Provide --business-name and --category, or verify source URL has real content."
    );
    err.code = EXIT_CODES.BUSINESS_INFO_TOO_THIN;
    throw err;
  }

  // Write JSON + markdown
  const jsonPath = path.join(ctx.outDir, "business-info.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ info, confidence, flagged_count: flagged.length }, null, 2), "utf8");

  const mdPath = path.join(ctx.outDir, "business-spec.md");
  fs.writeFileSync(mdPath, renderBusinessSpec(info, confidence), "utf8");

  logger.info("business-spec-written", { path: mdPath, signalScore, services: info.services.length });
  return { businessInfo: info, confidence, businessSpec: mdPath };
}

// ── Heuristic extractors ────────────────────────────────────────────

function extractTitle(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function extractServices(md) {
  const services = new Set();
  // Bullet lists under "Services", "Serviços", "Cardápio", "Menu", etc.
  const sectionRe = /^#{2,3}\s+(?:Servi[çc]os|Services|Card[áa]pio|Menu|O que fazemos|What we do)[\s\S]*?(?=^#{1,3}\s|\Z)/im;
  const block = md.match(sectionRe);
  if (block) {
    const bullets = block[0].matchAll(/^\s*[-*•]\s+(.+)$/gm);
    for (const b of bullets) services.add(b[1].trim());
  }
  return Array.from(services).slice(0, 10);
}

function extractHours(md) {
  const hours = {};
  // Common BR patterns: "Seg-Sex 8h-18h", "Domingo: Fechado", "Aberto 24h"
  const lineRe = /(?:Seg|Ter|Qua|Qui|Sex|S[áa]b|Dom|Mon|Tue|Wed|Thu|Fri|Sat|Sun|[Ss]egunda|[Tt]er[çc]a|[Qq]uarta|[Qq]uinta|[Ss]exta|[Ss][áa]bado|[Dd]omingo)[\s\w-]{0,30}?(\d{1,2}h\d{0,2}|\d{1,2}:\d{2})\s*(?:[-–às as]+)\s*(\d{1,2}h\d{0,2}|\d{1,2}:\d{2})/gi;
  const matches = md.matchAll(lineRe);
  let i = 0;
  for (const m of matches) {
    hours[`entry_${i++}`] = m[0].slice(0, 80);
    if (i > 7) break;
  }
  if (/aberto\s+24\s*h/i.test(md)) hours["all_day"] = "Aberto 24h";
  return hours;
}

function extractContact(md) {
  const contact = { phone: null, whatsapp: null, email: null, address: null };
  const phoneMatch = md.match(/(?:\+?\d{1,3}[\s\-.]?)?(?:\(?\d{2,3}\)?[\s\-.]?)?\d{4,5}[\s\-.]?\d{4}/);
  if (phoneMatch) contact.phone = phoneMatch[0].trim();
  const waMatch = md.match(/wa\.me\/(\d+)|whatsapp[\s\S]{0,20}?(\d{10,14})/i);
  if (waMatch) contact.whatsapp = (waMatch[1] || waMatch[2] || "").trim();
  const emailMatch = md.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (emailMatch) contact.email = emailMatch[0];
  // Address — coarse heuristic
  const addrMatch = md.match(/(?:Rua|Avenida|Av\.|R\.)\s+[^,\n]+,?\s*\d+/i);
  if (addrMatch) contact.address = addrMatch[0].slice(0, 120);
  return contact;
}

function extractSocialProof(md) {
  const proof = [];
  // Quoted blocks
  const blockquoteRe = /^>\s+(.+)$/gm;
  for (const m of md.matchAll(blockquoteRe)) {
    if (m[1].length > 20) proof.push(m[1].trim().slice(0, 200));
    if (proof.length >= 5) break;
  }
  return proof;
}

function extractPricingHints(md) {
  const hints = [];
  const moneyRe = /R\$\s?\d+[.,]?\d*|[Aa]\s+partir\s+de\s+R\$\s?\d+[.,]?\d*|\$\d+/g;
  const matches = md.matchAll(moneyRe);
  for (const m of matches) {
    hints.push(m[0]);
    if (hints.length >= 8) break;
  }
  return hints;
}

function renderBusinessSpec(info, confidence) {
  function mark(value, conf) {
    if (!value || (Array.isArray(value) && !value.length) || (typeof value === "object" && !Array.isArray(value) && !Object.values(value).some(v => v))) {
      return "[NÃO ENCONTRADO]";
    }
    const suffix = conf === "low" ? " [?]" : "";
    if (Array.isArray(value)) return value.map(v => `- ${v}${suffix}`).join("\n");
    if (typeof value === "object") {
      return Object.entries(value).filter(([_, v]) => v).map(([k, v]) => `- **${k}**: ${v}${suffix}`).join("\n");
    }
    return String(value) + suffix;
  }

  return `# ${info.businessName || "[business name not detected]"} · Business Spec

> Captured by lp-forge phase 3.

## Identidade
- **Nome:** ${info.businessName || "[NÃO ENCONTRADO]"}
- **Categoria:** ${info.category || "[NÃO ENCONTRADO]"}
- **Cidade:** ${info.city || "[NÃO ENCONTRADO]"}

## Serviços
${mark(info.services, confidence.services)}

## Horários
${mark(info.hours, confidence.hours)}

## Contato
${mark(info.contact, confidence.contact)}

## Prova social
${mark(info.socialProof, confidence.socialProof)}

## Indicações de preço
${mark(info.pricingHints, "low")}

---

*Confidence:* names with [?] suffix are low-confidence inferences. Sections marked [NÃO ENCONTRADO] are explicit absences, not invented data.
`;
}

module.exports = { name: "business-info", run };

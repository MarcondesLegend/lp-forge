// ────────────────────────────────────────────────────────────────────
//  lp-forge — Prompt Loader (AC-17, Q-7 i18n-ready)
//  Resolves data/prompts/{lang}/{name}.txt with pt-BR fallback.
//  v0.1 supports only pt-BR. v0.2 adds en/ folder without code changes.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");

const SUPPORTED_LANGS = Object.freeze(["pt-BR"]);
const FALLBACK_LANG = "pt-BR";
const PROMPTS_ROOT = path.join(__dirname, "..", "data", "prompts");

/**
 * Load a prompt template from data/prompts/{lang}/{name}.txt.
 * Falls back to pt-BR if requested lang has no file.
 * Throws if even fallback is missing — caller should expect prompts to exist.
 */
function loadPrompt(name, lang = "pt-BR") {
  if (!SUPPORTED_LANGS.includes(lang)) {
    lang = FALLBACK_LANG;
  }
  const candidates = [
    path.join(PROMPTS_ROOT, lang, `${name}.txt`),
    path.join(PROMPTS_ROOT, FALLBACK_LANG, `${name}.txt`)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, "utf8");
    }
  }
  // In v0.1 stub phase, prompts may not exist yet — return marker for orchestrator.
  return null;
}

/**
 * Resolve template variables {{key}} → ctx[key].
 * Missing keys leave the placeholder intact (signals dev bug).
 */
function renderPrompt(template, ctx) {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    return ctx[key] !== undefined ? String(ctx[key]) : m;
  });
}

module.exports = { loadPrompt, renderPrompt, SUPPORTED_LANGS, FALLBACK_LANG };

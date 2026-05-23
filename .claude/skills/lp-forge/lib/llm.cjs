// ────────────────────────────────────────────────────────────────────
//  lp-forge — LLM Abstraction (AC-7)
//
//  API surface adapted from design-md/lib/llm.cjs (Alan Nicolas, MIT).
//  Story 2.1 ships a minimal version with the SAME interface but stubbed
//  provider invocation — concrete provider calls land via the vendored
//  design-md in Story 2.2 (Aria Amendment A-1: hybrid spawn+require).
//
//  Aria Amendment A-8: temperature is hard-locked to 0 in production.
//  --temperature N is dev-only and rejected when NODE_ENV=production.
// ────────────────────────────────────────────────────────────────────
"use strict";

const path = require("path");
const fs = require("fs");
const { EXIT_CODES } = require("./exit-codes.cjs");

// Auto-load .env.local from project root (best-effort — runs once)
(function loadEnv() {
  try {
    let dir = __dirname;
    for (let i = 0; i < 6 && dir; i++) {
      const envPath = path.join(dir, ".env.local");
      if (fs.existsSync(envPath)) {
        try { require("dotenv").config({ path: envPath }); }
        catch { /* dotenv may not be installed in vendor-only contexts */ }
        return;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* best-effort */ }
})();

// ── Provider defaults + allow-list (operator policy mirrored from design-md + OpenAI added)
const PROVIDER_DEFAULTS = Object.freeze({
  "claude-cli": { default_model: "claude-opus-4-7", allowed: null /* any */ },
  "openrouter": { default_model: "anthropic/claude-haiku-4-5", allowed: [/haiku/i] },
  "openai": { default_model: "gpt-4o-mini", allowed: [/^gpt-4o(-mini)?$/, /^gpt-4\.1/, /^o3-mini/, /^gpt-4o-mini-2024/] }
});

const PRODUCTION_TEMPERATURE = 0;

function detectProvider(options = {}) {
  if (options.provider) return options.provider;
  if (process.env.VERCEL === "1") return "openrouter";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "claude-cli";
}

function validateProviderModel(provider, requestedModel) {
  const policy = PROVIDER_DEFAULTS[provider];
  if (!policy) {
    throw new Error(
      `Unknown provider: ${provider}. Supported: ${Object.keys(PROVIDER_DEFAULTS).join(", ")}.`
    );
  }
  if (!requestedModel) {
    return { ok: true, model: policy.default_model, source: "provider-default" };
  }
  if (policy.allowed) {
    const passes = policy.allowed.some(re => re.test(requestedModel));
    if (!passes) {
      throw new Error(
        `Provider '${provider}' rejects model '${requestedModel}'.\n` +
        `  Allow-list: ${policy.allowed.map(r => r.source).join(", ")}.\n` +
        `  Use --provider claude-cli for Opus access, or pick a Haiku model.`
      );
    }
  }
  return { ok: true, model: requestedModel, source: "explicit" };
}

/**
 * Enforce Aria Amendment A-8 temperature lock.
 * In production, temperature MUST be 0. Dev override allowed.
 */
function enforceTemperaturePolicy(options = {}) {
  const requested = options.temperature;
  if (process.env.NODE_ENV === "production" && requested !== undefined && requested !== 0) {
    const err = new Error(
      `Aria Amendment A-8 violation: temperature must be 0 in production. ` +
      `Requested: ${requested}. Set NODE_ENV=development to override.`
    );
    err.code = EXIT_CODES.USAGE_ERROR;
    throw err;
  }
  return requested !== undefined ? requested : PRODUCTION_TEMPERATURE;
}

/**
 * Main dispatcher. Routes to provider-specific invoke based on detectProvider().
 * Returns: { status, provider, model, temperature, stdout, stderr, usage?, finishReason? }
 */
async function invokeLlm(promptText, options = {}) {
  const provider = detectProvider(options);
  const policyResult = validateProviderModel(provider, options.model);
  const temperature = enforceTemperaturePolicy(options);

  if (provider === "openrouter" && !process.env.OPENROUTER_API_KEY) {
    const err = new Error(
      "OpenRouter selected but OPENROUTER_API_KEY not set. " +
      "Set it in .env.local or shell, or use --provider claude-cli."
    );
    err.code = EXIT_CODES.PROVIDER_MISCONFIG;
    throw err;
  }

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      const err = new Error("OpenAI selected but OPENAI_API_KEY not set in env or .env.local.");
      err.code = EXIT_CODES.PROVIDER_MISCONFIG;
      throw err;
    }
    const openai = require("./providers/openai.cjs");
    return openai.invoke(promptText, { ...options, model: policyResult.model, temperature });
  }

  if (provider === "claude-cli" || provider === "openrouter") {
    // For these providers, lp-forge v0.1 ships the contract scaffold only.
    // The vendored design-md handles its own LLM calls during phase 1.
    // Phase 5+ (analysis, generator copy) currently use heuristic baselines —
    // switching to live LLM here requires per-phase wiring (future story).
    return {
      status: "stub",
      provider,
      model: policyResult.model,
      temperature,
      stdout: "",
      stderr: "",
      note: `lp-forge v0.1 — ${provider} integration goes through vendored design-md (phase 1). Phase 5+ uses heuristic baseline.`,
      promptLength: promptText ? promptText.length : 0
    };
  }

  const err = new Error(`Unknown provider routing: ${provider}`);
  err.code = EXIT_CODES.USAGE_ERROR;
  throw err;
}

module.exports = {
  PROVIDER_DEFAULTS,
  PRODUCTION_TEMPERATURE,
  detectProvider,
  validateProviderModel,
  enforceTemperaturePolicy,
  invokeLlm
};

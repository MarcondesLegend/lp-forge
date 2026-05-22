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

const { EXIT_CODES } = require("./exit-codes.cjs");

// ── Provider defaults + allow-list (operator policy mirrored from design-md)
const PROVIDER_DEFAULTS = Object.freeze({
  "claude-cli": { default_model: "claude-opus-4-7", allowed: null /* any */ },
  "openrouter": { default_model: "anthropic/claude-haiku-4-5", allowed: [/haiku/i] }
});

const PRODUCTION_TEMPERATURE = 0;

function detectProvider(options = {}) {
  if (options.provider) return options.provider;
  if (process.env.VERCEL === "1") return "openrouter";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
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
 * Main dispatcher. Story 2.1 returns a structured "not implemented" response
 * so callers can integrate the contract without crashing. Story 2.2 wires
 * actual provider invocation through the vendored design-md.
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

  // v0.1 stub: integrate without invoking. Story 2.2 replaces this branch with
  // a child_process spawn of vendor/design-md/run.cjs (Aria Amendment A-1).
  return {
    status: "stub",
    provider,
    model: policyResult.model,
    temperature,
    stdout: "",
    stderr: "",
    note: "lp-forge v0.1 — LLM invocation is a stub; Story 2.2 wires real providers via vendored design-md.",
    promptLength: promptText ? promptText.length : 0
  };
}

module.exports = {
  PROVIDER_DEFAULTS,
  PRODUCTION_TEMPERATURE,
  detectProvider,
  validateProviderModel,
  enforceTemperaturePolicy,
  invokeLlm
};

// ────────────────────────────────────────────────────────────────────
//  Tests — lib/llm.cjs
//  Smoke: module loads without throwing (AC-7).
//  Policy: validateProviderModel enforces openrouter allow-list.
//  Aria A-8: temperature locked to 0 in production.
// ────────────────────────────────────────────────────────────────────
"use strict";

const test = require("node:test");
const assert = require("node:assert");

const {
  PROVIDER_DEFAULTS,
  PRODUCTION_TEMPERATURE,
  detectProvider,
  validateProviderModel,
  enforceTemperaturePolicy,
  invokeLlm
} = require("../../lib/llm.cjs");

test("Module loads (AC-7 smoke)", () => {
  assert.ok(typeof invokeLlm === "function");
  assert.ok(typeof validateProviderModel === "function");
});

test("PROVIDER_DEFAULTS has claude-cli and openrouter", () => {
  assert.ok(PROVIDER_DEFAULTS["claude-cli"]);
  assert.ok(PROVIDER_DEFAULTS["openrouter"]);
});

test("validateProviderModel: rejects unknown provider", () => {
  assert.throws(() => validateProviderModel("fake-provider", "any-model"),
    /Unknown provider/);
});

test("validateProviderModel: openrouter allow-list rejects non-haiku models", () => {
  assert.throws(() => validateProviderModel("openrouter", "anthropic/claude-opus-4-7"),
    /rejects model/);
});

test("validateProviderModel: openrouter accepts haiku models", () => {
  const r = validateProviderModel("openrouter", "anthropic/claude-haiku-4-5");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.model, "anthropic/claude-haiku-4-5");
});

test("validateProviderModel: claude-cli has no allow-list (Opus allowed)", () => {
  const r = validateProviderModel("claude-cli", "claude-opus-4-7");
  assert.strictEqual(r.ok, true);
});

test("validateProviderModel: returns default when no model requested", () => {
  const r = validateProviderModel("openrouter", null);
  assert.strictEqual(r.model, "anthropic/claude-haiku-4-5");
  assert.strictEqual(r.source, "provider-default");
});

test("Aria A-8: production rejects non-zero temperature", () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => enforceTemperaturePolicy({ temperature: 0.5 }),
      /A-8 violation/);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test("Aria A-8: production allows temperature=0 explicitly", () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const t = enforceTemperaturePolicy({ temperature: 0 });
    assert.strictEqual(t, 0);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test("Aria A-8: production defaults to 0 when temperature unset", () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const t = enforceTemperaturePolicy({});
    assert.strictEqual(t, PRODUCTION_TEMPERATURE);
    assert.strictEqual(t, 0);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test("Dev (non-production) allows custom temperature", () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const t = enforceTemperaturePolicy({ temperature: 0.7 });
    assert.strictEqual(t, 0.7);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test("detectProvider: explicit override wins", () => {
  const prevKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  try {
    assert.strictEqual(detectProvider({ provider: "claude-cli" }), "claude-cli");
  } finally {
    process.env.OPENROUTER_API_KEY = prevKey;
  }
});

test("detectProvider: OPENROUTER_API_KEY auto-routes to openrouter", () => {
  const prevKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  try {
    assert.strictEqual(detectProvider({}), "openrouter");
  } finally {
    if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = prevKey;
  }
});

test("invokeLlm: v0.1 stub returns structured response without throwing", async () => {
  const prevKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const r = await invokeLlm("hello prompt", { provider: "claude-cli" });
    assert.strictEqual(r.status, "stub");
    assert.strictEqual(r.provider, "claude-cli");
    assert.strictEqual(r.temperature, 0);
    assert.ok(r.note.includes("stub"));
  } finally {
    if (prevKey !== undefined) process.env.OPENROUTER_API_KEY = prevKey;
  }
});

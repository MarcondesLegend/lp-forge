// ────────────────────────────────────────────────────────────────────
//  Tests — lib/exit-codes.cjs
//  Verify all 13 exit codes present + reasons readable.
// ────────────────────────────────────────────────────────────────────
"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { EXIT_CODES, REASONS, reasonFor } = require("../../lib/exit-codes.cjs");

test("EXIT_CODES is frozen", () => {
  assert.ok(Object.isFrozen(EXIT_CODES), "EXIT_CODES must be frozen to prevent mutation");
});

test("All 13 expected codes are present", () => {
  const expected = [
    "OK", "USAGE_ERROR", "CONTENT_GATE", "LLM_EXHAUSTED",
    "PROVIDER_MISCONFIG", "HTTP_ERROR", "BRAND_ASSETS_INSUFFICIENT",
    "BUSINESS_INFO_TOO_THIN", "NEXTJS_GENERATION_ERROR", "VALIDATION_FAILED",
    "PLAYWRIGHT_NOT_INSTALLED", "SANITIZATION_HARD_BLOCK"
  ];
  // 12 named codes; OK is the implicit 13th (counted as 0)
  for (const name of expected) {
    assert.ok(name in EXIT_CODES, `Missing exit code: ${name}`);
    assert.ok(typeof EXIT_CODES[name] === "number", `${name} must be numeric`);
  }
});

test("Specific code values match architecture §6 + Aria A-7", () => {
  assert.strictEqual(EXIT_CODES.OK, 0);
  assert.strictEqual(EXIT_CODES.USAGE_ERROR, 1);
  assert.strictEqual(EXIT_CODES.CONTENT_GATE, 4);
  assert.strictEqual(EXIT_CODES.LLM_EXHAUSTED, 5);
  assert.strictEqual(EXIT_CODES.PROVIDER_MISCONFIG, 6);
  assert.strictEqual(EXIT_CODES.HTTP_ERROR, 7);
  assert.strictEqual(EXIT_CODES.BRAND_ASSETS_INSUFFICIENT, 8);
  assert.strictEqual(EXIT_CODES.BUSINESS_INFO_TOO_THIN, 9);
  assert.strictEqual(EXIT_CODES.NEXTJS_GENERATION_ERROR, 10);
  assert.strictEqual(EXIT_CODES.VALIDATION_FAILED, 11);
  // Aria A-7 additions:
  assert.strictEqual(EXIT_CODES.PLAYWRIGHT_NOT_INSTALLED, 12);
  assert.strictEqual(EXIT_CODES.SANITIZATION_HARD_BLOCK, 13);
});

test("reasonFor returns a non-empty string for every code", () => {
  for (const code of Object.values(EXIT_CODES)) {
    const r = reasonFor(code);
    assert.ok(typeof r === "string" && r.length > 0, `reasonFor(${code}) must return non-empty string`);
  }
});

test("reasonFor returns Unknown for unknown code", () => {
  const r = reasonFor(999);
  assert.match(r, /Unknown/);
});

test("REASONS keys cover all EXIT_CODES values", () => {
  for (const code of Object.values(EXIT_CODES)) {
    assert.ok(REASONS[code], `REASONS missing entry for code ${code}`);
  }
});

"use strict";
const test = require("node:test");
const assert = require("node:assert");

const { pickDirection, DIRECTIONS, fingerprintToDirection } = require("../../lib/direction-picker.cjs");

test("DIRECTIONS lists exactly 6", () => {
  assert.strictEqual(DIRECTIONS.length, 6);
});

test("explicit direction wins over category", () => {
  const r = pickDirection({ direction: "brutalist", category: "salão de beleza" });
  assert.strictEqual(r.direction, "brutalist");
  assert.match(r.reasoning, /explicit/i);
});

test("throws on invalid direction", () => {
  assert.throws(() => pickDirection({ direction: "fake" }), /Invalid direction/);
});

test("category 'restaurante' → editorial or playful", () => {
  const r = pickDirection({ category: "restaurante" });
  assert.ok(["editorial", "playful"].includes(r.direction), `got ${r.direction}`);
});

test("category 'oficina mecânica' → industrial (single mapping)", () => {
  const r = pickDirection({ category: "oficina mecânica" });
  assert.strictEqual(r.direction, "industrial");
});

test("category 'salão de beleza' tie-break alphabetic when no fingerprint", () => {
  const r = pickDirection({ category: "salão de beleza" });
  // Candidates: [luxury, playful] — alphabetic: luxury
  assert.strictEqual(r.direction, "luxury");
});

test("fingerprint shifts tie-break (apple-glass → luxury when in candidates)", () => {
  const r = pickDirection({
    category: "salão de beleza",
    fingerprint: { archetype: "apple-glass" }
  });
  assert.strictEqual(r.direction, "luxury");
});

test("unknown category + no fingerprint → fallback (editorial)", () => {
  const r = pickDirection({ category: "totally-made-up-category" });
  assert.strictEqual(r.direction, "editorial");
});

test("unknown category + fingerprint hint", () => {
  const r = pickDirection({
    category: "totally-made-up",
    fingerprint: { archetype: "marketing-gradient" }
  });
  assert.strictEqual(r.direction, "playful");
});

test("fingerprintToDirection: shadcn → industrial", () => {
  assert.strictEqual(fingerprintToDirection({ archetype: "shadcn-neutral" }), "industrial");
});

test("fingerprintToDirection: apple → luxury", () => {
  assert.strictEqual(fingerprintToDirection({ archetype: "apple-glass" }), "luxury");
});

test("fingerprintToDirection: unknown → null", () => {
  assert.strictEqual(fingerprintToDirection({ archetype: "totally-novel-archetype" }), null);
});

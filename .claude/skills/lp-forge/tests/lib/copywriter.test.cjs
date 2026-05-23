"use strict";
const test = require("node:test");
const assert = require("node:assert");

const { buildCopy, extractFirstJsonObject } = require("../../lib/copywriter.cjs");

// Tests use heuristic fallback path — clear all LLM credentials so we don't burn
// real API calls. The LLM path is tested via end-to-end runs.
function clearLlmCreds() {
  const saved = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY
  };
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  return saved;
}
function restoreCreds(saved) {
  for (const [k, v] of Object.entries(saved)) {
    if (v !== undefined) process.env[k] = v;
  }
}

test("buildCopy fallback: produces required fields for all 6 directions", async () => {
  const saved = clearLlmCreds();
  try {
    for (const direction of ["editorial", "industrial", "luxury", "playful", "brutalist", "organic"]) {
      const c = await buildCopy({ businessName: "Test", direction, services: [], contact: {} });
      assert.ok(c.heroHeadline, `direction ${direction} must have heroHeadline`);
      assert.ok(c.heroSubheadline);
      assert.ok(c.heroCta);
      assert.ok(c.servicesBlock);
      assert.ok(c.aboutCopy);
      assert.ok(c.contactBlock);
      assert.strictEqual(c._source, "fallback");
    }
  } finally { restoreCreds(saved); }
});

test("buildCopy fallback: services list rendered when present", async () => {
  const saved = clearLlmCreds();
  try {
    const c = await buildCopy({
      businessName: "Test", direction: "editorial",
      services: ["Corte", "Coloração", "Manicure"],
      contact: {}
    });
    assert.match(c.servicesBlock, /Corte/);
    assert.match(c.servicesBlock, /Coloração/);
  } finally { restoreCreds(saved); }
});

test("buildCopy fallback: empty services gets fallback message, never invents", async () => {
  const saved = clearLlmCreds();
  try {
    const c = await buildCopy({ businessName: "Test", direction: "editorial", services: [], contact: {} });
    assert.match(c.servicesBlock, /conhecer nossos servi|sob consulta/i);
    assert.doesNotMatch(c.servicesBlock, /haircut|massage|tratamento de canal/i);
  } finally { restoreCreds(saved); }
});

test("buildCopy fallback: contact block omits empty fields (no invention)", async () => {
  const saved = clearLlmCreds();
  try {
    const c = await buildCopy({
      businessName: "Test", direction: "editorial", services: [],
      contact: { phone: "11 9999-9999" }
    });
    assert.match(c.contactBlock, /11 9999-9999/);
    assert.doesNotMatch(c.contactBlock, /Email/);
  } finally { restoreCreds(saved); }
});

test("buildCopy fallback: XSS guard — service names with <script> are escaped", async () => {
  const saved = clearLlmCreds();
  try {
    const c = await buildCopy({
      businessName: "Test", direction: "editorial",
      services: ["<script>alert(1)</script>"],
      contact: {}
    });
    assert.doesNotMatch(c.servicesBlock, /<script>/);
    assert.match(c.servicesBlock, /&lt;script&gt;/);
  } finally { restoreCreds(saved); }
});

test("buildCopy fallback: contact block escapes HTML in values", async () => {
  const saved = clearLlmCreds();
  try {
    const c = await buildCopy({
      businessName: "Test", direction: "editorial", services: [],
      contact: { phone: "<img src=x onerror=alert(1)>" }
    });
    assert.doesNotMatch(c.contactBlock, /<img\s+src=x\s+onerror/);
  } finally { restoreCreds(saved); }
});

test("extractFirstJsonObject: parses JSON from raw text", () => {
  assert.deepStrictEqual(extractFirstJsonObject('{"a": 1}'), { a: 1 });
});

test("extractFirstJsonObject: strips ```json fences", () => {
  assert.deepStrictEqual(extractFirstJsonObject('```json\n{"a": 1}\n```'), { a: 1 });
});

test("extractFirstJsonObject: handles preamble before JSON", () => {
  assert.deepStrictEqual(extractFirstJsonObject('Sure, here is the JSON: {"a": 2}'), { a: 2 });
});

test("extractFirstJsonObject: handles nested objects", () => {
  const r = extractFirstJsonObject('{"outer": {"inner": "val"}, "arr": [1,2,3]}');
  assert.deepStrictEqual(r, { outer: { inner: "val" }, arr: [1, 2, 3] });
});

test("extractFirstJsonObject: returns null on invalid", () => {
  assert.strictEqual(extractFirstJsonObject("no json here"), null);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { checkPhaseCache, writePhaseCache, cacheKey } = require("../../lib/cache.cjs");

function newCtx() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-cache-"));
  return {
    url: "https://example.com",
    outDir,
    lang: "pt-BR",
    provider: "openrouter",
    model: "anthropic/claude-haiku-4-5",
    direction: null
  };
}

test("cacheKey is deterministic for same context", () => {
  const ctx = newCtx();
  const k1 = cacheKey(ctx);
  const k2 = cacheKey(ctx);
  assert.strictEqual(k1, k2);
  fs.rmSync(ctx.outDir, { recursive: true, force: true });
});

test("cacheKey changes when url changes", () => {
  const a = newCtx();
  const b = { ...a, url: "https://other.com" };
  assert.notStrictEqual(cacheKey(a), cacheKey(b));
  fs.rmSync(a.outDir, { recursive: true, force: true });
});

test("checkPhaseCache returns null when no cache key written", async () => {
  const ctx = newCtx();
  const result = await checkPhaseCache("fetch-extract", ctx);
  assert.strictEqual(result, null);
  fs.rmSync(ctx.outDir, { recursive: true, force: true });
});

test("checkPhaseCache returns hit when key matches and all artifacts present", async () => {
  const ctx = newCtx();
  fs.writeFileSync(path.join(ctx.outDir, "DESIGN.md"), "# Mock");
  fs.writeFileSync(path.join(ctx.outDir, "tokens.json"), "{}");
  fs.writeFileSync(path.join(ctx.outDir, "style-fingerprint.json"), "{}");
  await writePhaseCache("fetch-extract", ctx, null);

  const result = await checkPhaseCache("fetch-extract", ctx);
  assert.ok(result, "should return cache hit");
  assert.strictEqual(result.phase, "fetch-extract");
  fs.rmSync(ctx.outDir, { recursive: true, force: true });
});

test("checkPhaseCache returns null when one artifact missing", async () => {
  const ctx = newCtx();
  fs.writeFileSync(path.join(ctx.outDir, "DESIGN.md"), "# Mock");
  // intentionally skip tokens.json
  await writePhaseCache("fetch-extract", ctx, null);

  const result = await checkPhaseCache("fetch-extract", ctx);
  assert.strictEqual(result, null);
  fs.rmSync(ctx.outDir, { recursive: true, force: true });
});

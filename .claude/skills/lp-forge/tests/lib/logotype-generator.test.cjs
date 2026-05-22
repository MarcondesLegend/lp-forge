"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { generateLogotype, writeLogotype } = require("../../lib/logotype-generator.cjs");

test("generateLogotype: produces 2 SVG variants", () => {
  const r = generateLogotype({ businessName: "Test Co" });
  assert.ok(r.defaultSvg.includes("<svg"));
  assert.ok(r.reversedSvg.includes("<svg"));
  assert.match(r.defaultSvg, /Test Co/);
});

test("generateLogotype: escapes XML special chars", () => {
  const r = generateLogotype({ businessName: "Smith & Jones <Co>" });
  assert.match(r.defaultSvg, /Smith &amp; Jones &lt;Co&gt;/);
});

test("generateLogotype: throws on empty businessName", () => {
  assert.throws(() => generateLogotype({ businessName: "" }), /businessName required/);
});

test("generateLogotype: includes tier metadata in comment", () => {
  const r = generateLogotype({ businessName: "Test", tier: 2 });
  assert.match(r.defaultSvg, /lp-forge generated-logotype tier-2/);
});

test("writeLogotype: writes 3 files to outDir/assets/brand/", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-logotype-"));
  const r = writeLogotype(outDir, { businessName: "Test Co" });

  assert.ok(fs.existsSync(r.defaultPath));
  assert.ok(fs.existsSync(r.reversedPath));
  assert.ok(fs.existsSync(path.join(outDir, "assets", "brand", "logo-source.txt")));

  const sourceTxt = fs.readFileSync(path.join(outDir, "assets", "brand", "logo-source.txt"), "utf8");
  assert.match(sourceTxt, /tier: 2/);
  assert.match(sourceTxt, /typography-logotype/);

  fs.rmSync(outDir, { recursive: true, force: true });
});

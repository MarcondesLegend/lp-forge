"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { checkBrandDrift, computeVerdict } = require("../../lib/validator.cjs");

test("computeVerdict: structural missing → fail-structural", () => {
  const v = computeVerdict({ critical: [], warning: [] }, { ok: true, ratio: 1, label: "in-sync" }, ["package.json"]);
  assert.strictEqual(v.label, "fail-structural");
});

test("computeVerdict: critical lint → fail-aesthetic", () => {
  const v = computeVerdict(
    { critical: [{ rule: "PURPLE-GRADIENT" }], warning: [] },
    { ok: true, ratio: 1, label: "in-sync" },
    []
  );
  assert.strictEqual(v.label, "fail-aesthetic");
});

test("computeVerdict: clean → returns drift label", () => {
  const v = computeVerdict({ critical: [], warning: [] }, { ok: true, ratio: 0.8, label: "in-sync" }, []);
  assert.strictEqual(v.label, "in-sync");
});

test("checkBrandDrift: high overlap → in-sync", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-drift-"));
  const redesign = path.join(tmpDir, "redesign", "app");
  fs.mkdirSync(redesign, { recursive: true });

  fs.writeFileSync(path.join(tmpDir, "brand-spec.md"), `Primary: #FF0000\nAccent: #00FF00\nInk: #000099`);
  fs.writeFileSync(path.join(redesign, "globals.css"),
    `:root { --brand-primary: #FF0000; --brand-accent: #00FF00; --brand-ink: #000099; }`);

  const r = checkBrandDrift(tmpDir, path.join(tmpDir, "redesign"));
  assert.strictEqual(r.label, "in-sync");
  assert.ok(r.ratio >= 0.6);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("checkBrandDrift: low overlap → major-drift", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-drift-"));
  const redesign = path.join(tmpDir, "redesign", "app");
  fs.mkdirSync(redesign, { recursive: true });

  fs.writeFileSync(path.join(tmpDir, "brand-spec.md"), `#AABBCC\n#DDEEFF\n#112233`);
  fs.writeFileSync(path.join(redesign, "globals.css"),
    `:root { --x: #FF0000; --y: #00FF00; --z: #0000FF; }`);

  const r = checkBrandDrift(tmpDir, path.join(tmpDir, "redesign"));
  assert.strictEqual(r.label, "major-drift");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

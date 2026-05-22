"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { lintRedesign, loadRules } = require("../../lib/aesthetic-lint.cjs");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-lint-"));
}

test("loadRules returns critical and warning arrays", () => {
  const rules = loadRules();
  assert.ok(Array.isArray(rules.critical));
  assert.ok(Array.isArray(rules.warning));
  assert.ok(rules.critical.length >= 3);
});

test("lintRedesign: clean output has no critical findings", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "page.tsx"), `
export default function Home() {
  return <main><h1>Clean Page</h1></main>;
}
`);
  const f = lintRedesign(dir);
  assert.strictEqual(f.critical.length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("lintRedesign: catches purple gradient slop", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "page.css"),
    `.hero { background: linear-gradient(135deg, #a78bfa, #ffffff); }`);
  const f = lintRedesign(dir);
  assert.ok(f.critical.some(c => c.rule === "PURPLE-GRADIENT"),
    "must catch PURPLE-GRADIENT");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("lintRedesign: catches template placeholder leftover", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "page.tsx"), `<h1>{{businessName}}</h1>`);
  const f = lintRedesign(dir);
  assert.ok(f.warning.some(w => w.rule === "PLACEHOLDER-REMAINING"));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("lintRedesign: respects threshold for warning rules", () => {
  const dir = tmpDir();
  // Just 2 hex colors — below threshold 8
  fs.writeFileSync(path.join(dir, "page.css"),
    `.a { color: #ff0000; } .b { color: #00ff00; }`);
  const f = lintRedesign(dir);
  assert.ok(!f.warning.some(w => w.rule === "PALETTE-NOISE"),
    "should not flag palette-noise below threshold");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("lintRedesign: detects 8+ distinct colors as noise", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "page.css"),
    `.a{color:#111111}.b{color:#222222}.c{color:#333333}.d{color:#444444}.e{color:#555555}.f{color:#666666}.g{color:#777777}.h{color:#888888}`);
  const f = lintRedesign(dir);
  assert.ok(f.warning.some(w => w.rule === "PALETTE-NOISE"));
  fs.rmSync(dir, { recursive: true, force: true });
});

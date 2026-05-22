// ────────────────────────────────────────────────────────────────────
//  Tests — lib/orchestrator.cjs
//  Verify phase order, stub handling, telemetry write.
// ────────────────────────────────────────────────────────────────────
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { PHASES, runOrchestrator } = require("../../lib/orchestrator.cjs");
const { EXIT_CODES } = require("../../lib/exit-codes.cjs");

test("PHASES is the exact 7-phase contract in order", () => {
  assert.strictEqual(PHASES.length, 7, "Must have exactly 7 phases");
  const expectedNames = [
    "fetch-extract", "brand-capture", "business-info",
    "direction-pick", "analysis-synth", "nextjs-generate", "validate"
  ];
  PHASES.forEach((p, i) => {
    assert.strictEqual(p.id, i + 1, `Phase index ${i} must have id ${i + 1}`);
    assert.strictEqual(p.name, expectedNames[i], `Phase index ${i} must be named ${expectedNames[i]}`);
    assert.ok(typeof p.module.run === "function", `Phase ${p.name} module must expose run()`);
  });
});

test("runOrchestrator handles remaining-stubs cleanly (skipping live phases 1-6)", async () => {
  // Phases 1-6 now real (Stories 2.2/2.3/2.4/2.5). Skip them; only stub 7 runs.
  // After Story 2.6 → all real, replace with fixture-based integration test.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-test-"));
  const ctx = {
    url: "https://example.com",
    outDir: tmpDir,
    lang: "pt-BR",
    fromPhase: 7,
    noReuse: true,
    verbosity: "silent"
  };

  const { exitCode, telemetry } = await runOrchestrator(ctx);

  assert.strictEqual(exitCode, EXIT_CODES.OK, "Phase 7 stub must succeed (exit 0)");
  assert.strictEqual(telemetry.phases.length, 7);
  for (let i = 0; i < 6; i++) {
    assert.strictEqual(telemetry.phases[i].status, "skipped-by-flag");
  }
  assert.strictEqual(telemetry.phases[6].status, "skipped-stub");

  assert.ok(fs.existsSync(path.join(tmpDir, "run-telemetry.json")), "run-telemetry.json must be written");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("runOrchestrator respects --from-phase by skipping prior phases", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-test-"));
  const ctx = {
    url: "https://example.com",
    outDir: tmpDir,
    lang: "pt-BR",
    fromPhase: 7,            // skip phases 1-6 (all real after Story 2.5)
    noReuse: true,
    verbosity: "silent"
  };

  const { exitCode, telemetry } = await runOrchestrator(ctx);

  assert.strictEqual(exitCode, EXIT_CODES.OK);
  for (let i = 0; i < 6; i++) {
    assert.strictEqual(telemetry.phases[i].status, "skipped-by-flag");
  }
  assert.strictEqual(telemetry.phases[6].status, "skipped-stub");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("runOrchestrator surfaces phase exceptions with correct exit code", async () => {
  // Simulate a failing phase by replacing one stub. Use a separate runtime override.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-test-"));

  // Temporarily monkey-patch the validator stub to throw
  const validator = require("../../lib/validator.cjs");
  const originalRun = validator.run;
  validator.run = async () => {
    const err = new Error("simulated validator failure");
    err.code = EXIT_CODES.VALIDATION_FAILED;
    throw err;
  };

  try {
    const ctx = {
      url: "https://example.com",
      outDir: tmpDir,
      lang: "pt-BR",
      fromPhase: 7,           // Skip real phases 1-5 — Stories 2.2/2.3/2.4 made them real. Story 2.5 will bump again.
      noReuse: true,
      verbosity: "silent"
    };
    const { exitCode } = await runOrchestrator(ctx);
    assert.strictEqual(exitCode, EXIT_CODES.VALIDATION_FAILED, "Failure must surface as exit code 11");
  } finally {
    validator.run = originalRun; // restore
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("runOrchestrator auto-resolves outDir from URL when not provided", async () => {
  const ctx = {
    url: "https://test-domain.com/path/segment",
    lang: "pt-BR",
    fromPhase: 7,           // Skip real phases 1-5
    noReuse: true,
    verbosity: "silent"
  };

  const { telemetry } = await runOrchestrator(ctx);

  assert.ok(telemetry.outDir.includes("outputs"), "outDir must be under outputs/");
  assert.ok(telemetry.outDir.includes("lp-forge"), "outDir must be under outputs/lp-forge/");
  assert.ok(telemetry.outDir.includes("test-domain"), "outDir slug must include domain");

  // Cleanup the auto-created dir
  fs.rmSync(telemetry.outDir, { recursive: true, force: true });
});

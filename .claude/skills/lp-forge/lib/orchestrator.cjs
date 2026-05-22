// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase Orchestrator (AC-5)
//  Sequential 7-phase runner. Each phase exposes { name, run(ctx) }.
//  Stubs return { skipped: true, reason } and orchestrator handles gracefully.
//  Emits run-telemetry.json + structured logs via logger module.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");

const { EXIT_CODES, reasonFor } = require("./exit-codes.cjs");
const { newRunId, defaultOutDir, slugifyUrl } = require("./utils.cjs");
const { initLogger } = require("./logger.cjs");
const { checkPhaseCache, writePhaseCache } = require("./cache.cjs");

// Phase modules — each exports { name, run(ctx) }
const designMdAdapter = require("./adapters/design-md-adapter.cjs");
const brandCapture = require("./brand-capture.cjs");
const businessInfo = require("./business-info.cjs");
const directionPicker = require("./direction-picker.cjs");
const analysisDoc = require("./analysis-doc.cjs");
const nextjsGenerator = require("./nextjs-generator.cjs");
const validator = require("./validator.cjs");

// Phase order is the contract. Do NOT reorder.
const PHASES = [
  { id: 1, name: "fetch-extract", module: designMdAdapter },
  { id: 2, name: "brand-capture", module: brandCapture },
  { id: 3, name: "business-info", module: businessInfo },
  { id: 4, name: "direction-pick", module: directionPicker },
  { id: 5, name: "analysis-synth", module: analysisDoc },
  { id: 6, name: "nextjs-generate", module: nextjsGenerator },
  { id: 7, name: "validate", module: validator }
];

/**
 * Resolve outDir + slug if not pre-set. Ensures the directory exists.
 */
function resolveOutputs(ctx) {
  if (!ctx.outDir) {
    ctx.outDir = defaultOutDir(ctx.url);
  }
  if (!ctx.slug) {
    ctx.slug = slugifyUrl(ctx.url);
  }
  fs.mkdirSync(ctx.outDir, { recursive: true });
  return ctx;
}

/**
 * Main runner. Sequential phases, halts on first error exit code.
 * Returns { exitCode, telemetry }.
 */
async function runOrchestrator(ctx) {
  // Bootstrap ctx
  resolveOutputs(ctx);
  ctx.runId = ctx.runId || newRunId();
  ctx.startTime = Date.now();
  ctx.phaseResults = [];

  const logger = initLogger({
    runId: ctx.runId,
    slug: ctx.slug,
    outDir: ctx.outDir,
    verbosity: ctx.verbosity
  });
  ctx.logger = logger;

  logger.info("run-start", {
    url: ctx.url,
    slug: ctx.slug,
    outDir: ctx.outDir,
    lang: ctx.lang,
    fromPhase: ctx.fromPhase,
    provider: ctx.provider || "auto",
    direction: ctx.direction || "auto"
  });

  let exitCode = EXIT_CODES.OK;

  for (const phase of PHASES) {
    if (phase.id < ctx.fromPhase) {
      logger.setPhase(phase.name);
      logger.info("phase-skip", { phase: phase.id, name: phase.name, reason: `before --from-phase=${ctx.fromPhase}` });
      ctx.phaseResults.push({
        phase: phase.id, name: phase.name, status: "skipped-by-flag", durationMs: 0
      });
      continue;
    }

    logger.setPhase(phase.name);
    const phaseStart = Date.now();

    // Cache check (stub in v0.1)
    const cached = ctx.noReuse ? null : await checkPhaseCache(phase.name, ctx);
    if (cached) {
      const dur = Date.now() - phaseStart;
      logger.info("phase-cache-hit", { phase: phase.id, name: phase.name, durationMs: dur });
      ctx.phaseResults.push({ phase: phase.id, name: phase.name, status: "cache-hit", durationMs: dur });
      continue;
    }

    // Run phase
    let result;
    try {
      logger.info("phase-start", { phase: phase.id, name: phase.name });
      result = await phase.module.run(ctx);
      const dur = Date.now() - phaseStart;

      if (result && result.skipped) {
        logger.info("phase-skip", {
          phase: phase.id, name: phase.name, durationMs: dur,
          reason: result.reason || "stub"
        });
        ctx.phaseResults.push({
          phase: phase.id, name: phase.name, status: "skipped-stub",
          durationMs: dur, reason: result.reason
        });
        continue;
      }

      logger.info("phase-done", {
        phase: phase.id, name: phase.name, durationMs: dur
      });
      ctx.phaseResults.push({
        phase: phase.id, name: phase.name, status: "ok", durationMs: dur, data: result || {}
      });

      // Cache write (stub in v0.1)
      await writePhaseCache(phase.name, ctx, result);
    } catch (err) {
      const dur = Date.now() - phaseStart;
      const code = (err && typeof err.code === "number") ? err.code : EXIT_CODES.LLM_EXHAUSTED;
      logger.error("phase-fail", {
        phase: phase.id, name: phase.name, durationMs: dur,
        error: err.message || String(err),
        exitCode: code,
        reason: reasonFor(code)
      });
      ctx.phaseResults.push({
        phase: phase.id, name: phase.name, status: "fail",
        durationMs: dur, error: err.message, exitCode: code
      });
      exitCode = code;
      break;
    }
  }

  // Telemetry write
  const totalMs = Date.now() - ctx.startTime;
  const telemetry = {
    runId: ctx.runId,
    slug: ctx.slug,
    url: ctx.url,
    lang: ctx.lang,
    outDir: ctx.outDir,
    fromPhase: ctx.fromPhase,
    exitCode,
    exitReason: reasonFor(exitCode),
    totalMs,
    phases: ctx.phaseResults,
    finishedAt: new Date().toISOString()
  };

  const telemetryPath = path.join(ctx.outDir, "run-telemetry.json");
  try {
    fs.writeFileSync(telemetryPath, JSON.stringify(telemetry, null, 2), "utf8");
    logger.info("telemetry-written", { path: telemetryPath, totalMs, exitCode });
  } catch (e) {
    logger.error("telemetry-write-failed", { path: telemetryPath, error: e.message });
  }

  logger.info("run-end", { exitCode, totalMs });
  return { exitCode, telemetry };
}

module.exports = { runOrchestrator, PHASES };

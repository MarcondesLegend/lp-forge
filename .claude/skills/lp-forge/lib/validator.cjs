// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase 7: Validator (Story 2.6)
//  Combines: aesthetic-lint final pass + brand-DNA drift check (light vs spec)
//   + structural completeness. Writes validation-report.json.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");

const { EXIT_CODES } = require("./exit-codes.cjs");
const { getLogger } = require("./logger.cjs");
const { lintRedesign } = require("./aesthetic-lint.cjs");

async function run(ctx) {
  const logger = getLogger();
  const redesignDir = path.join(ctx.outDir, "redesign");

  if (!fs.existsSync(redesignDir)) {
    logger.warn("redesign-not-found-skip", { hint: "Phase 6 may have been skipped" });
    return { skipped: true, reason: "redesign/ not present — phase 6 didn't run" };
  }

  // ── Check 1: aesthetic lint
  const lintResult = lintRedesign(redesignDir);

  // ── Check 2: brand DNA drift — comparing generated globals.css against brand-spec.md hex values
  const driftReport = checkBrandDrift(ctx.outDir, redesignDir);

  // ── Check 3: structural completeness
  const required = ["package.json", "app/layout.tsx", "app/page.tsx", "app/globals.css", "tailwind.config.ts"];
  const missing = required.filter(rel => !fs.existsSync(path.join(redesignDir, rel)));

  const verdict = computeVerdict(lintResult, driftReport, missing);
  const report = {
    runId: ctx.runId,
    slug: ctx.slug,
    timestamp: new Date().toISOString(),
    aesthetic_lint: lintResult,
    brand_drift: driftReport,
    structural_missing: missing,
    verdict
  };

  const reportPath = path.join(ctx.outDir, "validation-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  logger.info("validation-report-written", { path: reportPath, verdict: verdict.label });

  if (ctx.strict && verdict.label !== "in-sync" && verdict.label !== "minor-drift") {
    const err = new Error(`Validation failed in --strict mode: ${verdict.label} (${verdict.reason})`);
    err.code = EXIT_CODES.VALIDATION_FAILED;
    throw err;
  }

  return { validationReport: reportPath, verdict };
}

function checkBrandDrift(outDir, redesignDir) {
  const brandSpecPath = path.join(outDir, "brand-spec.md");
  const globalsPath = path.join(redesignDir, "app", "globals.css");

  if (!fs.existsSync(brandSpecPath) || !fs.existsSync(globalsPath)) {
    return { ok: false, reason: "missing-inputs" };
  }

  const spec = fs.readFileSync(brandSpecPath, "utf8");
  const css = fs.readFileSync(globalsPath, "utf8");

  // Extract hex values from spec
  const specHexes = new Set([...spec.matchAll(/#[0-9a-fA-F]{6}/g)].map(m => m[0].toLowerCase()));
  const cssHexes = new Set([...css.matchAll(/#[0-9a-fA-F]{6}/g)].map(m => m[0].toLowerCase()));

  let overlap = 0;
  for (const hex of specHexes) if (cssHexes.has(hex)) overlap++;

  const total = specHexes.size || 1;
  const ratio = overlap / total;

  let label;
  if (ratio >= 0.6) label = "in-sync";
  else if (ratio >= 0.3) label = "minor-drift";
  else if (ratio >= 0.1) label = "notable-drift";
  else label = "major-drift";

  return { ok: true, ratio, overlap, specHexes: specHexes.size, cssHexes: cssHexes.size, label };
}

function computeVerdict(lintResult, driftReport, missing) {
  if (missing.length > 0) {
    return { label: "fail-structural", reason: `missing required files: ${missing.join(", ")}` };
  }
  if (lintResult.critical.length > 0) {
    return { label: "fail-aesthetic", reason: `${lintResult.critical.length} CRITICAL lint findings` };
  }
  if (!driftReport.ok) {
    return { label: "drift-unknown", reason: driftReport.reason };
  }
  return { label: driftReport.label, reason: `brand DNA ratio ${(driftReport.ratio * 100).toFixed(0)}%` };
}

module.exports = { name: "validate", run, checkBrandDrift, computeVerdict };

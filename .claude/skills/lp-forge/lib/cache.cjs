// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase Cache (Story 2.2 full impl, Aria G-3)
//  24h TTL per phase. Cache key includes data-files mtime hash so updates
//  to category-to-direction.yaml etc. invalidate stale cached outputs.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");
const { sha256 } = require("./utils.cjs");

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DATA_FILES_FOR_HASH = [
  "data/category-to-direction.yaml",
  "data/aesthetic-lint-rules.yaml",
  "data/forbidden-fonts.yaml",
  "data/curated-font-pairs.yaml"
];

// Per-phase: which output artifacts must exist for cache to be considered hit.
const PHASE_ARTIFACTS = {
  "fetch-extract": ["DESIGN.md", "tokens.json", "style-fingerprint.json"],
  "brand-capture": ["brand-spec.md"],
  "business-info": ["business-spec.md"],
  "direction-pick": ["direction.yaml"],
  "analysis-synth": ["analysis-report.md"],
  "nextjs-generate": ["redesign/package.json"],
  "validate": ["validation-report.json"]
};

function dataFilesHash() {
  const skillRoot = path.join(__dirname, "..");
  const mtimes = [];
  for (const rel of DATA_FILES_FOR_HASH) {
    const abs = path.join(skillRoot, rel);
    try {
      const stat = fs.statSync(abs);
      mtimes.push(`${rel}:${stat.mtimeMs}`);
    } catch {
      mtimes.push(`${rel}:absent`);
    }
  }
  return sha256(mtimes.join("|"));
}

function cacheKey(ctx) {
  return sha256([
    ctx.url || "",
    ctx.lang || "",
    ctx.provider || "auto",
    ctx.model || "default",
    ctx.direction || "auto",
    dataFilesHash()
  ].join("|"));
}

function cacheKeyFile(outDir) {
  return path.join(outDir, "_cache-key.txt");
}

/**
 * Check if a phase has a fresh cache hit for the given context.
 * Returns truthy value (artifact paths) on hit, null on miss.
 */
async function checkPhaseCache(phase, ctx) {
  const artifacts = PHASE_ARTIFACTS[phase] || [];
  if (artifacts.length === 0) return null;

  // Cache key check first — invalidate if data files changed
  const expectedKey = cacheKey(ctx);
  const keyFile = cacheKeyFile(ctx.outDir);
  if (fs.existsSync(keyFile)) {
    const storedKey = fs.readFileSync(keyFile, "utf8").trim();
    if (storedKey !== expectedKey) return null;
  } else {
    return null;
  }

  // All artifacts must exist + be fresh
  for (const rel of artifacts) {
    const abs = path.join(ctx.outDir, rel);
    if (!fs.existsSync(abs)) return null;
    const stat = fs.statSync(abs);
    if (Date.now() - stat.mtimeMs > TTL_MS) return null;
  }

  return { phase, artifacts: artifacts.map(a => path.join(ctx.outDir, a)) };
}

/**
 * Write cache key after a successful phase. Output artifacts are written by
 * the phase itself; this just records the key.
 */
async function writePhaseCache(phase, ctx /* , output */) {
  void phase;
  try {
    fs.writeFileSync(cacheKeyFile(ctx.outDir), cacheKey(ctx), "utf8");
  } catch { /* best-effort */ }
}

module.exports = { checkPhaseCache, writePhaseCache, cacheKey, dataFilesHash, TTL_MS };

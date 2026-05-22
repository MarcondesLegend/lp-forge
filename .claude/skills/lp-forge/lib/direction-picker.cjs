// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase 4: Direction Picker (Story 2.4)
//  Maps business category + style fingerprint → 1 of 6 aesthetic directions.
//  Reads data/category-to-direction.yaml. Tie-break via fingerprint signals.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const { getLogger } = require("./logger.cjs");

const DIRECTIONS = ["editorial", "industrial", "luxury", "playful", "brutalist", "organic"];

let _mappingCache = null;
function loadMapping() {
  if (_mappingCache) return _mappingCache;
  const p = path.join(__dirname, "..", "data", "category-to-direction.yaml");
  if (!fs.existsSync(p)) {
    _mappingCache = { mappings: {}, fallback: "editorial" };
    return _mappingCache;
  }
  _mappingCache = yaml.load(fs.readFileSync(p, "utf8"));
  return _mappingCache;
}

function fingerprintToDirection(fingerprint) {
  if (!fingerprint || !fingerprint.archetype) return null;
  const archetype = String(fingerprint.archetype).toLowerCase();
  if (archetype.includes("shadcn") || archetype.includes("carbon")) return "industrial";
  if (archetype.includes("apple") || archetype.includes("polaris")) return "luxury";
  if (archetype.includes("gradient") || archetype.includes("marketing")) return "playful";
  if (archetype.includes("editorial") || archetype.includes("magazine")) return "editorial";
  if (archetype.includes("brutalist") || archetype.includes("raw")) return "brutalist";
  if (archetype.includes("organic") || archetype.includes("natural")) return "organic";
  return null;
}

/**
 * Pick a direction.
 * Precedence: explicit override (ctx.direction) > category mapping > fingerprint hint > fallback.
 * Returns { direction, reasoning, candidatesConsidered }.
 */
function pickDirection({ direction, category, fingerprint }) {
  if (direction) {
    if (!DIRECTIONS.includes(direction)) {
      throw new Error(`Invalid direction override: ${direction}. Must be one of: ${DIRECTIONS.join(", ")}`);
    }
    return { direction, reasoning: "explicit --direction override", candidatesConsidered: [direction] };
  }

  const mapping = loadMapping();
  let candidates = [];

  if (category) {
    const key = category.toLowerCase().trim();
    if (mapping.mappings[key]) {
      candidates = [].concat(mapping.mappings[key]);
    } else {
      // Try fuzzy partial match
      for (const k of Object.keys(mapping.mappings)) {
        if (key.includes(k) || k.includes(key)) {
          candidates = [].concat(mapping.mappings[k]);
          break;
        }
      }
    }
  }

  if (candidates.length === 0) {
    // No category match — use fingerprint hint or fallback
    const fpDir = fingerprintToDirection(fingerprint);
    if (fpDir) {
      return {
        direction: fpDir,
        reasoning: `no category match; style-fingerprint archetype "${fingerprint.archetype}" → ${fpDir}`,
        candidatesConsidered: [fpDir]
      };
    }
    return {
      direction: mapping.fallback || "editorial",
      reasoning: "no category match, no fingerprint signal — fallback direction",
      candidatesConsidered: [mapping.fallback || "editorial"]
    };
  }

  if (candidates.length === 1) {
    return {
      direction: candidates[0],
      reasoning: `category "${category}" → ${candidates[0]} (only mapped value)`,
      candidatesConsidered: candidates
    };
  }

  // Multiple candidates — break tie via fingerprint, otherwise first alphabetic
  const fpDir = fingerprintToDirection(fingerprint);
  if (fpDir && candidates.includes(fpDir)) {
    return {
      direction: fpDir,
      reasoning: `category "${category}" multi-valued [${candidates.join(", ")}]; fingerprint archetype "${fingerprint && fingerprint.archetype}" picks ${fpDir}`,
      candidatesConsidered: candidates
    };
  }

  // First-alphabetic stable choice
  const stable = candidates.slice().sort()[0];
  return {
    direction: stable,
    reasoning: `category "${category}" multi-valued [${candidates.join(", ")}]; no fingerprint match → alphabetic stable pick ${stable}`,
    candidatesConsidered: candidates
  };
}

async function run(ctx) {
  const logger = getLogger();

  // Load fingerprint from Phase 1 outputs if present
  const fpPath = path.join(ctx.outDir, "style-fingerprint.json");
  let fingerprint = null;
  if (fs.existsSync(fpPath)) {
    try { fingerprint = JSON.parse(fs.readFileSync(fpPath, "utf8")); }
    catch { /* ignore */ }
  }

  const pick = pickDirection({
    direction: ctx.direction,
    category: ctx.category,
    fingerprint
  });

  const out = {
    direction: pick.direction,
    reasoning: pick.reasoning,
    candidatesConsidered: pick.candidatesConsidered,
    fingerprint: fingerprint && fingerprint.archetype,
    category: ctx.category,
    pickedAt: new Date().toISOString()
  };

  const outPath = path.join(ctx.outDir, "direction.yaml");
  fs.writeFileSync(outPath, yaml.dump(out), "utf8");
  ctx.direction = pick.direction; // make available to phase 5+
  logger.info("direction-picked", out);
  return { direction: pick.direction, reasoning: pick.reasoning, path: outPath };
}

module.exports = { name: "direction-pick", run, pickDirection, DIRECTIONS, fingerprintToDirection };

// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase 1: design-md Adapter (Story 2.2)
//  Invokes vendored design-md via child_process spawn (Aria A-1).
//  Maps design-md exit codes to lp-forge codes. Streams logs via logger.
//  Falls back to Playwright when content-gate (exit 4) hits AND --allow-playwright.
// ────────────────────────────────────────────────────────────────────
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const { EXIT_CODES } = require("../exit-codes.cjs");
const { getLogger } = require("../logger.cjs");
const { needsEnrichment, isPlaywrightInstalled, run: runPlaywright } = require("../playwright-fallback.cjs");

const VENDOR_ROOT = path.join(__dirname, "..", "..", "vendor", "design-md");
const VENDOR_RUN = path.join(VENDOR_ROOT, "run.cjs");

async function run(ctx) {
  const logger = getLogger();

  if (!fs.existsSync(VENDOR_RUN)) {
    return { skipped: true, reason: "vendor/design-md not populated — run npm install in lp-forge" };
  }

  // Check vendored node_modules exists; postinstall should have done this.
  const vendorNm = path.join(VENDOR_ROOT, "node_modules");
  if (!fs.existsSync(vendorNm)) {
    logger.warn("vendor-deps-missing", { hint: "Run `cd vendor/design-md && npm install` or re-run lp-forge `npm install`" });
    const err = new Error("vendor/design-md/node_modules missing — install deps first");
    err.code = EXIT_CODES.HTTP_ERROR;
    throw err;
  }

  return new Promise((resolve, reject) => {
    const args = [
      VENDOR_RUN,
      "--url", ctx.url,
      "--out", ctx.outDir
    ];
    if (ctx.provider) args.push("--provider", ctx.provider);
    if (ctx.model) args.push("--model", ctx.model);

    logger.info("design-md-spawn", { cmd: "node", args });

    const proc = spawn("node", args, {
      cwd: VENDOR_ROOT,
      env: { ...process.env, DESIGN_MD_NO_HOOK: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    proc.stdout.on("data", chunk => {
      // Forward each line via logger.info under "[design-md]" prefix
      const lines = String(chunk).split("\n").filter(Boolean);
      for (const line of lines) logger.info("[design-md] " + line.trim());
    });
    proc.stderr.on("data", chunk => {
      const text = String(chunk);
      stderr += text;
      for (const line of text.split("\n").filter(Boolean)) logger.warn("[design-md] " + line.trim());
    });

    proc.on("error", (err) => {
      const e = new Error(`design-md spawn failed: ${err.message}`);
      e.code = EXIT_CODES.HTTP_ERROR;
      reject(e);
    });

    proc.on("close", async (code) => {
      const result = {
        designMd: path.join(ctx.outDir, "DESIGN.md"),
        tokens: path.join(ctx.outDir, "tokens.json"),
        fingerprint: path.join(ctx.outDir, "style-fingerprint.json"),
        stack: path.join(ctx.outDir, "stack.json"),
        pageMd: path.join(ctx.outDir, "inputs", "page.md"),
        exitCode: code
      };

      // After design-md runs (success OR partial), auto-enrich page.md if it's too thin (SPA detection).
      // This runs regardless of whether design-md fully succeeded — even if LLM failed, the static
      // outputs (CSS vars, fonts) are usually fine. The body content is what needs Playwright.
      const enrichmentAttempted = await maybeEnrichWithPlaywright(ctx, result, logger);

      if (code === 0) {
        return resolve(result);
      }

      // Map design-md exit codes to lp-forge codes
      const lpCode = mapDesignMdExitCode(code);

      // Soft-success: if design-md failed only on LLM (exit 5 or 2) but we have static outputs
      // (tokens-detected.json + page.md OR Playwright-enriched body), continue the pipeline.
      // Phases 2+ work fine without DESIGN.md if we have tokens + page content.
      const hasStaticTokens = fs.existsSync(path.join(ctx.outDir, "inputs", "tokens-detected.json"));
      const hasPageContent = fs.existsSync(result.pageMd) && fs.statSync(result.pageMd).size > 100;
      if ((code === 5 || code === 2) && hasStaticTokens && (hasPageContent || enrichmentAttempted)) {
        await synthesizeTokensFromStatic(ctx, logger);
        logger.warn("design-md-llm-failed-but-static-ok-continuing", {
          designMdExit: code,
          enrichmentAttempted,
          hasPageContent,
          note: "Continuing with static-only extraction. Analysis quality will be moderate."
        });
        return resolve(result);
      }

      if (lpCode === EXIT_CODES.CONTENT_GATE && ctx.allowPlaywright) {
        logger.info("design-md-content-gate-with-playwright-fallback", { designMdExit: code });
        try {
          await runPlaywright(ctx);
          await synthesizeTokensFromStatic(ctx, logger);
          return resolve(result);
        } catch (e) { return reject(e); }
      }

      const e = new Error(`design-md exited with code ${code}: ${stderr.trim().slice(0, 500)}`);
      e.code = lpCode;
      reject(e);
    });
  });
}

function mapDesignMdExitCode(code) {
  // design-md exit code map (from its own SKILL.md):
  // 0 success, 1 usage, 2 LLM no DESIGN.md, 4 content-gate, 5 LLM exhausted, 6 OpenRouter missing, 7 HTTP
  switch (code) {
    case 0: return EXIT_CODES.OK;
    case 1: return EXIT_CODES.USAGE_ERROR;
    case 2: return EXIT_CODES.LLM_EXHAUSTED;
    case 4: return EXIT_CODES.CONTENT_GATE;
    case 5: return EXIT_CODES.LLM_EXHAUSTED;
    case 6: return EXIT_CODES.PROVIDER_MISCONFIG;
    case 7: return EXIT_CODES.HTTP_ERROR;
    default: return EXIT_CODES.HTTP_ERROR;
  }
}

/**
 * If inputs/page.md is too thin (SPA detection) AND Playwright is available, render the page
 * and overwrite page.md with the rendered markdown.
 * Returns true if Playwright actually ran (regardless of success).
 */
async function maybeEnrichWithPlaywright(ctx, result, logger) {
  if (!needsEnrichment(result.pageMd)) return false;

  if (!isPlaywrightInstalled()) {
    logger.warn("playwright-enrich-skip", {
      reason: "page.md is thin (SPA suspected) but Playwright not installed",
      hint: "Run: cd .claude/skills/lp-forge && npm run install-playwright"
    });
    return false;
  }

  if (!ctx.allowPlaywright) {
    logger.warn("playwright-enrich-skip", {
      reason: "page.md is thin (SPA suspected) — pass --allow-playwright to enable enrichment"
    });
    return false;
  }

  logger.info("playwright-enrich-start", { reason: "page.md is too short (SPA suspected)" });
  try {
    await runPlaywright(ctx);
    return true;
  } catch (e) {
    logger.warn("playwright-enrich-failed", { error: e.message });
    return false;
  }
}

/**
 * If tokens.json is missing (because LLM failed to write DESIGN.md), synthesize a minimal one
 * from inputs/tokens-detected.json which design-md static phase 3 ALWAYS produces.
 */
async function synthesizeTokensFromStatic(ctx, logger) {
  const tokensPath = path.join(ctx.outDir, "tokens.json");
  if (fs.existsSync(tokensPath)) return;

  const detectedPath = path.join(ctx.outDir, "inputs", "tokens-detected.json");
  const fingerprintPath = path.join(ctx.outDir, "style-fingerprint.json");
  if (!fs.existsSync(detectedPath)) return;

  try {
    const detected = JSON.parse(fs.readFileSync(detectedPath, "utf8"));
    const hexes = (detected.colors && Array.isArray(detected.colors.hex)) ? detected.colors.hex : [];
    const usage = (detected.colors && detected.colors.hex_usage) || {};

    // Filter to valid brand-color candidates
    const candidates = Object.entries(usage)
      .filter(([hex, count]) => /^#[0-9a-f]{6}$/i.test(hex) && !isGrayscale(hex) && !isPureWhiteOrBlack(hex) && !isExternalChannelColor(hex) && count >= 2);

    // Score by (saturation × 2 + log(usage_count)) — brand colors are typically
    // moderately saturated AND used at least handful of times, not utility neutrals
    const scored = candidates.map(([hex, count]) => {
      const sat = saturationOf(hex);
      const score = sat * 2 + Math.log10(Math.max(count, 1));
      return { hex, count, sat, score };
    }).sort((a, b) => b.score - a.score);

    // CLI override wins (Tier 0)
    const primary = (ctx.primaryColor) ||
                    (scored[0] && scored[0].hex) ||
                    (hexes.find(h => /^#[0-9a-f]{6}$/i.test(h) && !isGrayscale(h)) || "#1A1A1A");
    const accent = (ctx.accentColor) ||
                   pickAccent(scored, primary) ||
                   "#666666";

    const tokens = {
      name: ctx.businessName || "(auto)",
      colors: {
        primary,
        accent,
        ink: "#1A1A1A",
        secondary: "#666666",
        surface: "#FFFFFF",
        background: "#F8F9FA"
      },
      typography: {},
      _meta: {
        source: "synthesized from tokens-detected.json (LLM phase 6 failed; static phase 3 ok)",
        synthesizedAt: new Date().toISOString()
      }
    };

    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), "utf8");
    logger.info("tokens-synthesized-from-static", { primary, accent, sortedCount: sorted.length });

    // Also synthesize style-fingerprint if missing — design-md prints it but doesn't always file it
    if (!fs.existsSync(fingerprintPath)) {
      const stackPath = path.join(ctx.outDir, "inputs", "stack-summary.json");
      let archetype = "unknown";
      let confidence = 0;
      if (fs.existsSync(stackPath)) {
        try {
          const stack = JSON.parse(fs.readFileSync(stackPath, "utf8"));
          archetype = stack.archetype || archetype;
          confidence = stack.archetype_confidence || confidence;
        } catch { /* best effort */ }
      }
      fs.writeFileSync(fingerprintPath, JSON.stringify({ archetype, confidence, _meta: { synthesized: true } }, null, 2), "utf8");
    }
  } catch (e) {
    logger.warn("tokens-synthesis-failed", { error: e.message });
  }
}

/**
 * Saturation (0-1) of a 6-digit hex via HSL conversion.
 * Brand colors typically have moderate-to-high saturation (>0.3); UI neutrals are <0.15.
 */
function saturationOf(hex) {
  const h = hex.toLowerCase().replace("#", "");
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return 0; // achromatic
  const d = max - min;
  return lightness > 0.5 ? d / (2 - max - min) : d / (max + min);
}

/**
 * Pick accent: top-scored color that's NOT a near-shade of primary.
 * Returns null if no good candidate.
 */
function pickAccent(scored, primary) {
  for (const c of scored) {
    if (c.hex === primary) continue;
    if (hexDistance(c.hex, primary) > 60) return c.hex;
  }
  return null;
}

/**
 * Euclidean distance between 2 hex colors in RGB space. 0-441 range.
 */
function hexDistance(a, b) {
  const ax = parseHex(a), bx = parseHex(b);
  if (!ax || !bx) return 999;
  return Math.sqrt(
    (ax.r - bx.r) ** 2 + (ax.g - bx.g) ** 2 + (ax.b - bx.b) ** 2
  );
}
function parseHex(hex) {
  const h = hex.toLowerCase().replace("#", "");
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function isPureWhiteOrBlack(hex) {
  const h = hex.toLowerCase();
  return h === "#000000" || h === "#ffffff";
}

// Colors known to belong to external channel widgets (WhatsApp, Facebook, etc.) —
// these often saturate hex_usage counts when the site has floating chat buttons,
// but they are NOT the brand color. Excluded from primary/accent candidates.
const EXTERNAL_CHANNEL_HEXES = new Set([
  "#25d366", // WhatsApp green
  "#1ebea5",
  "#128c7e", // WhatsApp dark
  "#075e54",
  "#3b5998", // Facebook blue
  "#1877f2", // Facebook newer blue
  "#1da1f2", // Twitter blue
  "#e1306c", // Instagram pink
  "#ff0000", // YouTube red
  "#ff5722"  // Often Telegram/share buttons
]);

function isExternalChannelColor(hex) {
  return EXTERNAL_CHANNEL_HEXES.has(hex.toLowerCase());
}

function isGrayscale(hex) {
  // #RRGGBB — compare R≈G≈B (tolerance 15)
  if (!hex.startsWith("#")) return false;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
}

module.exports = { name: "fetch-extract", run, mapDesignMdExitCode };

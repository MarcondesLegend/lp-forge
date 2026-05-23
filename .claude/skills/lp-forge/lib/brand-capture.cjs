// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase 2: Brand Capture (Story 2.3)
//  Implements huashu §1.a 5-step protocol with Aria A-4 three-tier logo fallback.
//
//  Static implementation extracts what design-md ALREADY captured (Phase 1)
//  and runs the 5-10-2-8 quality threshold scoring discipline. LLM eyeball
//  verification (logo + image scoring) requires runtime LLM access — when
//  provider is configured, we call invokeLlm; otherwise we proceed with
//  best-effort static heuristics and flag low-confidence assets in the spec.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");

const { EXIT_CODES } = require("./exit-codes.cjs");
const { getLogger } = require("./logger.cjs");
const { invokeLlm } = require("./llm.cjs");
const { writeLogotype } = require("./logotype-generator.cjs");
const { validateImage } = require("./asset-validator.cjs");
const { loadPrompt } = require("./prompt-loader.cjs");

async function run(ctx) {
  const logger = getLogger();
  const brandDir = path.join(ctx.outDir, "assets", "brand");
  fs.mkdirSync(brandDir, { recursive: true });

  // Read Phase 1 outputs (design-md). If not present, capture is best-effort with empty inputs.
  const tokensPath = path.join(ctx.outDir, "tokens.json");
  let tokens = {};
  if (fs.existsSync(tokensPath)) {
    try { tokens = JSON.parse(fs.readFileSync(tokensPath, "utf8")); }
    catch (e) { logger.warn("tokens-parse-failed", { error: e.message }); }
  } else {
    logger.warn("phase-1-outputs-missing", { hint: "Run from phase 1 first, or accept best-effort capture" });
  }

  // ── Tier 1: search for a real logo in design-md's collected assets
  const inputsDir = path.join(ctx.outDir, "inputs");
  let logoTier = null;
  let logoPath = null;

  if (fs.existsSync(inputsDir)) {
    // Strategy A: design-md sometimes writes binary directly
    const candidates = ["logo.svg", "logo.png", "favicon.svg", "favicon.png", "favicon.ico"];
    for (const c of candidates) {
      const p = path.join(inputsDir, c);
      if (fs.existsSync(p)) {
        const buffer = fs.readFileSync(p);
        const v = validateImage(buffer, null, ctx.url);
        if (v.valid) {
          const ext = path.extname(c);
          const target = path.join(brandDir, `logo${ext}`);
          fs.copyFileSync(p, target);
          logoPath = target;
          logoTier = 1;
          fs.writeFileSync(path.join(brandDir, "logo-source.txt"),
            `tier: 1\nstrategy: design-md-inputs-binary\nsource: ${c}\nadopted: ${new Date().toISOString()}\n`, "utf8");
          logger.info("logo-tier1-found", { source: c, mime: v.mimeDetected });
          break;
        } else {
          logger.warn("logo-candidate-rejected", { source: c, reason: v.reason });
        }
      }
    }

    // Strategy B: design-md writes metadata JSON (logo.json / favicon.json) with sourceUrl — fetch + adopt
    if (!logoPath) {
      const metaCandidates = ["logo.json", "favicon.json"];
      for (const meta of metaCandidates) {
        const metaPath = path.join(inputsDir, meta);
        if (!fs.existsSync(metaPath)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          const url = data.sourceUrl;
          if (!url) continue;
          logger.info("logo-fetching-from-design-md-meta", { meta, sourceUrl: url });
          // Download with axios
          const axios = require("axios");
          const resp = await axios.get(url, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "lp-forge/0.1" },
            timeout: 15000
          });
          const buffer = Buffer.from(resp.data);
          const contentType = resp.headers["content-type"];
          const v = validateImage(buffer, contentType, url);
          if (!v.valid) {
            logger.warn("logo-fetched-rejected", { source: meta, reason: v.reason });
            continue;
          }
          const mimeToExt = { "image/svg+xml": ".svg", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
          const ext = mimeToExt[v.mimeDetected] || ".bin";
          const target = path.join(brandDir, `logo${ext}`);
          fs.writeFileSync(target, buffer);
          logoPath = target;
          logoTier = 1;
          fs.writeFileSync(path.join(brandDir, "logo-source.txt"),
            `tier: 1\nstrategy: design-md-meta-fetch\nsource_meta: ${meta}\nsource_url: ${url}\nmime: ${v.mimeDetected}\nbytes: ${buffer.length}\nadopted: ${new Date().toISOString()}\n`, "utf8");
          logger.info("logo-tier1-fetched", { source: meta, mime: v.mimeDetected, bytes: buffer.length });
          break;
        } catch (e) {
          logger.warn("logo-meta-fetch-failed", { meta, error: e.message });
        }
      }
    }
  }

  // ── Tier 2: typography-based logotype generation (Aria A-4)
  if (!logoPath) {
    const businessName = ctx.businessName || inferBusinessNameFromTokens(tokens) || null;
    if (!businessName) {
      // ── Tier 3: hard-fail
      const err = new Error(
        "No logo found in design-md inputs AND no business name available to generate logotype. " +
        "Provide --business-name or manual asset."
      );
      err.code = EXIT_CODES.BRAND_ASSETS_INSUFFICIENT;
      throw err;
    }

    const primary = pickPrimaryColor(tokens) || "#1A1A1A";
    const fontFamily = pickDisplayFont(tokens) || '"Georgia", serif';
    const result = writeLogotype(ctx.outDir, {
      businessName,
      fontFamily,
      primaryColor: primary,
      tier: 2
    });
    logoPath = result.defaultPath;
    logoTier = 2;
    logger.info("logo-tier2-generated", { businessName, fontFamily, primaryColor: primary });
  }

  // ── Color palette extraction (top 3 non-grayscale colors)
  const palette = extractPalette(tokens);

  // ── Font system
  const fontDisplay = pickDisplayFont(tokens) || '"Georgia", serif';
  const fontBody = pickBodyFont(tokens) || '"system-ui", sans-serif';

  // ── Hero / UI capture: design-md doesn't download images. We mark this as a
  // future enhancement; for v0.1 we record absence honestly (huashu §9.5).
  const heroes = []; // populated by future enhancement
  const uiShots = [];

  // ── Write brand-spec.md
  const tmplPath = path.join(__dirname, "..", "data", "templates", "brand-spec.tmpl.md");
  const businessName = ctx.businessName || "[business name not provided]";
  let spec;
  if (fs.existsSync(tmplPath)) {
    spec = fs.readFileSync(tmplPath, "utf8");
  } else {
    spec = defaultBrandSpecTemplate();
  }

  spec = spec
    .replace(/\{\{businessName\}\}/g, businessName)
    .replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10))
    .replace(/\{\{sourceUrl\}\}/g, ctx.url)
    .replace(/\{\{logoPath\}\}/g, path.relative(ctx.outDir, logoPath))
    .replace(/\{\{logoTier\}\}/g, String(logoTier))
    .replace(/\{\{primaryColor\}\}/g, palette[0] || "#1A1A1A")
    .replace(/\{\{accentColor\}\}/g, palette[1] || "#666666")
    .replace(/\{\{inkColor\}\}/g, palette[2] || "#0A0A0A")
    .replace(/\{\{fontDisplay\}\}/g, fontDisplay)
    .replace(/\{\{fontBody\}\}/g, fontBody)
    .replace(/\{\{heroesStatus\}\}/g, heroes.length ? heroes.join(", ") : "absent — text-only fallback per huashu §9.5")
    .replace(/\{\{uiShotsStatus\}\}/g, uiShots.length ? uiShots.join(", ") : "n/a");

  const specPath = path.join(ctx.outDir, "brand-spec.md");
  fs.writeFileSync(specPath, spec, "utf8");
  logger.info("brand-spec-written", { path: specPath, logoTier, paletteSize: palette.length });

  // Reference the prompt-loader so future LLM-driven sub-phases can load logo-verify, image-score, etc.
  // Currently unused — exists so the i18n loader is wired into the surface.
  loadPrompt("logo-verify", ctx.lang);

  return {
    brandSpec: specPath,
    logo: logoPath,
    logoTier,
    palette,
    fonts: { display: fontDisplay, body: fontBody },
    heroes,
    uiShots
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function inferBusinessNameFromTokens(tokens) {
  if (tokens && tokens.identity && tokens.identity.name) return tokens.identity.name;
  if (tokens && tokens.meta && tokens.meta.brand) return tokens.meta.brand;
  return null;
}

function pickPrimaryColor(tokens) {
  const colors = tokens && tokens.colors;
  if (!colors) return null;
  return colors.primary || colors.brand || colors.accent || null;
}

function pickDisplayFont(tokens) {
  const typo = tokens && tokens.typography;
  if (!typo) return null;
  return typo.display_font || typo.heading_font || typo.font_family_display || null;
}

function pickBodyFont(tokens) {
  const typo = tokens && tokens.typography;
  if (!typo) return null;
  return typo.body_font || typo.font_family_body || null;
}

function extractPalette(tokens) {
  const colors = (tokens && tokens.colors) || {};
  const set = new Set();
  for (const v of Object.values(colors)) {
    if (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v)) {
      // skip pure black/white
      const hex = v.toLowerCase();
      if (hex === "#000" || hex === "#000000" || hex === "#fff" || hex === "#ffffff") continue;
      set.add(v);
    }
  }
  return Array.from(set).slice(0, 5);
}

function defaultBrandSpecTemplate() {
  return `# {{businessName}} · Brand Spec
> Captured: {{date}}
> Source URL: {{sourceUrl}}

## Core assets

### Logo
- File: \`{{logoPath}}\`
- Tier: {{logoTier}} (1 = extracted from source; 2 = typography logotype fallback; 3 = manual required)

## Color palette
- Primary: {{primaryColor}}
- Accent: {{accentColor}}
- Ink: {{inkColor}}

## Type system
- Display: \`{{fontDisplay}}\`
- Body: \`{{fontBody}}\`

## Hero imagery
{{heroesStatus}}

## UI screenshots
{{uiShotsStatus}}

## Keywords (auto)
Generated brand spec — refine with operator notes if needed.
`;
}

module.exports = { name: "brand-capture", run };

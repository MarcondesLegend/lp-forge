// ────────────────────────────────────────────────────────────────────
//  lp-forge — Phase 6: Next.js Generator (Story 2.5)
//  Generates a runnable Next.js 15 app under outDir/redesign/ with:
//   - direction-aware Tailwind overlay (Aria A-3)
//   - brand assets wired from outDir/assets/brand/ → redesign/public/brand/
//   - copy grounded in business-spec.md (zero invention)
//   - audit watermark (Aria A-9)
//   - SEO metadata (Aria G-2)
//   - escaped copy (Aria A-6.3 XSS guard via React default escaping)
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const { EXIT_CODES } = require("./exit-codes.cjs");
const { getLogger } = require("./logger.cjs");
const { buildCopy } = require("./copywriter.cjs");
const { lintRedesign } = require("./aesthetic-lint.cjs");

const TEMPLATES_BASE = path.join(__dirname, "..", "templates", "nextjs-base");
const DIRECTIONS_DIR = path.join(__dirname, "..", "templates", "directions");
const SKILL_PACKAGE = require("../package.json");

async function run(ctx) {
  const logger = getLogger();

  // Read prior phase outputs
  const businessInfoPath = path.join(ctx.outDir, "business-info.json");
  const brandSpecPath = path.join(ctx.outDir, "brand-spec.md");
  const directionPath = path.join(ctx.outDir, "direction.yaml");

  if (!fs.existsSync(businessInfoPath) || !fs.existsSync(brandSpecPath)) {
    const err = new Error("nextjs-generator: missing brand-spec.md or business-info.json from prior phases.");
    err.code = EXIT_CODES.NEXTJS_GENERATION_ERROR;
    throw err;
  }

  const businessInfo = JSON.parse(fs.readFileSync(businessInfoPath, "utf8")).info || {};
  const directionData = fs.existsSync(directionPath) ? yaml.load(fs.readFileSync(directionPath, "utf8")) : { direction: ctx.direction || "editorial" };
  const direction = directionData.direction || ctx.direction || "editorial";

  const tokensPath = path.join(ctx.outDir, "tokens.json");
  const tokens = fs.existsSync(tokensPath) ? safeJson(fs.readFileSync(tokensPath, "utf8")) : {};

  // Resolve brand variables
  const palette = extractPalette(tokens, ctx);
  const fonts = pickFonts(tokens, direction);
  const slug = ctx.slug || "redesign";
  const businessName = businessInfo.businessName || ctx.businessName || "Negócio";

  const redesignDir = path.join(ctx.outDir, "redesign");
  fs.mkdirSync(redesignDir, { recursive: true });
  fs.mkdirSync(path.join(redesignDir, "app"), { recursive: true });
  fs.mkdirSync(path.join(redesignDir, "components"), { recursive: true });
  fs.mkdirSync(path.join(redesignDir, "public", "brand"), { recursive: true });

  // Build copy bundle (LLM-driven primary, fallback heuristic) — needs pageContent for grounding
  const pageMd = (() => { try { return fs.readFileSync(path.join(ctx.outDir, "inputs", "page.md"), "utf8"); } catch { return ""; } })();
  const copy = await buildCopy({
    businessName,
    services: businessInfo.services || [],
    contact: businessInfo.contact || {},
    hours: businessInfo.hours || {},
    socialProof: businessInfo.socialProof || [],
    category: businessInfo.category || ctx.category,
    city: businessInfo.city || ctx.city,
    direction,
    pageContent: pageMd,
    provider: ctx.provider,
    model: ctx.model,
    lang: ctx.lang || "pt-BR"
  });
  logger.info("copywriter-source", { source: copy._source });

  // ── Render templates ──
  const seoTitle = `${businessName} — ${copy.heroSubheadline.split("\n")[0]}`.slice(0, 60);
  const seoDescription = inferSeoDescription(businessInfo, businessName).slice(0, 160);

  const ctxVars = {
    slug,
    businessName: jsonStringSafe(businessName),
    primaryColor: palette.primary,
    accentColor: palette.accent,
    inkColor: palette.ink,
    surfaceColor: palette.surface,
    fontDisplay: fonts.display,
    fontBody: fonts.body,
    seoTitle: jsonStringSafe(seoTitle),
    seoDescription: jsonStringSafe(seoDescription),
    ogLocale: ctx.lang === "pt-BR" ? "pt_BR" : "en_US",
    htmlLang: ctx.lang || "pt-BR",
    ogImage: "/brand/logo.svg",
    lpForgeVersion: SKILL_PACKAGE.version,
    sourceUrl: ctx.url,
    generatedAt: new Date().toISOString(),
    brandAssetsMode: "extracted-or-logotype-fallback",
    direction,
    runId: ctx.runId || "n/a",
    // copy
    heroHeadline: jsxStringSafe(copy.heroHeadline),
    heroSubheadline: jsxStringSafe(copy.heroSubheadline),
    heroCta: jsxStringSafe(copy.heroCta),
    servicesBlock: copy.servicesBlock,
    aboutCopy: jsxStringSafe(copy.aboutCopy),
    contactBlock: copy.contactBlock
  };

  // Copy base templates (.tmpl rendered, others copied)
  copyTemplate(path.join(TEMPLATES_BASE, "package.json.tmpl"), path.join(redesignDir, "package.json"), ctxVars);
  copyTemplate(path.join(TEMPLATES_BASE, "tsconfig.json"), path.join(redesignDir, "tsconfig.json"), null);
  copyTemplate(path.join(TEMPLATES_BASE, "next.config.mjs"), path.join(redesignDir, "next.config.mjs"), null);
  copyTemplate(path.join(TEMPLATES_BASE, "postcss.config.mjs"), path.join(redesignDir, "postcss.config.mjs"), null);
  copyTemplate(path.join(TEMPLATES_BASE, "tailwind.config.ts"), path.join(redesignDir, "tailwind.config.ts"), null);
  copyTemplate(path.join(TEMPLATES_BASE, "app", "layout.tsx.tmpl"), path.join(redesignDir, "app", "layout.tsx"), ctxVars);
  copyTemplate(path.join(TEMPLATES_BASE, "app", "page.tsx.tmpl"), path.join(redesignDir, "app", "page.tsx"), ctxVars);

  // globals.css = base template + direction overlay appended
  const baseGlobals = renderTemplate(fs.readFileSync(path.join(TEMPLATES_BASE, "app", "globals.css.tmpl"), "utf8"), ctxVars);
  const overlayPath = path.join(DIRECTIONS_DIR, direction, "globals.append.css");
  const overlay = fs.existsSync(overlayPath) ? fs.readFileSync(overlayPath, "utf8") : "";
  fs.writeFileSync(path.join(redesignDir, "app", "globals.css"), baseGlobals + "\n\n" + overlay, "utf8");

  // Copy brand assets
  const srcBrand = path.join(ctx.outDir, "assets", "brand");
  if (fs.existsSync(srcBrand)) {
    for (const f of fs.readdirSync(srcBrand)) {
      const src = path.join(srcBrand, f);
      const dst = path.join(redesignDir, "public", "brand", f);
      try {
        if (fs.statSync(src).isFile()) fs.copyFileSync(src, dst);
      } catch (e) { logger.warn("brand-asset-copy-failed", { file: f, error: e.message }); }
    }
  }

  // Generate redesign/README.md with audit + copyright disclaimer (Aria G-4)
  writeRedesignReadme(redesignDir, { businessName, sourceUrl: ctx.url, direction, generatedAt: ctxVars.generatedAt });

  // Run aesthetic lint on generated output (Story 2.5 AC-11 + AC-18 indirect)
  const lintResult = lintRedesign(redesignDir);
  fs.writeFileSync(path.join(ctx.outDir, "aesthetic-lint.json"), JSON.stringify(lintResult, null, 2), "utf8");

  if (lintResult.critical.length > 0 && ctx.strict) {
    const err = new Error(
      `Aesthetic lint flagged ${lintResult.critical.length} CRITICAL issues; --strict mode aborted generation. ` +
      `See aesthetic-lint.json for details.`
    );
    err.code = EXIT_CODES.NEXTJS_GENERATION_ERROR;
    throw err;
  }
  if (lintResult.critical.length > 0) {
    logger.warn("aesthetic-lint-critical", { count: lintResult.critical.length, rules: lintResult.critical.map(c => c.rule) });
  }

  logger.info("nextjs-generated", {
    redesignDir,
    direction,
    paletteUsed: palette,
    fontsUsed: fonts,
    lintCritical: lintResult.critical.length,
    lintWarning: lintResult.warning.length
  });

  return { redesignDir, direction, lintResult };
}

// ── Helpers ──

function copyTemplate(srcPath, dstPath, ctx) {
  const content = fs.readFileSync(srcPath, "utf8");
  fs.writeFileSync(dstPath, ctx ? renderTemplate(content, ctx) : content, "utf8");
}

function renderTemplate(template, ctx) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => ctx[key] !== undefined ? String(ctx[key]) : m);
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }

function extractPalette(tokens, ctx) {
  const colors = (tokens && tokens.colors) || {};
  // CLI override (Tier 0) > token-derived > fallback default
  const palette = {
    primary: (ctx && ctx.primaryColor) || colors.primary || colors.brand || "#1A1A1A",
    accent: (ctx && ctx.accentColor) || colors.accent || colors.secondary || "#666666",
    ink: colors.ink || colors.foreground || "#0A0A0A",
    surface: colors.surface || colors.background || "#FFFFFF"
  };
  return palette;
}

function pickFonts(tokens, direction) {
  const typo = (tokens && tokens.typography) || {};
  let display = typo.display_font || typo.heading_font;
  let body = typo.body_font;

  // Check forbidden — load via require
  let forbidden = ["Inter", "Roboto", "Arial", "Helvetica", "system-ui", "-apple-system"];
  try {
    const ff = require("js-yaml").load(fs.readFileSync(path.join(__dirname, "..", "data", "forbidden-fonts.yaml"), "utf8"));
    if (ff && ff.display_forbidden) forbidden = ff.display_forbidden;
  } catch { /* use defaults */ }

  if (!display || forbidden.some(f => String(display).toLowerCase().includes(String(f).toLowerCase()))) {
    // Pick from curated pairs
    try {
      const pairs = require("js-yaml").load(fs.readFileSync(path.join(__dirname, "..", "data", "curated-font-pairs.yaml"), "utf8"));
      const dirPairs = pairs[direction] || pairs.editorial;
      if (dirPairs && dirPairs.length > 0) {
        const pick = dirPairs[0]; // deterministic — first option
        display = pick.display;
        body = pick.body;
      }
    } catch { /* use defaults below */ }
  }

  return {
    display: display || '"Georgia", serif',
    body: body || '"system-ui", -apple-system, sans-serif'
  };
}

function inferSeoDescription(info, name) {
  const parts = [name];
  if (info.category) parts.push(info.category);
  if (info.city) parts.push(`em ${info.city}`);
  if (Array.isArray(info.services) && info.services.length) {
    parts.push("Serviços: " + info.services.slice(0, 3).join(", "));
  }
  return parts.join(". ");
}

function jsxStringSafe(s) {
  return String(s).replace(/[{}]/g, c => c === "{" ? "&#123;" : "&#125;");
}

function jsonStringSafe(s) {
  return String(s).replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n");
}

function writeRedesignReadme(redesignDir, opts) {
  const md = `# ${opts.businessName} — Redesigned by lp-forge

Generated by [lp-forge](https://github.com/anthropics/claude-code) on ${opts.generatedAt.slice(0, 10)}.
- **Source URL:** ${opts.sourceUrl}
- **Aesthetic direction:** \`${opts.direction}\`

## Run

\`\`\`bash
npm install
npm run dev
# open http://localhost:3000
\`\`\`

## Deploy to Vercel

\`\`\`bash
npx vercel
\`\`\`

First-time Vercel use requires interactive authentication.

## ⚠️ Copyright & Asset Usage

Brand assets in \`public/brand/\` (logo, hero images, UI screenshots) were extracted from \`${opts.sourceUrl}\`
on ${opts.generatedAt.slice(0, 10)} for the purpose of redesigning the same business's online presence.

**The operator is responsible for confirming permission to use these assets in production deployment.**

## What was generated

- \`app/layout.tsx\` — root layout with SEO metadata + audit watermark
- \`app/page.tsx\` — hero, services, about, contact (copy grounded in business-spec.md)
- \`app/globals.css\` — brand tokens + Tailwind base + direction overlay
- \`tailwind.config.ts\` — references CSS custom properties for brand colors/fonts
- \`public/brand/\` — extracted or generated brand assets

## CMS-able edit points

To update copy without touching code:
- **Hero headline / subhead** → \`app/page.tsx\` lines containing \`{{heroHeadline}}\` etc. (template-rendered values)
- **Services list** → re-run \`lp-forge\` with updated business-spec
- **Brand colors** → \`app/globals.css\` \`:root\` block
`;
  fs.writeFileSync(path.join(redesignDir, "README.md"), md, "utf8");
}

module.exports = { name: "nextjs-generate", run, renderTemplate };

// ────────────────────────────────────────────────────────────────────
//  lp-forge — Typography-based Logotype Generator (Story 2.3, Aria A-4 Tier 2)
//  Fallback when no real logo extractable. Renders <businessName> as SVG
//  with brand display font + primary color. Same approach Stripe/Linear use.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_FONT_FAMILY = '"Georgia", "Times New Roman", serif';
const DEFAULT_PRIMARY = "#1A1A1A";
const DEFAULT_BACKGROUND = "transparent";

/**
 * Generate a 2-variant SVG logotype (default + reversed) from business name.
 * Returns { defaultSvg, reversedSvg, metadata }.
 */
function generateLogotype({ businessName, fontFamily, primaryColor, background, tier = 2 } = {}) {
  if (!businessName || typeof businessName !== "string") {
    throw new Error("logotype-generator: businessName required");
  }

  const font = fontFamily || DEFAULT_FONT_FAMILY;
  const fg = primaryColor || DEFAULT_PRIMARY;
  const bg = background || DEFAULT_BACKGROUND;
  const name = businessName.trim();

  // Heuristic width: ~0.55em per char in serif-ish display.
  const fontSize = 56;
  const padding = 24;
  const charW = fontSize * 0.55;
  const estimatedTextW = Math.max(name.length * charW, 120);
  const width = Math.round(estimatedTextW + padding * 2);
  const height = Math.round(fontSize + padding * 2);
  const ts = new Date().toISOString();

  const headerComment = `<!-- lp-forge generated-logotype tier-${tier}: typography-based fallback, no source logo found at ${ts} -->`;

  function svg(textColor, bgFill) {
    return `<?xml version="1.0" encoding="UTF-8"?>
${headerComment}
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(name)}">
  ${bgFill && bgFill !== "transparent" ? `<rect width="${width}" height="${height}" fill="${bgFill}"/>` : ""}
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
        font-family='${font.replace(/"/g, "'")}' font-size="${fontSize}" font-weight="700"
        fill="${textColor}" letter-spacing="-0.02em">
    ${escapeXml(name)}
  </text>
</svg>
`;
  }

  return {
    defaultSvg: svg(fg, bg),
    reversedSvg: svg("#FFFFFF", fg),
    metadata: { tier, businessName: name, fontFamily: font, primaryColor: fg, background: bg, width, height }
  };
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate + write SVG files to outDir/assets/brand/.
 */
function writeLogotype(outDir, opts) {
  const result = generateLogotype(opts);
  const brandDir = path.join(outDir, "assets", "brand");
  fs.mkdirSync(brandDir, { recursive: true });
  const defaultPath = path.join(brandDir, "logo.svg");
  const reversedPath = path.join(brandDir, "logo-white.svg");
  fs.writeFileSync(defaultPath, result.defaultSvg, "utf8");
  fs.writeFileSync(reversedPath, result.reversedSvg, "utf8");
  fs.writeFileSync(
    path.join(brandDir, "logo-source.txt"),
    `tier: ${result.metadata.tier}\nstrategy: typography-logotype\nbusinessName: ${result.metadata.businessName}\nfontFamily: ${result.metadata.fontFamily}\nprimaryColor: ${result.metadata.primaryColor}\ngenerated: ${new Date().toISOString()}\n`,
    "utf8"
  );
  return { defaultPath, reversedPath, metadata: result.metadata };
}

module.exports = { generateLogotype, writeLogotype };

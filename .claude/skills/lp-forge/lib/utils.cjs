// ────────────────────────────────────────────────────────────────────
//  lp-forge — Utilities (AC-8)
//  slugifyUrl semantics adapted from design-md/lib/utils.cjs
//  DO NOT diverge without updating both. Vendoring (Story 2.2) will
//  replace this with a hybrid require() of vendor/design-md/lib/utils.cjs.
// ────────────────────────────────────────────────────────────────────
"use strict";

const crypto = require("crypto");
const path = require("path");

/**
 * Compute a URL slug that captures subdomain + first 4 path segments.
 * Strips `www.`; uses `-` as separator; caps at 80 chars.
 *
 * Examples:
 *   https://www.anthropic.com/                → anthropic
 *   https://www.shopify.com/br/enterprise     → shopify-br-enterprise
 *   https://brand.acme.com/brandbook/guide    → acme-brand-brandbook-guide
 *   https://app.linear.app/                   → linear-app
 */
function slugifyUrl(url) {
  let u;
  try { u = new URL(url); }
  catch { throw new Error(`Invalid URL: ${url}`); }

  // Hostname parts (strip www.)
  const hostParts = u.hostname.replace(/^www\./i, "").split(".");
  // Reverse to get TLD-first then walk forward, but for slug we want company-first.
  // Standard pattern: take the SLD (second-level) + collect non-www subdomains.
  // For "brand.acme.com" → ["brand", "acme", "com"] → company is "acme", subdomain "brand"
  // For "app.linear.app" → ["app", "linear", "app"] → company is "linear", subdomain "app"
  // For "anthropic.com" → ["anthropic", "com"] → company is "anthropic"
  let company, subdomains = [];
  if (hostParts.length >= 2) {
    company = hostParts[hostParts.length - 2];
    subdomains = hostParts.slice(0, hostParts.length - 2);
  } else {
    company = hostParts[0] || "unknown";
  }

  // Path segments — first 4, non-empty
  const pathParts = u.pathname.split("/").filter(Boolean).slice(0, 4);

  // Build slug
  const tokens = [company, ...subdomains, ...pathParts]
    .map(t => slugifyToken(t))
    .filter(Boolean);

  let slug = tokens.join("-");
  if (slug.length > 80) slug = slug.slice(0, 80).replace(/-$/, "");
  return slug || "unknown";
}

function slugifyToken(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Stable run identifier (uuid-ish) for telemetry/logging.
 */
function newRunId() {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Resolve default output directory for a URL.
 * Mirrors design-md's contract: outputs/lp-forge/{slug}/ relative to CWD.
 */
function defaultOutDir(url, cwd = process.cwd()) {
  return path.join(cwd, "outputs", "lp-forge", slugifyUrl(url));
}

/**
 * Sha256 hex of a string — used by cache keys (Story 2.2).
 */
function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

module.exports = { slugifyUrl, slugifyToken, newRunId, defaultOutDir, sha256 };

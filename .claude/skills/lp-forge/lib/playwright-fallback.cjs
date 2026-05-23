// ────────────────────────────────────────────────────────────────────
//  lp-forge — Playwright Fallback (real implementation)
//
//  Activates when:
//   (a) design-md exits 4 (content-gate) AND --allow-playwright, OR
//   (b) post-phase-1: page.md is < MIN_BODY_CHARS (SPA detection)
//
//  What it does:
//   1. Launches headless chromium
//   2. Navigates to URL with reasonable timeout
//   3. Waits for network idle + 2s settle
//   4. Captures: rendered HTML + full-page screenshot
//   5. Converts HTML body to markdown via turndown
//   6. Writes inputs/page.md (overwrites design-md's empty version)
//   7. Writes inputs/rendered.html + screenshot
//
//  Aria A-2: optionalDependencies — falls back gracefully if not installed.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");

const { EXIT_CODES } = require("./exit-codes.cjs");
const { getLogger } = require("./logger.cjs");
const { validateImage } = require("./asset-validator.cjs");

const MIN_BODY_CHARS = 200;
const NAV_TIMEOUT_MS = 30000;
const SETTLE_MS = 2000;
const VIEWPORT = { width: 1280, height: 800 };

function isPlaywrightInstalled() {
  try { require.resolve("playwright"); return true; }
  catch { return false; }
}

function isTurndownInstalled() {
  try { require.resolve("turndown"); return true; }
  catch { return false; }
}

/**
 * Run Playwright capture. Returns { rendered, screenshot, markdown, bytes }.
 * If ctx.pageMdPath is provided, OVERWRITES it with the rendered markdown.
 */
async function run(ctx) {
  const logger = getLogger();

  if (!isPlaywrightInstalled()) {
    const err = new Error(
      "Playwright fallback requested but Playwright not installed. " +
      "Run: cd .claude/skills/lp-forge && npm run install-playwright"
    );
    err.code = EXIT_CODES.PLAYWRIGHT_NOT_INSTALLED;
    throw err;
  }

  const { chromium } = require("playwright");
  const TurndownService = isTurndownInstalled() ? require("turndown") : null;
  if (!TurndownService) {
    logger.warn("turndown-missing", { hint: "markdown conversion will be skipped" });
  }

  logger.info("playwright-render-start", { url: ctx.url });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      userAgent: "Mozilla/5.0 (compatible; lp-forge/0.1; +https://github.com/anthropics/claude-code)"
    });
    const page = await context.newPage();

    await page.goto(ctx.url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
    await page.waitForTimeout(SETTLE_MS);

    const renderedHtml = await page.content();
    const inputsDir = path.join(ctx.outDir, "inputs");
    fs.mkdirSync(inputsDir, { recursive: true });

    const renderedHtmlPath = path.join(inputsDir, "rendered.html");
    fs.writeFileSync(renderedHtmlPath, renderedHtml, "utf8");

    const screenshotPath = path.join(inputsDir, "rendered-screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Validate screenshot
    try {
      const buf = fs.readFileSync(screenshotPath);
      const v = validateImage(buf, "image/png", ctx.url);
      if (!v.valid) {
        logger.warn("screenshot-validation-failed", { reason: v.reason });
      }
    } catch (e) { /* best effort */ }

    // Convert to markdown
    let markdown = "";
    if (TurndownService) {
      const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
      // Extract body only (drop head + scripts)
      const bodyMatch = renderedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyHtml = bodyMatch ? bodyMatch[1] : renderedHtml;
      // Strip <script> + <style> blocks before turndown
      const cleanHtml = bodyHtml
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
      markdown = td.turndown(cleanHtml);
      // Normalize whitespace
      markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();
    }

    // Write/overwrite page.md
    const pageMdPath = path.join(inputsDir, "page.md");
    if (markdown && markdown.length > 0) {
      fs.writeFileSync(pageMdPath, markdown, "utf8");
    }

    logger.info("playwright-render-done", {
      htmlBytes: renderedHtml.length,
      markdownBytes: markdown.length,
      screenshot: screenshotPath
    });

    return {
      fallback: "playwright",
      renderedHtml: renderedHtmlPath,
      screenshot: screenshotPath,
      pageMd: pageMdPath,
      markdown,
      bytes: renderedHtml.length
    };
  } finally {
    await browser.close();
  }
}

/**
 * Check if page.md needs Playwright enrichment.
 * Returns true if file is missing or has < MIN_BODY_CHARS of real content.
 */
function needsEnrichment(pageMdPath) {
  if (!fs.existsSync(pageMdPath)) return true;
  try {
    const content = fs.readFileSync(pageMdPath, "utf8").trim();
    // Strip pure whitespace + count chars
    const stripped = content.replace(/[\s\r\n]+/g, " ").trim();
    return stripped.length < MIN_BODY_CHARS;
  } catch { return true; }
}

module.exports = { name: "playwright-fallback", run, isPlaywrightInstalled, needsEnrichment, MIN_BODY_CHARS };

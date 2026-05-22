// ────────────────────────────────────────────────────────────────────
//  lp-forge — Playwright Fallback for content-gate failures (Story 2.2)
//  Activates only when design-md exits 4 (content-gate) AND --allow-playwright.
//  Renders page in chromium, saves HTML+screenshot, then re-invokes design-md
//  on the rendered HTML (as a file:// URL via simple local server).
//
//  Aria A-2: Playwright is `optionalDependencies`. Check require.resolve before invoking.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");

const { EXIT_CODES } = require("./exit-codes.cjs");
const { getLogger } = require("./logger.cjs");

function isPlaywrightInstalled() {
  try { require.resolve("playwright"); return true; }
  catch { return false; }
}

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

  // Lazy require — only loaded when actually needed
  const { chromium } = require("playwright");

  logger.info("playwright-render-start", { url: ctx.url });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (compatible; lp-forge/0.1; +https://github.com/anthropics/claude-code)"
    });
    const page = await context.newPage();

    await page.goto(ctx.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000); // let lazy content settle

    const renderedHtml = await page.content();
    const screenshotPath = path.join(ctx.outDir, "inputs", "rendered-screenshot.png");
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const renderedHtmlPath = path.join(ctx.outDir, "inputs", "rendered.html");
    fs.writeFileSync(renderedHtmlPath, renderedHtml, "utf8");

    logger.info("playwright-render-done", {
      htmlBytes: renderedHtml.length,
      screenshot: screenshotPath
    });

    return {
      fallback: "playwright",
      renderedHtml: renderedHtmlPath,
      screenshot: screenshotPath,
      note: "Story 2.2 ships Playwright capture only. Re-running design-md on rendered HTML is a Story 2.6 follow-up (requires local file:// server or HTML→tokens direct extraction)."
    };
  } finally {
    await browser.close();
  }
}

module.exports = { name: "playwright-fallback", run, isPlaywrightInstalled };

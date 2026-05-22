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

    proc.on("close", (code) => {
      const result = {
        designMd: path.join(ctx.outDir, "DESIGN.md"),
        tokens: path.join(ctx.outDir, "tokens.json"),
        fingerprint: path.join(ctx.outDir, "style-fingerprint.json"),
        stack: path.join(ctx.outDir, "stack.json"),
        pageMd: path.join(ctx.outDir, "inputs", "page.md"),
        exitCode: code
      };

      if (code === 0) {
        return resolve(result);
      }

      // Map design-md exit codes to lp-forge codes
      const lpCode = mapDesignMdExitCode(code);

      if (lpCode === EXIT_CODES.CONTENT_GATE && ctx.allowPlaywright) {
        logger.info("design-md-content-gate-with-playwright-fallback", { designMdExit: code });
        // Delegate to playwright fallback
        return require("../playwright-fallback.cjs").run(ctx).then(resolve).catch(reject);
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

module.exports = { name: "fetch-extract", run, mapDesignMdExitCode };

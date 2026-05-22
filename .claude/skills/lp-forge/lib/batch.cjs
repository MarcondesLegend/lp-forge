// ────────────────────────────────────────────────────────────────────
//  lp-forge — Batch Runner (Story 2.6)
//  Runs N URLs from a file, with concurrency control + slug uniqueness check.
//  Failures are isolated per URL (don't abort the batch).
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");

const { slugifyUrl, defaultOutDir, newRunId } = require("./utils.cjs");
const { runOrchestrator } = require("./orchestrator.cjs");
const { getLogger } = require("./logger.cjs");
const { EXIT_CODES } = require("./exit-codes.cjs");

const MAX_CONCURRENCY = 10;

async function runBatch(batchFile, opts = {}) {
  const logger = getLogger();

  if (!fs.existsSync(batchFile)) {
    const err = new Error(`Batch file not found: ${batchFile}`);
    err.code = EXIT_CODES.USAGE_ERROR;
    throw err;
  }

  const lines = fs.readFileSync(batchFile, "utf8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));

  // ── Slug uniqueness pre-flight (Aria G-6)
  const slugMap = new Map();
  const collisions = [];
  for (const url of lines) {
    let slug;
    try { slug = slugifyUrl(url); } catch (e) {
      logger.warn("batch-invalid-url", { url, error: e.message });
      continue;
    }
    if (slugMap.has(slug)) {
      collisions.push({ slug, urls: [slugMap.get(slug), url] });
    } else {
      slugMap.set(slug, url);
    }
  }
  if (collisions.length > 0) {
    const err = new Error(`Slug collisions detected in batch: ${JSON.stringify(collisions)}. Deduplicate input file.`);
    err.code = EXIT_CODES.USAGE_ERROR;
    throw err;
  }

  const concurrency = Math.min(Math.max(opts.concurrency || 3, 1), MAX_CONCURRENCY);
  const batchId = newRunId();
  const startedAt = new Date().toISOString();
  const results = [];

  logger.info("batch-start", { batchId, urls: lines.length, concurrency });

  // Simple p-limit implementation (no dep)
  let inFlight = 0;
  let cursor = 0;
  await new Promise((resolve) => {
    const tick = () => {
      while (inFlight < concurrency && cursor < lines.length) {
        const url = lines[cursor++];
        inFlight++;
        runOneUrl(url, opts).then(r => {
          results.push(r);
          inFlight--;
          if (cursor >= lines.length && inFlight === 0) resolve();
          else tick();
        }).catch(e => {
          results.push({ url, status: "fail", exitCode: e.code || EXIT_CODES.HTTP_ERROR, error: e.message });
          inFlight--;
          if (cursor >= lines.length && inFlight === 0) resolve();
          else tick();
        });
      }
    };
    tick();
  });

  const summary = {
    batchId,
    startedAt,
    finishedAt: new Date().toISOString(),
    urls: lines.length,
    concurrency,
    succeeded: results.filter(r => r.status === "ok").length,
    failed: results.filter(r => r.status === "fail").length,
    results
  };

  const summaryPath = path.join(opts.batchOutDir || path.join(process.cwd(), "outputs", "lp-forge"), `_batch-${batchId}.json`);
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  logger.info("batch-done", {
    batchId,
    summary: `${summary.succeeded}/${lines.length} succeeded · ${summary.failed} failed`,
    summaryPath
  });

  return summary;
}

async function runOneUrl(url, opts) {
  const ctx = {
    url,
    outDir: defaultOutDir(url),
    lang: opts.lang || "pt-BR",
    fromPhase: opts.fromPhase || 1,
    noReuse: !!opts.noReuse,
    allowPlaywright: !!opts.allowPlaywright,
    provider: opts.provider || null,
    model: opts.model || null,
    direction: opts.direction || null,
    verbosity: opts.verbosity || "quiet"  // batch mode is quieter by default
  };

  try {
    const { exitCode } = await runOrchestrator(ctx);
    return { url, slug: ctx.slug, outDir: ctx.outDir, status: exitCode === 0 ? "ok" : "fail", exitCode };
  } catch (e) {
    return { url, slug: ctx.slug, outDir: ctx.outDir, status: "fail", error: e.message, exitCode: e.code || EXIT_CODES.HTTP_ERROR };
  }
}

module.exports = { runBatch, MAX_CONCURRENCY };

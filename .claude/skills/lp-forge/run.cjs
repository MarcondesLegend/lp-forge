#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────
//  lp-forge — CLI entrypoint
//  URL → analysis report + brand-preserving Next.js redesign.
//  See SKILL.md for trigger conditions and full flag reference.
// ────────────────────────────────────────────────────────────────────
/* eslint-disable no-console */
"use strict";

const { parseArgs, failUsage } = require("./lib/cli.cjs");
const { runOrchestrator } = require("./lib/orchestrator.cjs");
const { runBatch } = require("./lib/batch.cjs");
const { EXIT_CODES, reasonFor } = require("./lib/exit-codes.cjs");

async function main() {
  // Handle --help / --version directly — commander does this when parsed.
  // parseArgs will short-circuit and exit before returning.

  const { ctx, errors } = parseArgs(process.argv);

  if (errors && errors.length > 0) {
    failUsage(errors);
    return; // unreachable — failUsage process.exits
  }

  try {
    if (ctx.batch) {
      const summary = await runBatch(ctx.batch, ctx);
      const exitCode = summary.failed === 0 ? EXIT_CODES.OK : EXIT_CODES.HTTP_ERROR;
      console.log(`\n[batch] ${summary.succeeded}/${summary.urls} succeeded · ${summary.failed} failed`);
      process.exit(exitCode);
      return;
    }
    const { exitCode } = await runOrchestrator(ctx);

    if (exitCode !== EXIT_CODES.OK) {
      console.error(`\n[lp-forge] exit ${exitCode}: ${reasonFor(exitCode)}`);
    }

    process.exit(exitCode);
  } catch (err) {
    // Unexpected uncaught error — orchestrator should catch phase errors,
    // so anything reaching here is a bootstrap or programming error.
    console.error(`\n[lp-forge] uncaught error: ${err.message}`);
    if (process.env.LP_FORGE_DEBUG) {
      console.error(err.stack);
    }
    process.exit(err.code || EXIT_CODES.USAGE_ERROR);
  }
}

main();

// ────────────────────────────────────────────────────────────────────
//  lp-forge — CLI (AC-4)
//  Uses commander (chosen over yargs: smaller API surface, native
//  TypeScript-quality docs even in CJS, mature long-term).
//  Rationale documented at top of file per AC-4 task 3.
// ────────────────────────────────────────────────────────────────────
"use strict";

const { Command } = require("commander");
const { EXIT_CODES } = require("./exit-codes.cjs");

const KNOWN_DIRECTIONS = ["editorial", "industrial", "luxury", "playful", "brutalist", "organic"];
const KNOWN_LANGS = ["pt-BR"];
const KNOWN_PROVIDERS = ["claude-cli", "openrouter"];

function buildProgram() {
  const program = new Command();

  program
    .name("lp-forge")
    .description(
      "URL → comprehensive analysis report + brand-preserving Next.js redesign.\n" +
      "Composes design-md (extraction) + huashu-design (brand capture) + frontend-design (aesthetic discipline)."
    )
    .version("0.1.0")
    .option("--url <url>", "Public http(s) URL of source site (required unless --batch is used)")
    .option("--batch <file>", "Run batch from file containing one URL per line")
    .option("--concurrency <n>", "Batch concurrency (1-10, default 3)", v => Number.parseInt(v, 10))
    .option("--strict", "Fail on aesthetic-lint critical findings or major-drift")
    .option("--business-name <name>", "Override LLM-inferred business name")
    .option("--category <cat>", "Business category (drives direction picker)")
    .option("--city <city>", "City context (drives copy regionalization)")
    .option("--lang <lang>", `Language for prompts/output (supported: ${KNOWN_LANGS.join(", ")})`, "pt-BR")
    .option("--out <dir>", "Output directory (default: outputs/lp-forge/{slug}/)")
    .option("--direction <name>", `Force aesthetic direction (one of: ${KNOWN_DIRECTIONS.join(", ")})`)
    .option("--from-phase <N>", "Resume from phase N (1-7)", v => Number.parseInt(v, 10))
    .option("--no-reuse", "Disable phase-reuse cache (force cold run)")
    .option("--allow-playwright", "Enable Playwright fallback when static fetch hits content-gate")
    .option("--provider <id>", `LLM provider (one of: ${KNOWN_PROVIDERS.join(", ")})`)
    .option("--model <id>", "LLM model (allow-list enforced per provider)")
    .option("--temperature <n>", "Sampling temperature (dev-only; production locked to 0 by Amendment A-8)", v => Number.parseFloat(v))
    .option("--verbose", "Verbose stdout (debug-level logs)")
    .option("--quiet", "Quiet stdout (errors only)")
    .option("--silent", "Silent stdout (no output; JSON log still written)");

  return program;
}

/**
 * Parse argv into normalized ctx object.
 * Returns { ctx, errors } — errors is non-empty on validation failures.
 */
function parseArgs(argv) {
  const program = buildProgram();
  const errors = [];

  try {
    program.parse(argv, { from: argv[1] === program.name() ? "user" : "node" });
  } catch (e) {
    errors.push(`Parse error: ${e.message}`);
    return { ctx: null, errors };
  }

  const opts = program.opts();

  // Require either --url or --batch
  if (!opts.url && !opts.batch) {
    errors.push("Either --url <url> or --batch <file> is required");
  }
  if (opts.url && opts.batch) {
    errors.push("--url and --batch are mutually exclusive");
  }

  // Validate enums
  if (opts.direction && !KNOWN_DIRECTIONS.includes(opts.direction)) {
    errors.push(`Invalid --direction: ${opts.direction}. Must be one of: ${KNOWN_DIRECTIONS.join(", ")}`);
  }
  if (opts.lang && !KNOWN_LANGS.includes(opts.lang)) {
    errors.push(`Invalid --lang: ${opts.lang}. Only ${KNOWN_LANGS.join(", ")} supported in v0.1`);
  }
  if (opts.provider && !KNOWN_PROVIDERS.includes(opts.provider)) {
    errors.push(`Invalid --provider: ${opts.provider}. Must be one of: ${KNOWN_PROVIDERS.join(", ")}`);
  }

  // Verbosity (only one allowed)
  let verbosity = "normal";
  const vFlags = [opts.silent && "silent", opts.quiet && "quiet", opts.verbose && "verbose"].filter(Boolean);
  if (vFlags.length > 1) {
    errors.push(`Conflicting verbosity flags: ${vFlags.join(", ")}. Pick one.`);
  } else if (vFlags.length === 1) {
    verbosity = vFlags[0];
  }

  // from-phase validation
  if (opts.fromPhase !== undefined && (opts.fromPhase < 1 || opts.fromPhase > 7)) {
    errors.push(`Invalid --from-phase: ${opts.fromPhase}. Must be 1-7.`);
  }

  if (errors.length > 0) {
    return { ctx: null, errors };
  }

  const ctx = {
    url: opts.url,
    batch: opts.batch || null,
    concurrency: opts.concurrency || 3,
    strict: !!opts.strict,
    businessName: opts.businessName || null,
    category: opts.category || null,
    city: opts.city || null,
    lang: opts.lang,
    outDir: opts.out || null,                // resolved by orchestrator
    direction: opts.direction || null,       // null → auto-pick (phase 4)
    fromPhase: opts.fromPhase || 1,
    noReuse: opts.reuse === false,           // commander inverts --no-reuse
    allowPlaywright: !!opts.allowPlaywright,
    provider: opts.provider || null,
    model: opts.model || null,
    temperature: opts.temperature,
    verbosity
  };

  return { ctx, errors: [], help: program.helpInformation() };
}

/**
 * Pretty-print usage error and exit.
 */
function failUsage(errors) {
  /* eslint-disable no-console */
  console.error("[lp-forge] usage error:");
  for (const e of errors) console.error(`  - ${e}`);
  console.error("\nRun `node run.cjs --help` for usage.");
  /* eslint-enable no-console */
  process.exit(EXIT_CODES.USAGE_ERROR);
}

module.exports = { buildProgram, parseArgs, failUsage, KNOWN_DIRECTIONS, KNOWN_LANGS, KNOWN_PROVIDERS };

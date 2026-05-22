// ────────────────────────────────────────────────────────────────────
//  lp-forge — Logger Module (AC-16, Aria Amendment A-5)
//  Structured JSON-lines logging. Stdout controlled by verbosity flag.
//  JSON log ALWAYS written to outputs/lp-forge/_logs/{date}.jsonl
// ────────────────────────────────────────────────────────────────────
/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");

// Verbosity levels (numeric — higher = more output).
// Convention: print event if LEVEL_PRIORITY[level] <= VERBOSITY[verbosity].
// silent  blocks everything; quiet allows only errors; normal allows errors+warns+info;
// verbose adds debug. Numbers chosen so info (3) <= normal (3) → INFO prints at default.
const VERBOSITY = Object.freeze({
  silent: 0,    // No stdout at all
  quiet: 1,     // Errors only
  normal: 3,    // Errors + warns + info (default)
  verbose: 4    // Everything including debug
});

const LEVEL_PRIORITY = Object.freeze({
  error: 1, warn: 2, info: 3, debug: 4
});

class Logger {
  constructor({ runId, slug, outDir, verbosity = "normal", colorize = true } = {}) {
    this.runId = runId || "unknown";
    this.slug = slug || "unknown";
    this.outDir = outDir || process.cwd();
    this.verbosity = VERBOSITY[verbosity] !== undefined ? VERBOSITY[verbosity] : VERBOSITY.normal;
    this.colorize = colorize && process.stdout.isTTY;
    this.currentPhase = null;
    this._logFilePath = null;
  }

  setPhase(phaseName) { this.currentPhase = phaseName; }

  _logFile() {
    if (this._logFilePath) return this._logFilePath;
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logsDir = path.join(this.outDir, "..", "_logs"); // outputs/lp-forge/_logs/
    try { fs.mkdirSync(logsDir, { recursive: true }); }
    catch { /* best effort */ }
    this._logFilePath = path.join(logsDir, `${date}.jsonl`);
    return this._logFilePath;
  }

  _write(level, event, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      runId: this.runId,
      slug: this.slug,
      phase: this.currentPhase,
      level,
      message: event,
      data: data || null
    };

    // Always write to JSON log (best effort — failures must not break the run)
    try {
      fs.appendFileSync(this._logFile(), JSON.stringify(entry) + "\n", "utf8");
    } catch { /* swallow — never break the pipeline on log failure */ }

    // Stdout controlled by verbosity
    const levelP = LEVEL_PRIORITY[level] || 3;
    if (levelP <= this.verbosity) {
      const prefix = this._prefix(level);
      const summary = data ? ` ${JSON.stringify(data)}` : "";
      console.log(`${prefix} ${event}${summary}`);
    }
  }

  _prefix(level) {
    if (!this.colorize) return `[${level.toUpperCase()}]`;
    const colors = {
      error: "\x1b[31m", // red
      warn: "\x1b[33m",  // yellow
      info: "\x1b[36m",  // cyan
      debug: "\x1b[90m"  // gray
    };
    const reset = "\x1b[0m";
    return `${colors[level] || ""}[${level.toUpperCase()}]${reset}`;
  }

  info(event, data) { this._write("info", event, data); }
  warn(event, data) { this._write("warn", event, data); }
  error(event, data) { this._write("error", event, data); }
  debug(event, data) { this._write("debug", event, data); }
}

// Singleton accessor — first caller initializes
let _singleton = null;

function initLogger(opts) {
  _singleton = new Logger(opts);
  return _singleton;
}

function getLogger() {
  if (!_singleton) {
    // Cold-fallback logger (no outDir, stdout-only)
    _singleton = new Logger({ verbosity: "normal" });
  }
  return _singleton;
}

module.exports = { Logger, VERBOSITY, initLogger, getLogger };

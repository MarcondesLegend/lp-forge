// Tests — lib/logger.cjs verbosity gating (fix for QA F-1).
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { Logger, VERBOSITY } = require("../../lib/logger.cjs");

function captureStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  const chunks = [];
  process.stdout.write = (chunk) => { chunks.push(String(chunk)); return true; };
  try { fn(); } finally { process.stdout.write = original; }
  return chunks.join("");
}

function newLogger(verbosity) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-logger-"));
  const logger = new Logger({ runId: "test", slug: "test", outDir, verbosity, colorize: false });
  return { logger, outDir };
}

test("VERBOSITY: normal includes info (F-1 fix)", () => {
  assert.ok(VERBOSITY.normal >= 3, "normal verbosity must be >= 3 so info (priority 3) prints");
});

test("silent: no stdout regardless of level", () => {
  const { logger, outDir } = newLogger("silent");
  const out = captureStdout(() => {
    logger.error("test-error");
    logger.warn("test-warn");
    logger.info("test-info");
  });
  assert.strictEqual(out, "", "silent must emit no stdout");
  fs.rmSync(outDir, { recursive: true, force: true });
});

test("quiet: only errors print to stdout", () => {
  const { logger, outDir } = newLogger("quiet");
  const out = captureStdout(() => {
    logger.error("test-error");
    logger.warn("test-warn");
    logger.info("test-info");
  });
  assert.match(out, /test-error/);
  assert.doesNotMatch(out, /test-warn/);
  assert.doesNotMatch(out, /test-info/);
  fs.rmSync(outDir, { recursive: true, force: true });
});

test("normal (default): errors + warns + info print", () => {
  const { logger, outDir } = newLogger("normal");
  const out = captureStdout(() => {
    logger.error("test-error");
    logger.warn("test-warn");
    logger.info("test-info");
    logger.debug("test-debug");
  });
  assert.match(out, /test-error/);
  assert.match(out, /test-warn/);
  assert.match(out, /test-info/, "F-1 regression: INFO must print at normal verbosity");
  assert.doesNotMatch(out, /test-debug/, "DEBUG must NOT print at normal");
  fs.rmSync(outDir, { recursive: true, force: true });
});

test("verbose: everything prints including debug", () => {
  const { logger, outDir } = newLogger("verbose");
  const out = captureStdout(() => {
    logger.error("e");
    logger.warn("w");
    logger.info("i");
    logger.debug("d");
  });
  assert.match(out, /e/);
  assert.match(out, /w/);
  assert.match(out, /i/);
  assert.match(out, /d/);
  fs.rmSync(outDir, { recursive: true, force: true });
});

test("JSON log is always written regardless of verbosity", () => {
  const { logger, outDir } = newLogger("silent");
  const marker = "test-event-" + Date.now() + "-" + Math.random();
  logger.info(marker, { key: "value" });
  const logsDir = path.join(outDir, "..", "_logs");
  const files = fs.readdirSync(logsDir);
  assert.ok(files.length >= 1, "at least one log file written");
  // Tests share a tmp dir; find OUR marker line
  let found = false;
  for (const f of files) {
    const content = fs.readFileSync(path.join(logsDir, f), "utf8");
    for (const line of content.split("\n").filter(Boolean)) {
      const entry = JSON.parse(line);
      if (entry.message === marker) {
        assert.deepStrictEqual(entry.data, { key: "value" });
        found = true;
        break;
      }
    }
    if (found) break;
  }
  assert.ok(found, "JSON log entry with our marker must exist");
  fs.rmSync(outDir, { recursive: true, force: true });
});

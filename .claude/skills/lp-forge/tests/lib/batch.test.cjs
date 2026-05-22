"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { runBatch, MAX_CONCURRENCY } = require("../../lib/batch.cjs");
const { EXIT_CODES } = require("../../lib/exit-codes.cjs");

test("MAX_CONCURRENCY is 10", () => {
  assert.strictEqual(MAX_CONCURRENCY, 10);
});

test("runBatch: throws on missing file", async () => {
  await assert.rejects(
    () => runBatch("/nonexistent/batch.txt"),
    (err) => err.code === EXIT_CODES.USAGE_ERROR
  );
});

test("runBatch: detects slug collisions", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-batch-"));
  const batchFile = path.join(tmpDir, "urls.txt");
  // These two URLs slug to the same value (both "example") because path "/" is empty
  fs.writeFileSync(batchFile, `https://example.com\nhttps://example.com/\n`);

  await assert.rejects(
    () => runBatch(batchFile, { fromPhase: 7 }),
    /Slug collisions detected/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("runBatch: ignores comments and empty lines", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-forge-batch-"));
  const batchFile = path.join(tmpDir, "urls.txt");
  fs.writeFileSync(batchFile, `# This is a comment\n\nhttps://example-a.com\n# another\nhttps://example-b.com\n`);

  const summary = await runBatch(batchFile, {
    fromPhase: 7,
    batchOutDir: tmpDir,
    verbosity: "silent"
  });

  assert.strictEqual(summary.urls, 2);
  // outDir cleanup
  for (const r of summary.results) {
    if (r.outDir && fs.existsSync(r.outDir)) fs.rmSync(r.outDir, { recursive: true, force: true });
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

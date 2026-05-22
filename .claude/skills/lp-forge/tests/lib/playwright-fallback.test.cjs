"use strict";
const test = require("node:test");
const assert = require("node:assert");

const { isPlaywrightInstalled, run } = require("../../lib/playwright-fallback.cjs");
const { EXIT_CODES } = require("../../lib/exit-codes.cjs");

test("isPlaywrightInstalled returns boolean", () => {
  const result = isPlaywrightInstalled();
  assert.strictEqual(typeof result, "boolean");
});

test("run throws code 12 when Playwright not installed", async (t) => {
  // Only run this test if playwright is NOT installed (the common case in v0.1)
  if (isPlaywrightInstalled()) {
    t.skip("playwright is installed — skipping");
    return;
  }
  await assert.rejects(
    () => run({ url: "https://example.com", outDir: "/tmp/lp-forge-pw-test" }),
    (err) => err.code === EXIT_CODES.PLAYWRIGHT_NOT_INSTALLED
  );
});

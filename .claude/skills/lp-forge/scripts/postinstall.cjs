#!/usr/bin/env node
// Postinstall: install vendored design-md's deps if vendor folder exists.
// Best-effort — failures here don't break lp-forge install (graceful degradation).
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const vendorDir = path.join(__dirname, "..", "vendor", "design-md");

if (!fs.existsSync(path.join(vendorDir, "package.json"))) {
  console.log("[postinstall] vendor/design-md not populated yet — skipping. (Story 2.2+ ships it.)");
  process.exit(0);
}

if (fs.existsSync(path.join(vendorDir, "node_modules"))) {
  console.log("[postinstall] vendor/design-md/node_modules exists — skipping install.");
  process.exit(0);
}

console.log("[postinstall] installing vendor/design-md deps...");
const result = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
  cwd: vendorDir,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.status !== 0) {
  console.warn("[postinstall] vendor install failed (non-fatal); lp-forge will still work for phases 2-7. Run manually if needed.");
}
process.exit(0);

#!/usr/bin/env node
// Story 2.6 — Vendor drift detection (Aria G-8)
// Compares vendor/design-md/VENDORED.md timestamp + local design-md against current.
"use strict";

const fs = require("fs");
const path = require("path");

const VENDORED_PATH = path.join(__dirname, "..", "vendor", "design-md", "VENDORED.md");
const LOCAL_DESIGN_MD = process.env.LOCAL_DESIGN_MD ||
  path.join(require("os").homedir(), ".claude", "skills", "design-md");

function main() {
  if (!fs.existsSync(VENDORED_PATH)) {
    console.error("[drift] vendor/design-md/VENDORED.md not found — re-vendor first.");
    process.exit(1);
  }
  const vendored = fs.readFileSync(VENDORED_PATH, "utf8");
  const vendoredDateMatch = vendored.match(/\*\*Vendored:\*\*\s+(\S+)/);
  const vendoredDate = vendoredDateMatch ? new Date(vendoredDateMatch[1]) : null;

  if (!fs.existsSync(LOCAL_DESIGN_MD)) {
    console.log("[drift] local design-md not found at " + LOCAL_DESIGN_MD + " — cannot compare. PASS (treat vendor as authoritative).");
    process.exit(0);
  }

  // Compare modification times of run.cjs as proxy
  const localRunCjs = path.join(LOCAL_DESIGN_MD, "run.cjs");
  if (!fs.existsSync(localRunCjs)) {
    console.log("[drift] local design-md/run.cjs not found — cannot compare. PASS.");
    process.exit(0);
  }
  const localMtime = fs.statSync(localRunCjs).mtime;

  if (vendoredDate && localMtime > vendoredDate) {
    console.warn(`[drift] ⚠️  upstream design-md/run.cjs (${localMtime.toISOString()}) is newer than vendor (${vendoredDate.toISOString()}).`);
    console.warn(`[drift] Consider re-vendoring: cp -r ${LOCAL_DESIGN_MD}/. ${path.join(__dirname, "..", "vendor", "design-md")}/`);
    process.exit(0);  // non-blocking warning
  }

  console.log("[drift] vendor is current (or local is older). PASS.");
  process.exit(0);
}

main();

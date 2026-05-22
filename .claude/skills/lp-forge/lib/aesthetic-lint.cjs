// ────────────────────────────────────────────────────────────────────
//  lp-forge — Aesthetic Lint (Story 2.5, Aria + frontend-design)
//  Scans generated redesign/ for AI-slop patterns. Critical = block exit 0
//  unless --strict=false. Warnings logged but non-blocking.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const RULES_PATH = path.join(__dirname, "..", "data", "aesthetic-lint-rules.yaml");

function loadRules() {
  if (!fs.existsSync(RULES_PATH)) return { critical: [], warning: [] };
  return yaml.load(fs.readFileSync(RULES_PATH, "utf8"));
}

function walkFiles(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, exts, out);
    else if (exts.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function lintRedesign(redesignDir) {
  const rules = loadRules();
  const files = walkFiles(redesignDir, [".tsx", ".ts", ".css", ".html"]);
  const findings = { critical: [], warning: [] };

  for (const file of files) {
    let content;
    try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
    const relPath = path.relative(redesignDir, file);

    for (const rule of (rules.critical || [])) {
      const re = makeRegex(rule);
      if (!re) continue;
      if (re.test(content)) {
        findings.critical.push({ rule: rule.id, name: rule.name, file: relPath, rationale: rule.rationale });
      }
    }

    for (const rule of (rules.warning || [])) {
      const re = makeRegex(rule);
      if (!re) continue;
      if (rule.threshold) {
        const matches = content.match(new RegExp(re.source, re.flags + "g")) || [];
        if (matches.length >= rule.threshold) {
          findings.warning.push({
            rule: rule.id, name: rule.name, file: relPath,
            count: matches.length, threshold: rule.threshold,
            rationale: rule.rationale
          });
        }
      } else if (re.test(content)) {
        findings.warning.push({ rule: rule.id, name: rule.name, file: relPath, rationale: rule.rationale });
      }
    }
  }
  return findings;
}

function makeRegex(rule) {
  if (!rule.pattern) return null;
  try {
    let flags = rule.flags || "";
    // Unicode flag needed for emoji rules
    if (rule.pattern.includes("\\x{")) flags += flags.includes("u") ? "" : "u";
    return new RegExp(rule.pattern, flags);
  } catch {
    return null;
  }
}

module.exports = { lintRedesign, loadRules, walkFiles };

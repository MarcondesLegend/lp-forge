// ────────────────────────────────────────────────────────────────────
//  lp-forge — Exit Codes Module (AC-6)
//  All 13 exit codes per architecture §6 + Aria Amendment A-7.
//  See SKILL.md "Exit codes" section for user-facing recovery hints.
// ────────────────────────────────────────────────────────────────────
"use strict";

const EXIT_CODES = Object.freeze({
  OK: 0,
  USAGE_ERROR: 1,
  CONTENT_GATE: 4,
  LLM_EXHAUSTED: 5,
  PROVIDER_MISCONFIG: 6,
  HTTP_ERROR: 7,
  BRAND_ASSETS_INSUFFICIENT: 8,
  BUSINESS_INFO_TOO_THIN: 9,
  NEXTJS_GENERATION_ERROR: 10,
  VALIDATION_FAILED: 11,
  PLAYWRIGHT_NOT_INSTALLED: 12,
  SANITIZATION_HARD_BLOCK: 13
});

const REASONS = Object.freeze({
  [EXIT_CODES.OK]: "Success — both deliverables produced + validation pass",
  [EXIT_CODES.USAGE_ERROR]: "Usage error (missing required flags)",
  [EXIT_CODES.CONTENT_GATE]: "Content-gate failure (bot block / SPA shell / paywall). Retry with --allow-playwright",
  [EXIT_CODES.LLM_EXHAUSTED]: "LLM exhausted budget or repeatedly failed. Check inputs/prompt.txt",
  [EXIT_CODES.PROVIDER_MISCONFIG]: "Provider misconfigured (openrouter without API key)",
  [EXIT_CODES.HTTP_ERROR]: "HTTP error from upstream",
  [EXIT_CODES.BRAND_ASSETS_INSUFFICIENT]: "Brand assets insufficient (no logo AND no business-name to generate logotype). Provide --business-name or manual asset",
  [EXIT_CODES.BUSINESS_INFO_TOO_THIN]: "Business info too thin (cannot form a sentence about what the business sells). Provide --business-name and --category",
  [EXIT_CODES.NEXTJS_GENERATION_ERROR]: "Next.js template generation error (broken JSX from LLM). Re-run phase 6",
  [EXIT_CODES.VALIDATION_FAILED]: "Validation/aesthetic-lint flagged issues (non-blocking unless --strict)",
  [EXIT_CODES.PLAYWRIGHT_NOT_INSTALLED]: "Playwright fallback requested but not installed. Run: npm run install-playwright",
  [EXIT_CODES.SANITIZATION_HARD_BLOCK]: "Source content overwhelmingly hostile (prompt injection sanitizer hard-block). Manual review required"
});

function reasonFor(code) {
  return REASONS[code] || `Unknown exit code ${code}`;
}

module.exports = { EXIT_CODES, REASONS, reasonFor };

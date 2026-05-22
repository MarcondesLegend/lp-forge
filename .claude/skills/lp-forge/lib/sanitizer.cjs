// ────────────────────────────────────────────────────────────────────
//  lp-forge — Prompt Injection Sanitizer (Story 2.3, Aria A-6.1)
//  Scans LLM-bound text for known injection patterns. Tags suspicious
//  content with [SANITIZED-START]...[SANITIZED-END] markers (does NOT strip
//  — LLM may need context, but it knows the content is suspect).
//  Hard-block (exit 13) if flagged.length > THRESHOLD on a single input.
// ────────────────────────────────────────────────────────────────────
"use strict";

const PATTERNS = [
  { name: "ignore-prev-instructions", re: /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/gi },
  { name: "you-are-now", re: /you\s+are\s+now\s+(?:a|an)\s+/gi },
  { name: "system-prompt-override", re: /system\s+prompt\s*[:=]/gi },
  { name: "chat-template-tokens", re: /<\|im_(?:start|end)\|>/gi },
  { name: "role-injection", re: /\[\s*(?:system|assistant|user)\s*\]\s*:/gi },
  { name: "forget-everything", re: /forget\s+(?:everything|all)\s+(?:above|before)/gi },
  { name: "act-as", re: /act\s+as\s+(?:a|an)\s+(?:helpful|expert|professional)\s+/gi },
  { name: "dan-jailbreak", re: /DAN\s+(?:mode|version)/gi }
];

const HARD_BLOCK_THRESHOLD = 10;

/**
 * Returns { sanitized, flagged } where:
 *   - sanitized: the text with [SANITIZED-START]...[SANITIZED-END] wrapping each match
 *   - flagged: array of { pattern, location, snippet } for each match
 */
function sanitizeForLlm(text, opts = {}) {
  if (typeof text !== "string" || !text) return { sanitized: text || "", flagged: [] };

  const flagged = [];
  let sanitized = text;

  for (const { name, re } of PATTERNS) {
    sanitized = sanitized.replace(re, (match, offset) => {
      flagged.push({
        pattern: name,
        location: offset,
        snippet: match.slice(0, 60)
      });
      return `[SANITIZED-START:${name}]${match}[SANITIZED-END]`;
    });
  }

  return { sanitized, flagged, hardBlock: flagged.length > (opts.threshold || HARD_BLOCK_THRESHOLD) };
}

module.exports = { sanitizeForLlm, PATTERNS, HARD_BLOCK_THRESHOLD };

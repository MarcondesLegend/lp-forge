"use strict";
const test = require("node:test");
const assert = require("node:assert");

const { mapDesignMdExitCode } = require("../../../lib/adapters/design-md-adapter.cjs");
const { EXIT_CODES } = require("../../../lib/exit-codes.cjs");

test("mapDesignMdExitCode: 0 → OK", () => {
  assert.strictEqual(mapDesignMdExitCode(0), EXIT_CODES.OK);
});

test("mapDesignMdExitCode: 4 → CONTENT_GATE", () => {
  assert.strictEqual(mapDesignMdExitCode(4), EXIT_CODES.CONTENT_GATE);
});

test("mapDesignMdExitCode: 2 + 5 → LLM_EXHAUSTED", () => {
  assert.strictEqual(mapDesignMdExitCode(2), EXIT_CODES.LLM_EXHAUSTED);
  assert.strictEqual(mapDesignMdExitCode(5), EXIT_CODES.LLM_EXHAUSTED);
});

test("mapDesignMdExitCode: 6 → PROVIDER_MISCONFIG", () => {
  assert.strictEqual(mapDesignMdExitCode(6), EXIT_CODES.PROVIDER_MISCONFIG);
});

test("mapDesignMdExitCode: 7 → HTTP_ERROR", () => {
  assert.strictEqual(mapDesignMdExitCode(7), EXIT_CODES.HTTP_ERROR);
});

test("mapDesignMdExitCode: unknown → HTTP_ERROR", () => {
  assert.strictEqual(mapDesignMdExitCode(99), EXIT_CODES.HTTP_ERROR);
});

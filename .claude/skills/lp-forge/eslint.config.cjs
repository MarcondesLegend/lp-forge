// Minimal ESLint config for lp-forge.
// Goal: enforce `no-console` so all logging goes through lib/logger.cjs (Amendment A-5).
// We avoid pulling in a full eslint dep; this file documents intent.
// Story 2.6 will wire actual eslint enforcement into CI.

module.exports = {
  rules: {
    "no-console": "error",
    "no-unused-vars": "error"
  },
  ignorePatterns: [
    "node_modules/",
    "outputs/",
    "vendor/",
    "tests/fixtures/"
  ],
  // Allow console in CLI entry (run.cjs) and tests — they're the boundary.
  overrides: [
    { files: ["run.cjs", "tests/**/*.cjs", "lib/logger.cjs"], rules: { "no-console": "off" } }
  ]
};

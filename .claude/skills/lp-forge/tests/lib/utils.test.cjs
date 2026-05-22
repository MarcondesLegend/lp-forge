// ────────────────────────────────────────────────────────────────────
//  Tests — lib/utils.cjs
//  Verify slugifyUrl semantics match design-md contract (architecture §2).
// ────────────────────────────────────────────────────────────────────
"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { slugifyUrl, slugifyToken, sha256, newRunId } = require("../../lib/utils.cjs");

test("slugifyUrl: bare company root", () => {
  assert.strictEqual(slugifyUrl("https://www.anthropic.com/"), "anthropic");
  assert.strictEqual(slugifyUrl("https://anthropic.com"), "anthropic");
});

test("slugifyUrl: path-aware (different DSes under same company)", () => {
  assert.strictEqual(slugifyUrl("https://www.shopify.com/br/enterprise"), "shopify-br-enterprise");
});

test("slugifyUrl: subdomain-aware", () => {
  assert.strictEqual(slugifyUrl("https://app.linear.app/"), "linear-app");
  assert.strictEqual(slugifyUrl("https://brand.acme.com/brandbook/guidelines"),
    "acme-brand-brandbook-guidelines");
});

test("slugifyUrl: caps at 80 chars", () => {
  const longUrl = "https://www.veryverylongdomainname.com/" +
    "first-segment/second-segment/third-segment/fourth-segment-extra";
  const slug = slugifyUrl(longUrl);
  assert.ok(slug.length <= 80, `slug should be <= 80 chars, got ${slug.length}`);
});

test("slugifyUrl: throws on invalid URL", () => {
  assert.throws(() => slugifyUrl("not a url"), /Invalid URL/);
});

test("slugifyToken: lowercases and dasheswords", () => {
  assert.strictEqual(slugifyToken("Hello World"), "hello-world");
  assert.strictEqual(slugifyToken("FOO_BAR"), "foo-bar");
});

test("sha256: deterministic and hex", () => {
  const a = sha256("hello");
  const b = sha256("hello");
  assert.strictEqual(a, b, "sha256 must be deterministic");
  assert.match(a, /^[0-9a-f]{64}$/, "sha256 must be 64-char hex");
});

test("newRunId: unique 16-char hex", () => {
  const ids = new Set();
  for (let i = 0; i < 20; i++) ids.add(newRunId());
  assert.strictEqual(ids.size, 20, "newRunId should be unique across calls");
  for (const id of ids) {
    assert.match(id, /^[0-9a-f]{16}$/, "newRunId must be 16-char hex");
  }
});

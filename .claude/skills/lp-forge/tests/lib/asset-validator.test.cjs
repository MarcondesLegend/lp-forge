"use strict";
const test = require("node:test");
const assert = require("node:assert");

const { validateImage, detectMagic } = require("../../lib/asset-validator.cjs");

test("detectMagic: PNG", () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  assert.strictEqual(detectMagic(buf), "image/png");
});

test("detectMagic: JPEG", () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  assert.strictEqual(detectMagic(buf), "image/jpeg");
});

test("detectMagic: SVG via <svg> tag", () => {
  const buf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.strictEqual(detectMagic(buf), "image/svg+xml");
});

test("detectMagic: unknown returns null", () => {
  const buf = Buffer.from("hello world");
  assert.strictEqual(detectMagic(buf), null);
});

test("validateImage: SVG with <script> is rejected", () => {
  const malicious = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const r = validateImage(malicious, "image/svg+xml", "http://test");
  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /svg-dangerous-construct/);
});

test("validateImage: SVG with onload= is rejected", () => {
  const malicious = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
  const r = validateImage(malicious, "image/svg+xml");
  assert.strictEqual(r.valid, false);
});

test("validateImage: SVG with javascript: href is rejected", () => {
  const malicious = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)">click</a></svg>');
  const r = validateImage(malicious, "image/svg+xml");
  assert.strictEqual(r.valid, false);
});

test("validateImage: clean SVG passes", () => {
  const clean = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
  const r = validateImage(clean, "image/svg+xml");
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.mimeDetected, "image/svg+xml");
});

test("validateImage: Content-Type mismatch is rejected", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const r = validateImage(png, "image/jpeg");
  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /content-type-mismatch/);
});

test("validateImage: clean PNG passes", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const r = validateImage(png, "image/png");
  assert.strictEqual(r.valid, true);
});

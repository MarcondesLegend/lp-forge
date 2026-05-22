"use strict";
const test = require("node:test");
const assert = require("node:assert");

const { buildCopy } = require("../../lib/copywriter.cjs");

test("buildCopy: produces required fields for all 6 directions", () => {
  for (const direction of ["editorial", "industrial", "luxury", "playful", "brutalist", "organic"]) {
    const c = buildCopy({ businessName: "Test", direction, services: [], contact: {} });
    assert.ok(c.heroHeadline);
    assert.ok(c.heroSubheadline);
    assert.ok(c.heroCta);
    assert.ok(c.servicesBlock);
    assert.ok(c.aboutCopy);
    assert.ok(c.contactBlock);
  }
});

test("buildCopy: services list rendered when present", () => {
  const c = buildCopy({
    businessName: "Test", direction: "editorial",
    services: ["Corte", "Coloração", "Manicure"],
    contact: {}
  });
  assert.match(c.servicesBlock, /Corte/);
  assert.match(c.servicesBlock, /Coloração/);
});

test("buildCopy: empty services gets fallback message, never invents", () => {
  const c = buildCopy({ businessName: "Test", direction: "editorial", services: [], contact: {} });
  assert.match(c.servicesBlock, /sob consulta|/i);
  assert.doesNotMatch(c.servicesBlock, /haircut|massage|generic/i);
});

test("buildCopy: contact block omits empty fields (no invention)", () => {
  const c = buildCopy({
    businessName: "Test", direction: "editorial", services: [],
    contact: { phone: "11 9999-9999" }
  });
  assert.match(c.contactBlock, /11 9999-9999/);
  assert.doesNotMatch(c.contactBlock, /Email/);  // not provided, must not appear
});

test("buildCopy: XSS guard — service names with <script> are escaped", () => {
  const c = buildCopy({
    businessName: "Test", direction: "editorial",
    services: ["<script>alert(1)</script>"],
    contact: {}
  });
  assert.doesNotMatch(c.servicesBlock, /<script>/);
  assert.match(c.servicesBlock, /&lt;script&gt;/);
});

test("buildCopy: contact block escapes HTML in values", () => {
  const c = buildCopy({
    businessName: "Test", direction: "editorial", services: [],
    contact: { phone: "<img src=x onerror=alert(1)>" }
  });
  // Note: the URL part still URL-encodes; the visible text is escaped
  assert.doesNotMatch(c.contactBlock, /<img\s+src=x\s+onerror/);
});

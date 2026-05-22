// ────────────────────────────────────────────────────────────────────
//  lp-forge — Asset Validator (Story 2.3, Aria A-6.2)
//  MIME validation: Content-Type vs file extension vs magic bytes.
//  SVG XSS protection: reject SVG containing <script>, onload=, etc.
// ────────────────────────────────────────────────────────────────────
"use strict";

// Magic bytes for common image formats
const MAGIC = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp_riff: [0x52, 0x49, 0x46, 0x46]   // RIFF header (WebP, AVI, WAV)
};

function startsWith(buf, magic) {
  if (buf.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) if (buf[i] !== magic[i]) return false;
  return true;
}

function detectMagic(buf) {
  if (startsWith(buf, MAGIC.png)) return "image/png";
  if (startsWith(buf, MAGIC.jpeg)) return "image/jpeg";
  if (startsWith(buf, MAGIC.gif)) return "image/gif";
  if (startsWith(buf, MAGIC.webp_riff) && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  // SVG = ASCII text starting with <svg or <?xml
  const head = buf.slice(0, 200).toString("utf8").trimStart();
  if (/^<(?:\?xml|svg)/i.test(head)) return "image/svg+xml";
  return null;
}

const SVG_DANGEROUS = [
  /<script\b/i,
  /<foreignObject\b/i,
  /\bon(?:load|click|error|mouseover|focus|blur)\s*=/i,
  /href\s*=\s*["']?javascript:/i,
  /xlink:href\s*=\s*["']?javascript:/i,
  /<image[^>]*href\s*=\s*["']?https?:/i  // remote image refs in SVG
];

/**
 * Validate an image buffer.
 * Returns { valid: boolean, reason?: string, mimeDetected?: string }
 */
function validateImage(buffer, contentType, sourceUrl) {
  if (!Buffer.isBuffer(buffer)) {
    return { valid: false, reason: "not-a-buffer" };
  }

  const mimeDetected = detectMagic(buffer);
  if (!mimeDetected) {
    return { valid: false, reason: "unknown-format-magic-bytes-mismatch" };
  }

  // If Content-Type provided and disagrees with magic, reject
  if (contentType && !contentType.toLowerCase().includes(mimeDetected.split("/")[1])) {
    // exception: Content-Type may be "image/jpg" vs detected "image/jpeg"
    const ctNorm = contentType.toLowerCase().replace("/jpg", "/jpeg");
    if (!ctNorm.includes(mimeDetected.split("/")[1])) {
      return { valid: false, reason: `content-type-mismatch: ${contentType} vs ${mimeDetected}`, mimeDetected };
    }
  }

  // SVG: scan for dangerous constructs
  if (mimeDetected === "image/svg+xml") {
    const text = buffer.toString("utf8");
    for (const pattern of SVG_DANGEROUS) {
      if (pattern.test(text)) {
        return {
          valid: false,
          reason: `svg-dangerous-construct: ${pattern.source}`,
          mimeDetected,
          sourceUrl
        };
      }
    }
  }

  return { valid: true, mimeDetected };
}

module.exports = { validateImage, detectMagic, SVG_DANGEROUS, MAGIC };

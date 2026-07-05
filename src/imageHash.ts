import { createRequire } from "node:module";

// sharp-phash is CommonJS (`module.exports = phash`); createRequire avoids the
// default-export interop issues under NodeNext.
const require = createRequire(import.meta.url);
const phash: (input: Buffer) => Promise<string> = require("sharp-phash");

/**
 * Computes the perceptual hash (pHash) of an image from its buffer.
 * Returns a 64-char binary string ('0'/'1'), or null on failure.
 */
export async function hashImage(buffer: Buffer): Promise<string | null> {
  try {
    const hash: string = await phash(buffer);
    return hash;
  } catch (err) {
    console.warn("[imageHash] Failed to hash an image:", err);
    return null;
  }
}

/**
 * Hamming distance between two binary pHashes of equal length.
 * Returns Infinity if the lengths differ (incomparable hashes).
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

/** Content types and extensions we treat as hashable images. */
const IMAGE_CONTENT_TYPES = /^image\/(png|jpe?g|webp|gif|bmp|tiff)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp|tiff)$/i;

export function isHashableImage(contentType: string | null, name: string | null): boolean {
  if (contentType && IMAGE_CONTENT_TYPES.test(contentType)) return true;
  if (name && IMAGE_EXTENSIONS.test(name)) return true;
  return false;
}

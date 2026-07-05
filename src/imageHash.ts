import { createRequire } from "node:module";

// sharp-phash es CommonJS (`module.exports = phash`); createRequire evita
// los problemas de interop del default export bajo NodeNext.
const require = createRequire(import.meta.url);
const phash: (input: Buffer) => Promise<string> = require("sharp-phash");

/**
 * Calcula el hash perceptual (pHash) de una imagen a partir de su buffer.
 * Devuelve un string binario de 64 caracteres ('0'/'1'), o null si falla.
 */
export async function hashImage(buffer: Buffer): Promise<string | null> {
  try {
    const hash: string = await phash(buffer);
    return hash;
  } catch (err) {
    console.warn("[imageHash] No se pudo hashear una imagen:", err);
    return null;
  }
}

/**
 * Distancia de Hamming entre dos pHashes binarios de igual longitud.
 * Devuelve Infinity si las longitudes difieren (hashes incomparables).
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

/** Extensiones y content-types que consideramos imágenes hasheables. */
const IMAGE_CONTENT_TYPES = /^image\/(png|jpe?g|webp|gif|bmp|tiff)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp|tiff)$/i;

export function isHashableImage(contentType: string | null, name: string | null): boolean {
  if (contentType && IMAGE_CONTENT_TYPES.test(contentType)) return true;
  if (name && IMAGE_EXTENSIONS.test(name)) return true;
  return false;
}

export const TAU = Math.PI * 2;

/**
 * Normalize a hex color string.
 * Removes leading "0x", non-hex characters, and converts to lowercase.
 * Returns an empty string if the input is falsy.
 *
 * @param {*} s - The input string to normalize.
 * @returns {string} Normalized hex string.
 */
export function normalizeHex(s) {
  if (!s) return "";
  return (s + "")
    .replace(/^0x/i, "")
    .replace(/[^0-9a-fA-F]/g, "")
    .toLowerCase();
}

/**
 * Convert a hex string to a 32-bit seed using FNV-1a hash algorithm.
 * Pads odd-length hex strings with a leading zero.
 *
 * @param {string} hex - The hex string to hash.
 * @returns {number} 32-bit unsigned integer seed.
 */
export function hexToSeed32(hex) {
  if (hex.length === 0) return 0x811c9dc5 >>> 0;
  if (hex.length % 2 === 1) hex = "0" + hex;
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.slice(i, i + 2), 16);
    h ^= b;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Apply Murmur3-style finalization mix to a 32-bit integer.
 * Improves the distribution of hash values.
 *
 * @param {number} a - The 32-bit integer to mix.
 * @returns {number} Mixed 32-bit unsigned integer.
 */
export function fmix32(a) {
  a ^= a >>> 16;
  a = Math.imul(a, 0x85ebca6b);
  a ^= a >>> 13;
  a = Math.imul(a, 0xc2b2ae35);
  a ^= a >>> 16;
  return a >>> 0;
}

/**
 * Generate a 2D hash value from a seed and x,y coordinates.
 * Uses a combination of multiplication and XOR operations for good distribution.
 *
 * @param {number} seed - The initial seed value.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @returns {number} 32-bit unsigned integer hash value.
 */
export function hash2D(seed, x, y) {
  let n = (seed + Math.imul((x | 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  n ^= Math.imul((y | 0) + 0x9e3779b9, 0xc2b2ae35);
  return fmix32(n);
}

/**
 * Generate a random hexadecimal string of specified length.
 * Uses crypto.getRandomValues() if available, falls back to Math.random().
 *
 * @param {number} [len=32] - The desired length of the hex string.
 * @returns {string} Random hexadecimal string of the specified length.
 */
export function randomHex(len = 32) {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(Math.ceil(len / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, len);
  }
  let s = "";
  while (s.length < len)
    s += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  return s.slice(0, len);
}

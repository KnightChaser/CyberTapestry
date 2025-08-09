export const TAU = Math.PI * 2;

/**
 * Streaming 4-lane compressor: turns arbitrarily long hex -> fixed N*8 chars
 *
 * @param {*} hex - The hex string to compress.
 *                  If longer than MAX_HEX_NORM, compresses to outWords words.
 * @param {*} outWords - The number of output words to generate.
 * @returns {number[]} Array of compressed 32-bit words.
 */
function compressHexToWords(hex, outWords = 8) {
    // 4 lanes with different salts; we’ll expand to outWords by cycling lanes
    const lanes = [
        0x811c9dc5 ^ 0x01, // FNV offset basis tweaked
        0x811c9dc5 ^ 0x02,
        0x811c9dc5 ^ 0x03,
        0x811c9dc5 ^ 0x04,
    ].map((x) => x >>> 0);

    // walk bytes from hex
    let h = lanes.slice();
    const FNV_PRIME = 0x01000193;
    const L = hex.length;
    for (let i = 0, lane = 0; i < L; i += 2, lane = (lane + 1) & 3) {
        // make sure we have full byte; if odd length, left-pad last nibble
        const b = parseInt(i + 1 < L ? hex.slice(i, i + 2) : "0" + hex[i], 16);
        // FNV-1a step on a lane, then cross-lane stir
        h[lane] ^= b;
        h[lane] = Math.imul(h[lane], FNV_PRIME) >>> 0;
        const nxt = (lane + 1) & 3;
        h[nxt] ^= (h[lane] >>> 17) ^ Math.imul(h[lane], 0x9e3779b1);
        h[nxt] >>>= 0;
    }

    // finalize each lane
    for (let i = 0; i < 4; i++) h[i] = fmix32(h[i]);

    // expand/cycle lanes to desired word count
    const out = [];
    for (let i = 0; i < outWords; i++) {
        // derive each extra word from lane state + index, then fmix again
        const v = fmix32(h[i & 3] + Math.imul(i + 1, 0x9e3779b9));
        out.push(v >>> 0);
    }
    return out;
}

const MAX_HEX_NORM = 128; // if cleaned input > this, we compress
const COMPRESS_TO_WORDS = 8; // 8 words = 64 hex chars

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
    let hex = (s + "")
        .replace(/^0x/i, "")
        .replace(/[^0-9a-fA-F]/g, "")
        .toLowerCase();

    if (!hex) {
        return "";
    }

    if (hex.length > MAX_HEX_NORM) {
        const words = compressHexToWords(hex, COMPRESS_TO_WORDS);
        hex = words.map((w) => w.toString(16).padStart(8, "0")).join("");
    }
    return hex;
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

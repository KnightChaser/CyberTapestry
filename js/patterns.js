import { TAU, fmix32, hash2D } from "./utils.js";

/**
 * Find the canonical (lexicographically smallest) coordinate pair
 * from 4-fold rotational symmetry transformations.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} W - The width of the canvas.
 * @param {number} H - The height of the canvas.
 * @returns {number[]} The canonical [x, y] coordinate pair.
 */
function rot4Canonical(x, y, W, H) {
    const t0 = [x, y];
    const t1 = [W - 1 - y, x];
    const t2 = [W - 1 - x, H - 1 - y];
    const t3 = [y, H - 1 - x];
    const arr = [t0, t1, t2, t3];
    arr.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return arr[0];
}

/**
 * Build a collection of color indexer functions for different pattern modes.
 * Each indexer function takes (x, y) coordinates and returns a palette color index.
 *
 * @param {number} seed - The random seed for hash generation.
 * @param {number} blockSize - The size of pattern blocks/cells.
 * @param {number} paletteLen - The number of colors in the palette.
 * @param {number} W - The width of the canvas.
 * @param {number} H - The height of the canvas.
 * @returns {Object} Object with numbered keys (0-10) mapping to indexer functions.
 */
export function buildColorIndexer(seed, blockSize, paletteLen, W, H) {
    const cx = (W - 1) / 2,
        cy = (H - 1) / 2;
    const sectors = 16;

    const mod = (n, m) => ((n % m) + m) % m;

    return {
        // 0 none
        0: (x, y) =>
            hash2D(seed, (x / blockSize) | 0, (y / blockSize) | 0) % paletteLen,

        // 1 vertical mirror
        1: (x, y) => {
            const sx = x < W / 2 ? x : W - 1 - x,
                sy = y;
            return (
                hash2D(seed, (sx / blockSize) | 0, (sy / blockSize) | 0) %
                paletteLen
            );
        },

        // 2 horizontal mirror
        2: (x, y) => {
            const sx = x,
                sy = y < H / 2 ? y : H - 1 - y;
            return (
                hash2D(seed, (sx / blockSize) | 0, (sy / blockSize) | 0) %
                paletteLen
            );
        },

        // 3 quad mirror
        3: (x, y) => {
            const sx = x < W / 2 ? x : W - 1 - x;
            const sy = y < H / 2 ? y : H - 1 - y;
            return (
                hash2D(seed, (sx / blockSize) | 0, (sy / blockSize) | 0) %
                paletteLen
            );
        },

        // 4 diag (y=x)
        4: (x, y) => {
            let sx = x,
                sy = y;
            if (y > x) {
                sx = y;
                sy = x;
            }
            return (
                hash2D(seed, (sx / blockSize) | 0, (sy / blockSize) | 0) %
                paletteLen
            );
        },

        // 5 anti-diag (y=H-1-x)
        5: (x, y) => {
            let sx = x,
                sy = y;
            if (y > H - 1 - x) {
                const dx = H - 1 - y;
                sx = dx;
                sy = W - 1 - x;
            }
            return (
                hash2D(seed, (sx / blockSize) | 0, (sy / blockSize) | 0) %
                paletteLen
            );
        },

        // 6 4-fold rotational
        6: (x, y) => {
            const [sx, sy] = rot4Canonical(x, y, W, H);
            return (
                hash2D(seed, (sx / blockSize) | 0, (sy / blockSize) | 0) %
                paletteLen
            );
        },

        // 7 radial rings
        7: (x, y) => {
            const dx = x - cx,
                dy = y - cy;
            const r = Math.sqrt(dx * dx + dy * dy);
            const ring = Math.floor(r / blockSize);
            return fmix32(seed + ring * 0x9e37) % paletteLen;
        },

        // 8 polar sectors
        8: (x, y) => {
            const dx = x - cx,
                dy = y - cy;
            let ang = Math.atan2(dy, dx);
            if (ang < 0) ang += TAU;
            const sec = Math.floor((ang / TAU) * sectors);
            const wedge = sec % 2 === 0 ? sec : sec - 1;
            const rbin = Math.floor(Math.hypot(dx, dy) / blockSize);
            return fmix32(seed ^ (wedge * 1315423911) ^ rbin) % paletteLen;
        },

        // 9 stripes
        9: (x, y) => {
            const bx = (x / blockSize) | 0,
                by = (y / blockSize) | 0;
            return mod(bx ^ (by + (seed & 3)), paletteLen);
        },

        // 10 checker hashed
        10: (x, y) => {
            const bx = (x / blockSize) | 0,
                by = (y / blockSize) | 0;
            const parity = (bx + by) & 1;
            const h = hash2D(seed, bx, by) >>> 0;
            const v = parity ? h >>> 1 : h >>> 3; // unsigned shifts
            return mod(v, paletteLen);
        },
    };
}

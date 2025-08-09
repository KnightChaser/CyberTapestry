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
 * Convert a 32-bit unsigned integer to a float in the range [0, 1).
 * @param {*} u - The input integer.
 * @returns {number} The normalized float value.
 */
function h01(u) {
    return (u >>> 0) / 0x100000000;
}

/**
 * Linearly interpolate between two values.
 * @param {*} a - The start value.
 * @param {*} b - The end value.
 * @param {*} t - The interpolation factor (0 to 1).
 * @returns The interpolated value.
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Smoothstep interpolation.
 * @param {*} t - The interpolation factor (0 to 1).
 * @returns The smoothed value.:w
 */
function smoothstep(t) {
    return t * t * (3 - 2 * t);
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

    // Voronoi params (cell size scales with block)
    const cell = Math.max(4, blockSize * 4);

    // weave params
    const weaveP = Math.max(3, blockSize * 2);
    const weaveT = Math.max(1, Math.floor(weaveP / 5));

    // crosshatch params
    const hatchP = Math.max(4, blockSize * 3);
    const hatchT = Math.max(1, Math.floor(hatchP / 6));

    // rotated checker params
    const rcStep = Math.max(2, blockSize * 2);

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

        // 11 diamonds (Manhattan/L1 bands)
        11: (x, y) => {
            const d = Math.abs(x - cx) + Math.abs(y - cy);
            const band = Math.floor(d / blockSize);
            return mod(fmix32(seed + band * 0x45d9f3b), paletteLen);
        },

        // 12 squares (Chebyshev rings)
        12: (x, y) => {
            const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
            const band = Math.floor(d / blockSize);
            return mod(fmix32(seed + band * 0x27d4eb2d), paletteLen);
        },

        // 13 spiral (angle + k*radius bands)
        13: (x, y) => {
            const dx = x - cx,
                dy = y - cy;
            const r = Math.hypot(dx, dy) / Math.max(1, blockSize);
            let a = Math.atan2(dy, dx);
            if (a < 0) a += TAU;
            const k = 1 + (seed & 7) / 8; // mild seed-driven twist
            const band = Math.floor((a + k * r) * 1.5);
            return mod(fmix32(seed ^ (band * 0x9e3779b9)), paletteLen);
        },

        // 14 spokes (wheel)
        14: (x, y) => {
            const dx = x - cx,
                dy = y - cy;
            let a = Math.atan2(dy, dx);
            if (a < 0) a += TAU;
            const spokes = 8 + (seed & 7); // 8..15
            const sec = Math.floor((a / TAU) * spokes);
            return mod(fmix32(seed + sec * 0x632be5ab), paletteLen);
        },

        // 15 bricks (staggered)
        15: (x, y) => {
            const bw = blockSize * 2,
                bh = blockSize;
            const row = Math.floor(y / bh);
            const x2 = x + (row & 1 ? bw >> 1 : 0);
            const bx = Math.floor(x2 / bw),
                by = row;
            return mod(hash2D(seed, bx, by), paletteLen);
        },

        // 16 voronoi (grid seeds; nearest)
        16: (x, y) => {
            const gx = Math.floor(x / cell),
                gy = Math.floor(y / cell);
            let bestD = 1e9,
                bestI = 0;
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    const cxg = gx + ox,
                        cyg = gy + oy;
                    const h = hash2D(seed, cxg, cyg);
                    const jx = (h & 0xffff) / 0xffff; // 0..1
                    const jy = ((h >>> 16) & 0xffff) / 0xffff; // 0..1
                    const px = (cxg + jx) * cell;
                    const py = (cyg + jy) * cell;
                    const dx = x - px,
                        dy = y - py;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < bestD) {
                        bestD = d2;
                        bestI = h >>> 24;
                    }
                }
            }
            return bestI % paletteLen;
        },

        // 17 value-noise (bilinear; quantize)
        17: (x, y) => {
            const gx = Math.floor(x / cell),
                gy = Math.floor(y / cell);
            const tx = (x % cell) / cell,
                ty = (y % cell) / cell;

            const h00 = h01(hash2D(seed, gx + 0, gy + 0));
            const h10 = h01(hash2D(seed, gx + 1, gy + 0));
            const h01v = h01(hash2D(seed, gx + 0, gy + 1));
            const h11 = h01(hash2D(seed, gx + 1, gy + 1));

            const sx = smoothstep(tx),
                sy = smoothstep(ty);
            const ix0 = lerp(h00, h10, sx);
            const ix1 = lerp(h01v, h11, sx);
            const v = lerp(ix0, ix1, sy); // 0..1

            const bins = paletteLen;
            const idx = Math.min(bins - 1, Math.floor(v * bins));
            return idx;
        },

        // 18 weave (over/under grid)
        18: (x, y) => {
            const ax = Math.abs((x % weaveP) - weaveP / 2);
            const ay = Math.abs((y % weaveP) - weaveP / 2);
            const isStrandX = ax < weaveT,
                isStrandY = ay < weaveT;
            if (!(isStrandX || isStrandY)) {
                return mod(
                    hash2D(seed, (x / weaveP) | 0, (y / weaveP) | 0),
                    paletteLen
                );
            }
            // over/under by tile parity
            const tile = (((x / weaveP) | 0) ^ ((y / weaveP) | 0)) & 1;
            return tile ? 0 : 2; // pick two palette anchors for contrast
        },

        // 19 crosshatch (plus lattice)
        19: (x, y) => {
            const ax = Math.abs((x % hatchP) - hatchP / 2);
            const ay = Math.abs((y % hatchP) - hatchP / 2);
            const on = ax < hatchT || ay < hatchT;
            if (!on)
                return mod(
                    hash2D(seed, (x / hatchP) | 0, (y / hatchP) | 0),
                    paletteLen
                );
            return ((x / hatchP) | 0) & 1 ? 1 : 3;
        },

        // 20 rot45-checker
        20: (x, y) => {
            const a = Math.floor((x + y) / rcStep);
            const b = Math.floor((x - y) / rcStep);
            const v = (a ^ b) & 3;
            return v % paletteLen;
        },

        // 21 kaleido8 (8-way)
        21: (x, y) => {
            // map to one octant via mirrors over x=0,y=0 and y=x
            const ux = x - cx,
                uy = y - cy;
            let ax = Math.abs(ux),
                ay = Math.abs(uy);
            if (ay > ax) {
                const t = ax;
                ax = ay;
                ay = t;
            } // reflect across diag
            const sx = Math.floor((ax + cx) / blockSize);
            const sy = Math.floor((ay + cy) / blockSize);
            return mod(hash2D(seed, sx, sy), paletteLen);
        },

        // 22 concentric-squares (Chebyshev bands with thick borders)
        22: (x, y) => {
            const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
            const bandW = Math.max(2, blockSize); // thickness of each square ring
            const k = Math.floor(d / bandW);
            // emphasize borders: near ring edges -> alternate color
            const edge = d % bandW;
            const edgeBias = edge < 1 || edge > bandW - 2 ? 1 : 0;
            return mod(k + edgeBias + (seed & 1), paletteLen);
        },

        // 23 bullseye-bold (thick circular rings)
        23: (x, y) => {
            const r = Math.hypot(x - cx, y - cy);
            const bandW = Math.max(2, (blockSize * 1.5) | 0);
            const k = Math.floor(r / bandW);
            const e = r % bandW;
            const edge = e < 1 || e > bandW - 2 ? 1 : 0;
            return mod(k + (edge << 1), paletteLen);
        },

        // 24 dots-grid (disc lattice; background hashed per cell)
        24: (x, y) => {
            const step = Math.max(4, blockSize * 3);
            const bx = Math.floor(x / step),
                by = Math.floor(y / step);
            const cxp = bx * step + step / 2,
                cyp = by * step + step / 2;
            const rr = step * 0.28; // dot radius
            const inside = (x - cxp) ** 2 + (y - cyp) ** 2 <= rr * rr;
            if (inside) return seed & 2; // stable dot color (0 or 2)
            return mod(hash2D(seed, bx, by), paletteLen);
        },

        // 25 waves (sinus stripes)
        25: (x, y) => {
            const amp = Math.max(2, blockSize * 0.8);
            const wl = Math.max(6, blockSize * 4);
            const freq = (Math.PI * 2) / wl;
            const phase = (seed & 1023) * 0.003;
            const yy = y + amp * Math.sin(x * freq + phase);
            const band = Math.floor(yy / Math.max(2, blockSize));
            return mod(band, paletteLen);
        },

        // 26 square-maze (grid walls + corridors)
        26: (x, y) => {
            const cell = Math.max(6, blockSize * 3);
            const wall = Math.max(1, (cell / 6) | 0);
            const gx = x % cell,
                gy = y % cell;
            const onWall = gx < wall || gy < wall;
            if (onWall) return (1 + (seed & 1)) % paletteLen; // wall color
            // corridor shading by checker in cell index
            const tx = (x / cell) | 0,
                ty = (y / cell) | 0;
            return (tx ^ ty) & 1 ? 0 : 3;
        },

        // 27 iso-cubes (isometric 3-shade tiling)
        27: (x, y) => {
            const s = Math.max(6, blockSize * 3);
            // rotate 45° into diamond grid
            const u = Math.floor((x + y) / s);
            const v = Math.floor((x - y) / s);
            // three faces by (u+v) mod 3
            const face = mod(u + v, 3);
            // sprinkle hash to break ties between tiles
            const h = hash2D(seed, u, v);
            return face === 0 ? 1 : face === 1 ? 2 : 3 ^ (h & 1);
        },

        // 28 hex-tiles (axial coords; honeycomb)
        28: (x, y) => {
            // hex radius in pixels (tile scale)
            const s = Math.max(6, blockSize * 3);

            // pointy-top transforms (redblobgames formulas)
            // pixel -> axial (fractional)
            const qf = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / s;
            const rf = ((2 / 3) * y) / s;

            // axial -> cube, then round to nearest hex
            let cx = qf;
            let cz = rf;
            let cy = -cx - cz;

            let rx = Math.round(cx);
            let ry = Math.round(cy);
            let rz = Math.round(cz);

            const xdiff = Math.abs(rx - cx);
            const ydiff = Math.abs(ry - cy);
            const zdiff = Math.abs(rz - cz);

            if (xdiff > ydiff && xdiff > zdiff) {
                rx = -ry - rz;
            } else if (ydiff > zdiff) {
                ry = -rx - rz;
            } else {
                rz = -rx - ry;
            }

            // back to axial (q, r) tile coords
            const q = rx,
                r = rz;

            // color by tile
            return mod(hash2D(seed, q, r), paletteLen);
        },

        // 29 triangles (alternating right triangles)
        29: (x, y) => {
            const s = Math.max(6, blockSize * 3);
            const gx = Math.floor(x / s),
                gy = Math.floor(y / s);
            const lx = x % s,
                ly = y % s;
            const diag = lx + ly < s;
            const base = (gx ^ gy) & 1 ? 1 : 2;
            return diag ? base : base ^ 3;
        },

        // 30 chevron (V stripes from center)
        30: (x, y) => {
            const step = Math.max(2, blockSize);
            const v = Math.floor((Math.abs(x - cx) + (y - cy)) / step);
            return mod(v, paletteLen);
        },

        // 31 grid-rings (dots inside grid rings)
        31: (x, y) => {
            const cell = Math.max(8, blockSize * 4);
            const bx = Math.floor(x / cell),
                by = Math.floor(y / cell);
            const cxp = bx * cell + cell / 2,
                cyp = by * cell + cell / 2;
            const r = Math.hypot(x - cxp, y - cyp);
            const band = Math.max(2, cell / 6);
            const k = Math.floor(r / band);
            return mod(k + (hash2D(seed, bx, by) & 1), paletteLen);
        },
    };
}

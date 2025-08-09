export const PALETTE_BASE = ["#FFFBDE", "#91C8E4", "#749BC2", "#4682A9"];
export const CANVAS_W = 128;
export const CANVAS_H = 128;

// Visible block sizes (must divide 128)
export const BLOCK_OPTIONS = [1, 2, 4, 8, 16];

// Mode names (deterministic by seed; no manual pick)
export const MODE_NAMES = [
    "none",
    "vertical",
    "horizontal",
    "quad",
    "diag",
    "anti-diag",
    "rot4",
    "rings",
    "sectors",
    "stripes",
    "checker",
    "diamonds", // L1 distance bands
    "squares", // Chebyshev rings
    "spiral", // angle + radius swirl bands
    "spokes", // wheel spokes
    "bricks", // staggered brick tiling
    "voronoi", // grid-cell Voronoi
    "value-noise", // bilinear hash noise (quantized)
    "weave", // over/under weave lattice
    "crosshatch", // plus-sign lattice
    "rot45-checker", // 45° rotated checker
    "kaleido8", // 8-way kaleidoscope
];

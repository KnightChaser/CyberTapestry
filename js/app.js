import {
    PALETTE_BASE,
    CANVAS_W,
    CANVAS_H,
    BLOCK_OPTIONS,
    MODE_NAMES,
} from "./constants.js";
import { normalizeHex, hexToSeed32, fmix32, randomHex } from "./utils.js";
import { buildColorIndexer } from "./patterns.js";

const els = {
    seed: document.getElementById("seedInput"),
    rand: document.getElementById("randomBtn"),
    render: document.getElementById("renderBtn"),
    copy: document.getElementById("copyBtn"),
    canvas: document.getElementById("art"),
    palette: document.getElementById("palette"),
    modeBadge: document.getElementById("modeBadge"),
    blockBadge: document.getElementById("blockBadge"),
    normSeed: document.getElementById("normSeed"),
    download: document.getElementById("downloadBtn"),
    exportScale: document.getElementById("exportScale"),
};

let lastState = { seedHex: "", modeName: "", blockSize: 0 };

// Palette swatches (fixed)
PALETTE_BASE.forEach((c) => {
    const d = document.createElement("div");
    d.className = "swatch";
    d.style.background = c;
    els.palette.appendChild(d);
});

function renderFromHex(hexIn, { updateUrl = true } = {}) {
    const hex = normalizeHex(hexIn);
    els.normSeed.textContent = hex || "(empty → default offset basis)";

    // Update URL for shareability
    if (updateUrl) {
        const url = new URL(window.location.href);
        if (hex) url.searchParams.set("seed", hex);
        else url.searchParams.delete("seed");
        history.replaceState(null, "", url.toString());
    }

    const seed = hexToSeed32(hex);

    // Deterministic block size and mode
    const blockSize =
        BLOCK_OPTIONS[fmix32(seed + 0xbeef) % BLOCK_OPTIONS.length];
    const modeIdx = fmix32(seed + 0x1234) % MODE_NAMES.length;
    els.blockBadge.textContent = `block: ${blockSize} px`;
    els.modeBadge.textContent = `mode: ${MODE_NAMES[modeIdx]}`;

    // Save last state for potential future use
    lastState.seedHex = hex;
    lastState.modeName = MODE_NAMES[modeIdx];
    lastState.blockSize = blockSize;

    // Deterministic palette rotation
    const rotation = fmix32(seed + 0x5a5a) % 4;
    const palette = PALETTE_BASE.map(
        (_, i) => PALETTE_BASE[(i + rotation) % 4]
    );

    const ctx = els.canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.createImageData(CANVAS_W, CANVAS_H);
    const data = img.data;

    // Build per-mode color indexers
    const indexers = buildColorIndexer(
        seed,
        blockSize,
        palette.length,
        CANVAS_W,
        CANVAS_H
    );
    const colorIndexAt = indexers[modeIdx];

    for (let y = 0; y < CANVAS_H; y++) {
        for (let x = 0; x < CANVAS_W; x++) {
            let cidx = colorIndexAt(x, y);
            cidx = ((cidx % palette.length) + palette.length) % palette.length; // normalize
            const col = palette[cidx];

            const r = parseInt(col.slice(1, 3), 16);
            const g = parseInt(col.slice(3, 5), 16);
            const b = parseInt(col.slice(5, 7), 16);
            const i = (y * CANVAS_W + x) * 4;
            data[i + 0] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}

// Wire up UI
els.render.addEventListener("click", () => renderFromHex(els.seed.value));
els.rand.addEventListener("click", () => {
    els.seed.value = randomHex(32);
    renderFromHex(els.seed.value);
});
els.copy.addEventListener("click", async () => {
    renderFromHex(els.seed.value, { updateUrl: true });
    try {
        await navigator.clipboard.writeText(window.location.href);
        els.copy.textContent = "Copied!";
        setTimeout(() => (els.copy.textContent = "Copy link"), 1000);
    } catch {
        els.copy.textContent = "Copy failed";
        setTimeout(() => (els.copy.textContent = "Copy link"), 1200);
    }
});
els.seed.addEventListener("keydown", (e) => {
    if (e.key === "Enter") renderFromHex(els.seed.value);
});
els.download.addEventListener("click", () => {
    downloadPNG(els.exportScale.value);
});

function downloadPNG(scale = 4) {
    const s = Number(scale) || 4;
    const src = els.canvas;
    const w = src.width * s,
        h = src.height * s;

    // draw to an offscreen canvas without smoothing
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.drawImage(src, 0, 0, w, h);

    // build filename
    const seedPart = lastState.seedHex || "seed";
    const modePart = lastState.modeName || "mode";
    const file = `entropy-${seedPart}-${modePart}-${w}x${h}.png`;

    // trigger download
    off.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(a.href);
        a.remove();
    }, "image/png");
}

// Boot from URL or default
const params = new URLSearchParams(window.location.search);
const urlSeed = normalizeHex(params.get("seed") || "");
els.seed.value = urlSeed || "deadbeefcafefeed8badf00d";
renderFromHex(els.seed.value, { updateUrl: !urlSeed });

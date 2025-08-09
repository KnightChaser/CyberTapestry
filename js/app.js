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
    frame: document.getElementById("frame"),
    cal: document.getElementById("cal"),
};

let lastState = { seedHex: "", modeName: "", blockSize: 0 };

// Palette swatches (fixed)
PALETTE_BASE.forEach((c) => {
    const d = document.createElement("div");
    d.className = "swatch";
    d.style.background = c;
    els.palette.appendChild(d);
});

/**
 * Renders the canvas from a hex seed value.
 * @param {*} hexIn - The hex seed input.
 * @param {*} param1 - Additional parameters.
 */
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
    drawCalibration();

    // Update frame size to match canvas
    window.addEventListener("resize", drawCalibration);
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

/**
 * Downloads the current canvas as a PNG file.
 * @param {*} scale - The scale factor for the exported image.
 */
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

function drawCalibration() {
    const art = els.canvas;
    const cal = els.cal;
    const frame = els.frame;

    if (!art || !cal || !frame) return;

    // displayed size (CSS px) vs intrinsic (logical) size
    const artCssW = art.clientWidth;
    const artCssH = art.clientHeight;
    const scaleX = artCssW / art.width; // e.g. 512/128 = 4
    const scaleY = artCssH / art.height; // should be equal, but keep general

    // read the actual gutter from CSS so math stays honest
    const cs = getComputedStyle(frame);
    const gutter = parseFloat(cs.paddingLeft) || 16; // frame padding (we draw ticks here)

    // canvas CSS size (cal overlays the whole frame box)
    const calCssW = Math.round(artCssW + gutter * 2);
    const calCssH = Math.round(artCssH + gutter * 2);

    // device-pixel ratio for crisp lines on HiDPI
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    // set CSS size and backing store size
    cal.style.width = `${calCssW}px`;
    cal.style.height = `${calCssH}px`;
    cal.width = calCssW * dpr;
    cal.height = calCssH * dpr;

    const ctx = cal.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing to CSS pixels
    ctx.clearRect(0, 0, calCssW, calCssH);

    // positions (CSS px)
    const left = gutter,
        top = gutter;
    const right = left + artCssW;
    const bottom = top + artCssH;

    // tick spacing: every 16 image pixels -> convert to CSS px
    const stepX = 16 * scaleX;
    const stepY = 16 * scaleY;
    const longEvery = 4; // long tick every 64 img px
    const shortLen = 6;
    const longLen = 10;

    // neon-ish style
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(91,211,255,0.85)";
    ctx.shadowColor = "rgba(124,247,212,0.25)";
    ctx.shadowBlur = 6;

    // helper draws ticks OUTSIDE the art (never covers pixels)
    const vTick = (x, i) => {
        const len = i % longEvery === 0 ? longLen : shortLen;
        const xx = Math.round(x) + 0.5; // align to pixel grid
        ctx.beginPath();
        ctx.moveTo(xx, top - len);
        ctx.lineTo(xx, top - 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(xx, bottom + 0.5);
        ctx.lineTo(xx, bottom + len);
        ctx.stroke();
    };
    const hTick = (y, j) => {
        const len = j % longEvery === 0 ? longLen : shortLen;
        const yy = Math.round(y) + 0.5;
        ctx.beginPath();
        ctx.moveTo(left - len, yy);
        ctx.lineTo(left, yy - 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(right, yy + 0.5);
        ctx.lineTo(right + len, yy);
        ctx.stroke();
    };

    // vertical ticks
    for (let i = 0, x = left; x <= right + 0.01; i++, x = left + i * stepX)
        vTick(x, i);
    // horizontal ticks
    for (let j = 0, y = top; y <= bottom + 0.01; j++, y = top + j * stepY)
        hTick(y, j);
}

// Boot from URL or default
const params = new URLSearchParams(window.location.search);
const urlSeed = normalizeHex(params.get("seed") || "");
els.seed.value = urlSeed || "deadbeefcafefeed8badf00d";
renderFromHex(els.seed.value, { updateUrl: !urlSeed });

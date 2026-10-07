/** Prepared native maps for the poor apartment scene (Klamm p1724): chipped teal plaster, cracked cream
 * floor tiles laid on the diagonal, grimy white wall tiles over a dark wainscot, mauve kitchen paint,
 * a stained ceiling, oxblood sofa leather, a striped woven rug and a blue-grey runner, plus the
 * scene's fitted faces (screens, print, the rent notice and the graffiti sheets keyed to alpha).
 * Every surface is drawn in code from periodic noise, so every tiled map wraps by construction.
 * Run from the materials checkout after npm run build: node scripts/author-scene-poor-apartment.mjs [--maps-only]
 * PBRFORGE_CLI may name a built CLI; every operation pins this checkout's theme database. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const sharp = createRequire(import.meta.url)('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themes = path.join(root, 'themes');
const cli = process.env.PBRFORGE_CLI ?? path.join(root, 'dist/cli/pbrforge.js');
const sources = path.join(root, 'sources/scene-poor-apartment');
const out = path.join(root, 'out/scene-poor-apartment');
const mapsOnly = process.argv.includes('--maps-only');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',') ?? null;
fs.mkdirSync(out, { recursive: true });

// ---------------------------------------------------------------- periodic noise
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (v) => v - Math.floor(v);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** Value noise on a lattice of `p` cells per unit, wrapping at u, v in [0, 1). */
function vnoise(u, v, p, s) {
    const x = u * p, y = v * p, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const w = (i) => ((i % p) + p) % p;
    const a = h2(w(xi), w(yi), s), b = h2(w(xi + 1), w(yi), s), c = h2(w(xi), w(yi + 1), s), d = h2(w(xi + 1), w(yi + 1), s);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}
/** Anisotropic periodic value noise: `px` cells across U, `py` down V (streaks, grain). */
function vnoiseA(u, v, px, py, s) {
    const x = u * px, y = v * py, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const wx = (i) => ((i % px) + px) % px, wy = (i) => ((i % py) + py) % py;
    const a = h2(wx(xi), wy(yi), s), b = h2(wx(xi + 1), wy(yi), s), c = h2(wx(xi), wy(yi + 1), s), d = h2(wx(xi + 1), wy(yi + 1), s);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}
/** Periodic fBm in [0, 1); `p` lattice cells at the first octave, integer `px`, `py` per axis for non-square repeats. */
function fbm(u, v, p, octaves, s, gain = 0.5) {
    let sum = 0, amp = 1, norm = 0;
    for (let o = 0; o < octaves; o++) { sum += amp * vnoise(u, v, p << o, s + o * 101); norm += amp; amp *= gain; }
    return sum / norm;
}
/** Periodic Worley distance (F1, F2) with `p` cells per unit. */
function worley(u, v, p, s) {
    const x = u * p, y = v * p, xi = Math.floor(x), yi = Math.floor(y);
    let f1 = 9, f2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = xi + i, cy = yi + j, wx = ((cx % p) + p) % p, wy = ((cy % p) + p) % p;
        const px = cx + h2(wx, wy, s), py = cy + h2(wx, wy, s + 7);
        const d = Math.hypot(px - x, py - y);
        if (d < f1) { f2 = f1; f1 = d; id = wx * 7919 + wy; } else if (d < f2) f2 = d;
    }
    return { f1, f2, id };
}

// ---------------------------------------------------------------- map writers
function srgb(c) { return clamp(c) <= 0.0031308 ? 12.92 * clamp(c) : 1.055 * Math.pow(clamp(c), 1 / 2.4) - 0.055; }
const lin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
/** An sRGB hex colour as linear rgb: surfaces mix in linear light and write sRGB. */
function hex(h) { const n = parseInt(h.slice(1), 16); return [lin((n >> 16 & 255) / 255), lin((n >> 8 & 255) / 255), lin((n & 255) / 255)]; }
function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }

/** Normal map from a height field in metres, wrapping (`wrap`) or clamped at the edges. */
function normals(height, w, h, worldW, worldH, wrap = true) {
    const out = Buffer.alloc(w * h * 3), sx = worldW / w, sy = worldH / h;
    const at = (x, y) => {
        if (wrap) return height[((y + h) % h) * w + ((x + w) % w)];
        return height[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const nx = -(at(x + 1, y) - at(x - 1, y)) / (2 * sx);
        const ny = (at(x, y + 1) - at(x, y - 1)) / (2 * sy);
        const inv = 1 / Math.hypot(nx, ny, 1), p = (y * w + x) * 3;
        out[p] = Math.round((nx * inv * 0.5 + 0.5) * 255); out[p + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255); out[p + 2] = Math.round((inv * 0.5 + 0.5) * 255);
    }
    return out;
}
async function png(file, data, w, h, channels) { await sharp(data, { raw: { width: w, height: h, channels } }).png({ compressionLevel: 9 }).toFile(file); }
/**
 * Draws one surface: `px(u, v)` returns `{ c: linear rgb, r: roughness, m: metallic, ht: metres, ao, a? }`.
 * Writes the six (or seven) maps to out/<name>/ and returns their paths.
 */
async function surface(name, w, h, world, px, { wrap = true, opacity = false } = {}) {
    const dir = path.join(out, name); fs.mkdirSync(dir, { recursive: true });
    const base = Buffer.alloc(w * h * 3), rough = Buffer.alloc(w * h), metal = Buffer.alloc(w * h), aoMap = Buffer.alloc(w * h);
    const alpha = opacity ? Buffer.alloc(w * h) : null, height = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const s = px(x / w, y / h, x, y), i = y * w + x;
        base[i * 3] = Math.round(srgb(s.c[0]) * 255); base[i * 3 + 1] = Math.round(srgb(s.c[1]) * 255); base[i * 3 + 2] = Math.round(srgb(s.c[2]) * 255);
        rough[i] = Math.round(clamp(s.r) * 255); metal[i] = Math.round(clamp(s.m ?? 0) * 255); aoMap[i] = Math.round(clamp(s.ao ?? 1) * 255);
        height[i] = s.ht ?? 0; if (alpha) alpha[i] = Math.round(clamp(s.a ?? 1) * 255);
    }
    let lo = Infinity, hi = -Infinity; for (const v of height) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const hmap = Buffer.alloc(w * h); for (let i = 0; i < w * h; i++) hmap[i] = Math.round(hi > lo ? (height[i] - lo) / (hi - lo) * 255 : 128);
    const maps = { basecolor: 'basecolor.png', normal: 'normal.png', roughness: 'roughness.png', metallic: 'metallic.png', height: 'height.png', ao: 'ao.png' };
    await png(path.join(dir, maps.basecolor), base, w, h, 3);
    await png(path.join(dir, maps.normal), normals(height, w, h, world[0], world[1], wrap), w, h, 3);
    await png(path.join(dir, maps.roughness), rough, w, h, 1);
    await png(path.join(dir, maps.metallic), metal, w, h, 1);
    await png(path.join(dir, maps.height), hmap, w, h, 1);
    await png(path.join(dir, maps.ao), aoMap, w, h, 1);
    if (alpha) { maps.opacity = 'opacity.png'; await png(path.join(dir, maps.opacity), alpha, w, h, 1); }
    return Object.fromEntries(Object.entries(maps).map(([k, f]) => [k, path.relative(root, path.join(dir, f))]));
}

// ---------------------------------------------------------------- the surfaces
const S = {};

/** Teal paint over grey plaster, dark and even, chipped in small flakes that gather in a few
 *  drifts, grimy and faintly streaked: 2 m square repeat. */
S['teal-chipped'] = async () => surface('teal-chipped', 1024, 1024, [2, 2], (u, v) => {
    const warp = fbm(u, v, 4, 3, 11) - 0.5, warp2 = fbm(u, v, 4, 3, 12) - 0.5;
    const uu = fract(u + warp * 0.05), vv = fract(v + warp2 * 0.05);
    const drift = smooth(0.55, 0.8, fbm(uu, vv, 3, 4, 21));          // where the paint gives up
    const flake = fbm(uu, vv, 48, 3, 31);                             // the edge of each small flake
    const chipField = flake * 0.8 + drift * 0.32;
    const chip = smooth(0.705, 0.715, chipField);                     // 1 where plaster shows
    const rim = smooth(0.69, 0.705, chipField) - chip;                // lifted paint edge
    const tone = fbm(u, v, 6, 5, 41), grime = fbm(u, v, 2, 5, 51), fine = vnoise(u, v, 256, 61);
    const streak = Math.pow(vnoiseA(u, v, 48, 2, 71), 3) * smooth(0.4, 0.9, fbm(u, v, 3, 2, 72));
    let paint = mix(hex('#18545b'), hex('#226a72'), tone);            // the teal coat, uneven
    paint = mix(paint, hex('#0d3034'), smooth(0.45, 0.8, grime) * 0.5);
    paint = mix(paint, hex('#0a2629'), streak * 0.5);
    const under = mix(hex('#5f7674'), hex('#7e908b'), fbm(u, v, 16, 3, 81));    // grey-blue plaster beneath
    let c = mix(paint, under, chip);
    c = mul(c, 0.95 + fine * 0.07 - rim * 0.25);
    const r = lerp(0.6 + tone * 0.1, 0.88, chip) + grime * 0.05;
    const ht = (1 - chip) * 0.0004 + rim * 0.00015 + fine * 0.00008;
    return { c, r, ht, ao: 1 - chip * 0.15 - rim * 0.2 };
});

/** Cream glazed floor tiles laid on the diagonal, 0.42 m squares, dark grout, cracks and wear: 1.2 m repeat. */
S['cream-tile'] = async () => {
    const tileDiag = 0.6 / 1.2; // diagonal pitch in repeat units: two tiles across a repeat each way
    const cracks = new Map();
    return surface('cream-tile', 1024, 1024, [1.2, 1.2], (u, v) => {
        // rotate 45 degrees: a = u + v, b = u - v, both periodic in steps of 1 / tileDiag over the repeat
        const a = (u + v) / tileDiag, b = (u - v) / tileDiag;
        const ia = Math.floor(a), ib = Math.floor(b), fa = a - ia, fb = b - ib;
        // the lattice repeats by (2, 2) across U and (2, -2) down V: eight tiles per repeat, each its own
        const m2 = (n) => ((n % 2) + 2) % 2, ka = m2(ia), kb = m2(ib);
        const key = ka * 4 + kb * 2 + m2((ia - ka + ib - kb) / 2);
        const edge = Math.min(fa, 1 - fa, fb, 1 - fb) * 0.6 / Math.SQRT2 * 1.2; // metres to the joint, roughly
        const grout = 1 - smooth(0.0035, 0.006, edge);
        const bevel = 1 - smooth(0.004, 0.012, edge);
        const t = h2(key, 3, 5), t2 = h2(key, 9, 5);
        let glaze = mix(hex('#cdb98f'), hex('#e3d4b0'), t);
        glaze = mix(glaze, hex('#b7a27a'), smooth(0.6, 0.95, t2) * 0.5);
        const wear = fbm(u, v, 5, 5, 91), stain = smooth(0.58, 0.85, fbm(u, v, 3, 5, 92));
        glaze = mix(glaze, hex('#8c7a5a'), stain * 0.45);
        glaze = mix(glaze, hex('#a89870'), smooth(0.35, 0.75, wear) * 0.35);
        glaze = mul(glaze, 0.93 + vnoise(u, v, 200, 93) * 0.08);
        // a crack through some tiles: a wandering line across the tile's local frame
        let crack = 0;
        if (h2(key, 17, 5) > 0.55) {
            const ang = h2(key, 19, 5) * Math.PI, off = h2(key, 23, 5) - 0.5;
            const lx = fa - 0.5, ly = fb - 0.5;
            const d = Math.abs(lx * Math.sin(ang) - ly * Math.cos(ang) - off * 0.5 + (fbm(fa, fb, 4, 3, 94 + key) - 0.5) * 0.18);
            crack = 1 - smooth(0.004, 0.012, d);
            if (h2(key, 29, 5) > 0.5) { const d2 = Math.abs(lx * Math.cos(ang) + ly * Math.sin(ang) - 0.12) + Math.max(0, lx * Math.sin(ang) - ly * Math.cos(ang)) * 2; crack = Math.max(crack, (1 - smooth(0.004, 0.01, d2)) * 0.9); }
        }
        const groutCol = mix(hex('#2a241c'), hex('#433a2e'), fbm(u, v, 30, 2, 95));
        let c = mix(glaze, groutCol, grout);
        c = mix(c, hex('#2e271f'), crack * 0.85);
        c = mul(c, 1 - bevel * 0.12);
        const r = lerp(lerp(0.32, 0.55, wear), 0.92, Math.max(grout, crack)) + stain * 0.15;
        const ht = -grout * 0.0025 - crack * 0.0012 - bevel * 0.0006 + wear * 0.00005;
        return { c, r, ht, ao: 1 - grout * 0.35 - crack * 0.3 };
    });
};

/** White 0.1 m wall tiles gone grey and yellow, grimy grout, a few stained and a few replaced: 1 m repeat. */
S['white-wall-tile'] = async () => surface('white-wall-tile', 1024, 1024, [1, 1], (u, v) => {
    const n = 10, a = u * n, b = v * n, ia = Math.floor(a), ib = Math.floor(b), fa = a - ia, fb = b - ib;
    const edge = Math.min(fa, 1 - fa, fb, 1 - fb) * 0.1;
    const grout = 1 - smooth(0.0011, 0.0024, edge), bevel = 1 - smooth(0.0024, 0.006, edge);
    const t = h2(ia, ib, 201), odd = h2(ia, ib, 202);
    let glaze = mix(hex('#a4aeab'), hex('#b8c0bc'), t);
    if (odd > 0.93) glaze = mix(hex('#c9c8b4'), hex('#bfc6c4'), h2(ia, ib, 203));       // replaced, not matching
    if (odd < 0.03) glaze = mul(glaze, 0.78);                                            // a stained one
    const grime = smooth(0.45, 0.85, fbm(u, v, 3, 5, 204)), drip = Math.pow(fbm(u, fract(v * 1), 40, 1, 205) * fbm(u, v, 2, 3, 206), 2.5);
    glaze = mix(glaze, hex('#6f7468'), grime * 0.55);
    glaze = mix(glaze, hex('#6d6a58'), drip * 1.4);
    const sheen = 0.96 + vnoise(u, v, 300, 207) * 0.05;
    const groutCol = mix(hex('#5f625a'), hex('#3b3d36'), grime);
    let c = mix(mul(glaze, sheen), groutCol, grout);
    c = mul(c, 1 - bevel * 0.1);
    const r = lerp(0.18 + grime * 0.3, 0.9, grout);
    return { c, r, ht: -grout * 0.0015 - bevel * 0.0004, ao: 1 - grout * 0.3 };
});

/** Dark green-black gloss paint of the wainscot, scuffed by mops and knees: 2 m repeat. */
S['dark-wainscot'] = async () => surface('dark-wainscot', 512, 512, [2, 2], (u, v) => {
    const tone = fbm(u, v, 5, 4, 301), scuff = smooth(0.7, 0.85, fbm(u, v, 12, 4, 302)) * smooth(0.3, 0.7, fbm(u, v, 2, 2, 303));
    let c = mix(hex('#141a17'), hex('#1e2621'), tone);
    c = mix(c, hex('#2c322d'), scuff * 0.4);
    return { c, r: 0.3 + scuff * 0.4 + tone * 0.1, ht: -scuff * 0.0001 };
});

/** Pinkish mauve kitchen paint, dull, with cooking grime: 2 m repeat. */
S['mauve-paint'] = async () => surface('mauve-paint', 1024, 1024, [2, 2], (u, v) => {
    const tone = fbm(u, v, 5, 5, 401), grime = smooth(0.5, 0.85, fbm(u, v, 2, 5, 402)), fine = vnoise(u, v, 256, 403);
    const chip = smooth(0.74, 0.77, fbm(u, v, 3, 3, 404) * 0.6 + fbm(u, v, 24, 3, 405) * 0.45);
    let c = mix(hex('#6e5458'), hex('#7d6265'), tone);
    c = mix(c, hex('#4a3a35'), grime * 0.4);
    c = mix(c, hex('#a9a39a'), chip);
    c = mul(c, 0.95 + fine * 0.07);
    return { c, r: 0.74 + grime * 0.1, ht: (1 - chip) * 0.0003 + fine * 0.00005 };
});

/** Ceiling plaster gone dun with smoke and a leak's tide marks: 3 m repeat. */
S['stained-ceiling'] = async () => surface('stained-ceiling', 1024, 1024, [3, 3], (u, v) => {
    const tone = fbm(u, v, 4, 5, 501), leak = fbm(u, v, 2, 4, 502);
    const tide = Math.max(0, 1 - Math.abs(leak - 0.62) * 40) * 0.6 + Math.max(0, 1 - Math.abs(leak - 0.66) * 60) * 0.4;
    let c = mix(hex('#4a4943'), hex('#5c5a52'), tone);
    c = mix(c, hex('#3b352b'), smooth(0.62, 0.75, leak) * 0.5);
    c = mix(c, hex('#3a3326'), tide * 0.35);
    return { c, r: 0.9, ht: vnoise(u, v, 128, 503) * 0.0003 };
});

/** Oxblood vinyl leather, cracked along the wear, with a dull sheen: 0.5 m repeat. */
S['oxblood-leather'] = async () => surface('oxblood-leather', 1024, 1024, [0.5, 0.5], (u, v) => {
    const pebble = worley(u, v, 90, 601), wear = smooth(0.5, 0.85, fbm(u, v, 3, 4, 602));
    const crackNet = worley(u, v, 18, 603), crack = (1 - smooth(0.0, 0.05, crackNet.f2 - crackNet.f1)) * wear;
    let c = mix(hex('#5a1410'), hex('#7a1e16'), fbm(u, v, 6, 4, 604));
    c = mix(c, hex('#9a4a3a'), wear * 0.35);
    c = mix(c, hex('#2a0a08'), crack * 0.8);
    const r = 0.42 + wear * 0.25 + crack * 0.3;
    return { c, r, ht: (1 - pebble.f1) * 0.0003 - crack * 0.0004 };
});

/** Woven rug in cream, warm grey and charcoal stripes across V (U runs along the rug), frayed and trodden: 1 x 1 m repeat. */
S['striped-rug'] = async () => surface('striped-rug', 1024, 1024, [1, 1], (u, v) => {
    const bands = [['#cfc6b4', 0.09], ['#7c776c', 0.03], ['#d8d0bf', 0.06], ['#3a3833', 0.02], ['#b2aa98', 0.07], ['#605b52', 0.04], ['#d3cab7', 0.08], ['#8b857a', 0.05],
        ['#cfc6b4', 0.06], ['#2f2d29', 0.03], ['#c2baa7', 0.09], ['#76716a', 0.04], ['#d6cebd', 0.07], ['#4a4740', 0.03], ['#bdb4a1', 0.08], ['#9a9488', 0.06], ['#d2c9b6', 0.1]];
    const total = bands.reduce((s, [, w]) => s + w, 0);
    let t = (u + (vnoise(u, v, 64, 701) - 0.5) * 0.004) * total, col = bands[0][0], bi = 0;
    for (const [c, w] of bands) { if (t < w) { col = c; break; } t -= w; bi++; }
    // every other band breaks into dashes along V, the flat-weave's blocks
    if (bi % 2 === 1) { const dash = fract(v * (6 + (bi % 5) * 2) + h2(bi, 1, 709)); if (dash < 0.35) col = bands[(bi + 3) % bands.length][0]; }
    const weave = 0.9 + 0.1 * Math.abs(Math.sin(v * Math.PI * 2 * 180)) * Math.abs(Math.sin(u * Math.PI * 2 * 180));
    const tread = smooth(0.4, 0.8, fbm(u, v, 3, 4, 702)), dirt = fbm(u, v, 6, 4, 703);
    let c = mul(hex(col), weave * (0.95 + dirt * 0.1));
    c = mix(c, hex('#5b5446'), tread * 0.35);
    return { c, r: 0.95, ht: weave * 0.0006 };
});

/** Blue-grey looped runner, matted down its middle: 1 x 1 m repeat. */
S['runner'] = async () => surface('runner', 1024, 1024, [1, 1], (u, v) => {
    const loop = 0.85 + 0.15 * Math.abs(Math.sin(u * Math.PI * 2 * 160) * Math.sin(v * Math.PI * 2 * 160 + u * 3));
    const herring = Math.abs(fract((u * 40) + Math.abs(fract(v * 40) - 0.5)) - 0.5);
    const mat = smooth(0.4, 0.8, fbm(u, v, 3, 4, 801));
    let c = mix(hex('#2d3a44'), hex('#3c4a54'), herring * 1.6);
    c = mul(c, loop * (0.92 + fbm(u, v, 12, 3, 802) * 0.12));
    c = mix(c, hex('#24282a'), mat * 0.3);
    return { c, r: 0.97, ht: loop * 0.0008 };
});

/** Matte charcoal powder-coat of the shelving, rubbed through to steel at the edges of use: 1 m repeat. */
S['black-steel'] = async () => surface('black-steel', 512, 512, [1, 1], (u, v) => {
    const rub = smooth(0.72, 0.85, fbm(u, v, 6, 4, 901)), rust = smooth(0.78, 0.9, fbm(u, v, 4, 4, 902));
    let c = mix(hex('#17191a'), hex('#22252a'), fbm(u, v, 8, 3, 903));
    c = mix(c, hex('#6b6d6e'), rub * 0.6);
    c = mix(c, hex('#4a2a18'), rust * 0.5);
    return { c, r: 0.55 + rust * 0.3 - rub * 0.2, m: rub * 0.8, ht: -rust * 0.0001 };
});

/** Warm brown desk laminate, edges worn pale: 1 m repeat. */
S['desk-laminate'] = async () => surface('desk-laminate', 512, 512, [1, 1], (u, v) => {
    const grain = fbm(u, v, 4, 3, 1001) * 0.4 + vnoiseA(u, v, 96, 2, 1002) * 0.6;
    const wear = smooth(0.7, 0.9, fbm(u, v, 4, 4, 1003));
    let c = mix(hex('#4a2c1c'), hex('#6a3f26'), grain);
    c = mix(c, hex('#8a6a50'), wear * 0.5);
    return { c, r: 0.48 + wear * 0.3 };
});

/** Pale pink-brown wood laminate of the kitchen pass-through, rubbed through to the board: 1 m repeat. */
S['pass-laminate'] = async () => surface('pass-laminate', 512, 512, [1, 1], (u, v) => {
    const grain = Math.pow(fbm(u, fract(v), 3, 4, 1101), 1.4), ring = Math.abs(Math.sin((u * 6 + fbm(u, v, 3, 3, 1102) * 2) * Math.PI * 2));
    let c = mix(hex('#8c6463'), hex('#a57a76'), grain);
    c = mix(c, hex('#6f4b4c'), (1 - ring) * 0.2);
    return { c, r: 0.55 };
});

/** Off-white terry cloth, greyed: 0.5 m repeat. */
S['terry'] = async () => surface('terry', 512, 512, [0.5, 0.5], (u, v) => {
    const loop = vnoise(u, v, 256, 1201), rib = 0.85 + 0.15 * Math.abs(Math.sin(v * Math.PI * 2 * 60));
    const dirt = smooth(0.5, 0.9, fbm(u, v, 3, 4, 1202));
    let c = mul(hex('#d8d6cc'), (0.82 + loop * 0.2) * rib);
    c = mix(c, hex('#9a9584'), dirt * 0.35);
    return { c, r: 0.98, ht: loop * 0.0015 };
});

/** Sheer grey-white shower plastic, clouded with limescale toward its hem, about a third opaque: 1 m repeat. */
S['sheer'] = async () => surface('sheer', 512, 512, [1, 1], (u, v) => {
    const cloud = fbm(u, v, 4, 4, 1301), crease = Math.pow(Math.abs(Math.sin((u * 7 + fbm(u, v, 2, 3, 1302) * 0.8) * Math.PI * 2)), 6);
    const c = mix(hex('#c9d2d2'), hex('#e8eeec'), cloud);
    return { c, r: 0.25 + cloud * 0.2, a: 0.22 + cloud * 0.18 + crease * 0.12, ht: crease * 0.0004 };
}, { opacity: true });

/** Flat enamels and plastics with a little wear, for the small things of the scene: 0.5 m repeat. */
function enamel(name, colour, rough, { metal = 0, wear = '#000000', wearAmt = 0.25, seed = 1500 } = {}) {
    S[name] = async () => surface(name, 256, 256, [0.5, 0.5], (u, v) => {
        const tone = fbm(u, v, 4, 3, seed), scuff = smooth(0.7, 0.85, fbm(u, v, 8, 4, seed + 1));
        const c = mix(mul(hex(colour), 0.94 + tone * 0.1), hex(wear), scuff * wearAmt);
        return { c, r: clamp(rough + scuff * 0.2 + tone * 0.05), m: metal * (1 - scuff * 0.5), ht: -scuff * 0.00005 };
    });
}
enamel('red-tool', '#b0261c', 0.32, { wear: '#3a3a36', wearAmt: 0.5, seed: 1510 });
enamel('washer-white', '#d8d6cc', 0.35, { wear: '#7a7564', wearAmt: 0.4, seed: 1520 });
enamel('bin-slate', '#3d4a52', 0.5, { wear: '#9aa3a0', wearAmt: 0.3, seed: 1530 });
enamel('bottle-green', '#1f4a26', 0.12, { seed: 1540, wearAmt: 0 });
enamel('bottle-amber', '#6a3a10', 0.12, { seed: 1550, wearAmt: 0 });
enamel('bottle-clear', '#9fb3ad', 0.08, { seed: 1560, wearAmt: 0 });
enamel('vinyl-grey', '#4a4a48', 0.55, { wear: '#8a8a84', wearAmt: 0.3, seed: 1570 });
enamel('rubber-black', '#161616', 0.85, { seed: 1580, wearAmt: 0 });
enamel('fan-white', '#c9c4b6', 0.5, { wear: '#5a5244', wearAmt: 0.35, seed: 1590 });
enamel('towel-blue', '#3d6f86', 0.95, { seed: 1600, wearAmt: 0.2, wear: '#c8d0cc' });
enamel('blanket', '#3c4652', 0.95, { seed: 1610, wearAmt: 0.25, wear: '#6a7480' });
enamel('ceramic-white', '#d9d8d0', 0.15, { wear: '#8a8670', wearAmt: 0.45, seed: 1620 });
enamel('rust-steel', '#5a5550', 0.6, { metal: 0.7, wear: '#6a3a1a', wearAmt: 0.6, seed: 1630 });

const SURFACES = {
    'teal-chipped': { key: 'cyberpunk/scene-paint/poor', variantId: 'teal-chipped', world: [2, 2], res: 1024, rough: 0.7, orientation: 'isotropic', alpha: false,
        description: 'Teal paint over grey-blue plaster, flaking away in drifts that show the plaster, uneven and grimy, with faint water streaks; graffiti and stains are decals' },
    'cream-tile': { key: 'cyberpunk/scene-floor-tile/poor', variantId: 'cream-cracked', world: [1.2, 1.2], res: 1024, rough: 0.45, orientation: 'isotropic',
        description: 'Cream glazed 0.42 m floor tiles laid on the diagonal, each glaze a little different, dark sunken grout, cracks through some tiles, stains and trodden dull patches' },
    'white-wall-tile': { key: 'cyberpunk/scene-wall-tile/poor', variantId: 'grimy-white', world: [1, 1], res: 1024, rough: 0.3, orientation: 'isotropic',
        description: 'White 0.1 m glazed wall tiles gone grey with grime, dirty grout, a few stained and a few mismatched replacements, drips under the shower line' },
    'dark-wainscot': { key: 'cyberpunk/scene-paint/poor', variantId: 'dark-wainscot', world: [2, 2], res: 512, rough: 0.35, orientation: 'isotropic',
        description: 'Green-black gloss wainscot paint, scuffed pale by mops and knees' },
    'mauve-paint': { key: 'cyberpunk/scene-paint/poor', variantId: 'mauve', world: [2, 2], res: 1024, rough: 0.76, orientation: 'isotropic',
        description: 'Dull pinkish mauve kitchen paint with cooking grime and small chips to grey plaster' },
    'stained-ceiling': { key: 'cyberpunk/scene-paint/poor', variantId: 'stained-ceiling', world: [3, 3], res: 1024, rough: 0.9, orientation: 'isotropic',
        description: 'Dun ceiling plaster yellowed by smoke with a leak\'s brown tide marks' },
    'oxblood-leather': { key: 'cyberpunk/scene-leather/poor', variantId: 'oxblood', world: [0.5, 0.5], res: 1024, rough: 0.5, orientation: 'isotropic',
        description: 'Oxblood vinyl leather with a fine pebble, cracked and paled where it is sat on, dull sheen' },
    'striped-rug': { key: 'cyberpunk/scene-rug/poor', variantId: 'striped', world: [1, 1], res: 1024, rough: 0.95, orientation: 'horizontal',
        description: 'Flat-woven rug in cream, warm grey and charcoal stripes across V, trodden grey down its middle; U runs along the rug' },
    'runner': { key: 'cyberpunk/scene-rug/poor', variantId: 'blue-runner', world: [1, 1], res: 1024, rough: 0.97, orientation: 'isotropic',
        description: 'Blue-grey looped herringbone runner, matted dark down its walking line' },
    'black-steel': { key: 'cyberpunk/scene-steel/poor', variantId: 'black', world: [1, 1], res: 512, rough: 0.6, orientation: 'isotropic',
        description: 'Charcoal powder-coated shelving steel rubbed through to bare metal where it is handled, a little rust' },
    'desk-laminate': { key: 'cyberpunk/scene-laminate/poor', variantId: 'desk-brown', world: [1, 1], res: 512, rough: 0.5, orientation: 'horizontal',
        description: 'Warm brown wood-print desk laminate worn pale at the edges' },
    'pass-laminate': { key: 'cyberpunk/scene-laminate/poor', variantId: 'pass-rose', world: [1, 1], res: 512, rough: 0.55, orientation: 'horizontal',
        description: 'Pale rose-brown wood-print laminate of a kitchen pass-through counter' },
    'sheer': { key: 'cyberpunk/scene-sheer/poor', variantId: 'shower', world: [1, 1], res: 512, rough: 0.3, orientation: 'isotropic', alpha: true,
        description: 'Sheer grey-white shower curtain plastic, about a third opaque, clouded with limescale and creased' },
    ...Object.fromEntries([
        ['red-tool', 'Glossy red painted toolbox steel, chipped to grey at its corners'], ['washer-white', 'Off-white appliance enamel yellowed and scuffed'],
        ['bin-slate', 'Slate blue-grey bin plastic, scuffed pale'], ['bottle-green', 'Dark green bottle glass, glossy'], ['bottle-amber', 'Amber brown bottle glass, glossy'],
        ['bottle-clear', 'Pale grey-green clear bottle glass, glossy'], ['vinyl-grey', 'Grey office-chair vinyl, rubbed pale'], ['rubber-black', 'Black rubber and plastic'],
        ['fan-white', 'Off-white ceiling-fan plastic yellowed by smoke and dust'], ['towel-blue', 'Faded petrol-blue towel cloth'], ['blanket', 'Grey-blue wool blanket, pilled'],
        ['ceramic-white', 'Glazed white sanitary ceramic, stained grey-brown at the waterline'], ['rust-steel', 'Bare steel gone grey with rust blooms'],
    ].map(([name, description]) => [name, { key: 'cyberpunk/scene-enamel/poor', variantId: name, world: [0.5, 0.5], res: 256, rough: 0.5, orientation: 'isotropic', description }])),
    'terry': { key: 'cyberpunk/scene-fabric/poor', variantId: 'terry', world: [0.5, 0.5], res: 512, rough: 0.98, orientation: 'isotropic',
        description: 'Off-white terry cloth greyed by washing' },
};

const requests = [];
for (const [name, spec] of Object.entries(SURFACES)) {
    if (only && !only.includes(name)) continue;
    const t0 = Date.now();
    const maps = await S[name]();
    console.error(`${name}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    requests.push({
        key: spec.key, variantId: spec.variantId, alignment: 'tile', description: spec.description,
        resolution: [spec.res, spec.res], tiling: { worldSize: spec.world },
        physical: { metallicFactor: 1, roughnessFactor: 1, ...(spec.alpha ? { alphaMode: 'BLEND' } : {}) },
        sourceMaps: maps, layout: { family: 'continuous', origin: [0, 0], orientation: spec.orientation },
    });
}
// A key's first variant creates the entry; each further variant of that key appends to it.
// `--replace` redraws the chosen variants in place (with `--only`).
const replace = process.argv.includes('--replace');
const seen = new Set(), first = [], more = [];
for (const r of requests) {
    if (replace) more.push({ ...r, append: true, overwrite: true });
    else if (seen.has(r.key)) more.push({ ...r, append: true }); else { seen.add(r.key); first.push(r); }
}
fs.writeFileSync(path.join(out, 'surfaces.json'), JSON.stringify(first, null, 1));
fs.writeFileSync(path.join(out, 'surfaces-append.json'), JSON.stringify(more, null, 1));
if (!mapsOnly) for (const [file, flags] of [['surfaces.json', []], ['surfaces-append.json', []]]) {
    const result = spawnSync(process.execPath, [cli, 'create', path.join(out, file), '--native', ...flags, '--themes', themes], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    console.log(result.stdout.slice(0, 4000)); if (result.status) { console.error(result.stderr.slice(0, 4000)); process.exit(1); }
}

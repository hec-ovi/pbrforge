/** Fitted faces for the poor apartment scene (Klamm p1724): the wardrobe pod's lit panel, the desk
 * monitor, newsprint, a pizza lid, can wraps, loose papers, a sticker sheet, wall stains and a spill,
 * a cracked mirror and the Grok graffiti sheets keyed from their black ground to alpha.
 * Artwork is drawn in code as SVG (lettering exact) or keyed from the retained Grok sources.
 * Run from the materials checkout after npm run build: node scripts/author-scene-faces.mjs [--maps-only] */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const sharp = createRequire(import.meta.url)('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themes = path.join(root, 'themes');
const cli = process.env.PBRFORGE_CLI ?? path.join(root, 'dist/cli/pbrforge.js');
const grok = path.join(root, 'sources/grok-2026-10-06-art');
const src = path.join(root, 'sources/scene-poor-apartment');
const out = path.join(root, 'out/scene-poor-apartment/faces');
const mapsOnly = process.argv.includes('--maps-only');
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(src, { recursive: true });

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const svg = (w, h, body, bg = null) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${body}</svg>`;
async function raster(name, w, h, body, bg) { const file = path.join(src, `${name}.png`); await sharp(Buffer.from(svg(w, h, body, bg))).flatten(bg ? { background: bg } : false).png().toFile(file); return file; }
async function rasterAlpha(name, w, h, body) { const file = path.join(src, `${name}.png`); await sharp(Buffer.from(svg(w, h, body))).png().toFile(file); return file; }

/** Grain over a print: faint fibres and a soft grime vignette, kept in the source. */
function grain(w, h, seed, n = 900, colour = '#3a3328', max = 0.06) {
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) s += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(r() * 2 + 0.3).toFixed(1)}" fill="${colour}" opacity="${(r() * max).toFixed(3)}"/>`;
    return s;
}
/** Lines of grey text bars standing in for small print. */
function textBars(x, y, w, lines, lh, seed, colour = '#2b2925', h = 0.45) {
    const r = rng(seed); let s = '';
    for (let i = 0; i < lines; i++) { const lw = w * (i === lines - 1 ? 0.3 + r() * 0.4 : 0.82 + r() * 0.18); let cx = x; while (cx < x + lw) { const ww = 8 + r() * 40; s += `<rect x="${cx.toFixed(1)}" y="${(y + i * lh).toFixed(1)}" width="${Math.min(ww, x + lw - cx).toFixed(1)}" height="${(lh * h).toFixed(1)}" fill="${colour}" opacity="0.8"/>`; cx += ww + 5 + r() * 4; } }
    return s;
}

const FACES = [];

// ---- the wardrobe pod's lit panel: cyan status glass, gauges and readouts (1:2)
FACES.push({ name: 'pod-panel', key: 'cyberpunk/scene-screen/poor', variantId: 'pod-panel', aspect: [1, 2], res: [512, 1024], emissive: 6, rough: 0.08,
    description: 'The wardrobe pod door\'s lit panel: cyan glass with status lines, a humidity gauge and a fabric-care readout, glowing',
    draw: async () => {
        const w = 512, h = 1024; let b = '';
        b += `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a4b52"/><stop offset="0.5" stop-color="#0d6a70"/><stop offset="1" stop-color="#083c42"/></linearGradient></defs>`;
        b += `<rect width="${w}" height="${h}" fill="url(#g)"/>`;
        for (let i = 0; i < 4; i++) b += `<rect x="60" y="${110 + i * 34}" width="${[300, 220, 260, 180][i]}" height="12" rx="3" fill="#8ff6ff" opacity="${0.85 - i * 0.12}"/>`;
        b += `<text x="60" y="88" font-family="DejaVu Sans Mono" font-size="34" font-weight="bold" fill="#b8fbff">WARDROBE·03</text>`;
        b += `<rect x="60" y="300" width="392" height="2" fill="#7deef8" opacity="0.6"/>`;
        b += textBars(60, 330, 380, 6, 30, 3, '#9ff7ff', 0.4);
        b += `<circle cx="170" cy="640" r="70" fill="none" stroke="#9ff7ff" stroke-width="10" opacity="0.9"/><circle cx="170" cy="640" r="70" fill="none" stroke="#0a3a40" stroke-width="10" stroke-dasharray="120 400" />`;
        b += `<text x="170" y="652" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="34" fill="#c8fdff">47%</text>`;
        b += `<circle cx="350" cy="640" r="46" fill="none" stroke="#5fe0ea" stroke-width="6" opacity="0.8"/><text x="350" y="650" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="26" fill="#c8fdff">22°</text>`;
        b += `<text x="60" y="790" font-family="DejaVu Sans Mono" font-size="22" fill="#9ff7ff">CARE CYCLE  02:14</text>`;
        b += `<rect x="60" y="810" width="392" height="10" rx="4" fill="#0a3a40"/><rect x="60" y="810" width="250" height="10" rx="4" fill="#9ff7ff"/>`;
        b += textBars(60, 860, 300, 3, 26, 7, '#7deef8', 0.35);
        b += `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#041c20" stroke-width="18"/>`;
        return raster('pod-panel', w, h, b, '#0a4b52');
    } });

// ---- the desk monitor: a work queue in cyan columns on near-black (16:9)
FACES.push({ name: 'monitor', key: 'cyberpunk/scene-monitor/poor', variantId: 'monitor', aspect: [16, 9], res: [1024, 576], emissive: 4, rough: 0.06,
    description: 'Desk monitor screen: a night-shift work queue in pale cyan columns and status tiles on near-black, glowing',
    draw: async () => {
        const w = 1024, h = 576; let b = '';
        b += `<rect width="${w}" height="${h}" fill="#05090c"/>`;
        b += `<rect x="0" y="0" width="${w}" height="44" fill="#0b2a33"/><text x="24" y="31" font-family="DejaVu Sans Mono" font-size="22" fill="#8fe9ff">SHIFT QUEUE · NIGHT 22:00–06:00</text>`;
        for (let c = 0; c < 4; c++) { const x = 40 + c * 245; b += `<rect x="${x}" y="70" width="220" height="460" fill="#0a161c" stroke="#1d5a6a" stroke-width="2"/>`; for (let r = 0; r < 7; r++) b += `<rect x="${x + 14}" y="${88 + r * 62}" width="${150 + ((c * 7 + r) % 4) * 14}" height="40" fill="${(c + r) % 5 === 0 ? '#3fd0f0' : '#123a46'}" opacity="0.9"/>`; }
        b += textBars(56, 100, 180, 1, 30, 11, '#bff3ff');
        return raster('monitor', w, h, b, '#05090c');
    } });

// ---- the corridor's cold fluorescent tube and the bathroom's: plain lit diffusers (4:1)
for (const [variant, colour, strength, words] of [['cold-tube', '#cfefff', 9, 'cold blue-white'], ['bath-tube', '#e4f4ea', 7, 'greenish white']]) {
    FACES.push({ name: variant, key: 'cyberpunk/scene-tube/poor', variantId: variant, aspect: [4, 1], res: [512, 128], emissive: strength, rough: 0.2,
        description: `A fluorescent tube's opal diffuser glowing ${words}, darker at its end caps`,
        draw: async () => raster(variant, 512, 128, `<defs><linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#2a3236"/><stop offset="0.04" stop-color="${colour}"/><stop offset="0.96" stop-color="${colour}"/><stop offset="1" stop-color="#2a3236"/></linearGradient></defs><rect width="512" height="128" fill="url(#t)"/>`, '#2a3236') });
}

// ---- newsprint spread (4:3)
FACES.push({ name: 'newspaper', key: 'cyberpunk/scene-newsprint/poor', variantId: 'newspaper', aspect: [4, 3], res: [1024, 768], rough: 0.92,
    description: 'Open tabloid spread on grey newsprint: masthead, headline, columns and two halftone photos, creased and stained',
    draw: async () => {
        const w = 1024, h = 768; let b = '';
        b += `<rect width="${w}" height="${h}" fill="#d9d4c4"/><rect x="510" y="0" width="4" height="${h}" fill="#b9b2a0"/>`;
        b += `<text x="40" y="74" font-family="Nimbus Roman" font-weight="bold" font-size="50" fill="#1d1b18">THE NIGHT LEDGER</text>`;
        b += `<rect x="40" y="90" width="440" height="4" fill="#1d1b18"/><text x="40" y="150" font-family="Liberation Sans Narrow" font-weight="bold" font-size="44" fill="#a81d1d">RENT CAP VOTE FAILS</text>`;
        b += `<rect x="40" y="170" width="200" height="150" fill="#6f6a60"/><rect x="40" y="170" width="200" height="150" fill="url(#h)"/>`;
        b += textBars(258, 172, 222, 9, 16, 21) + textBars(40, 340, 210, 22, 16, 22) + textBars(270, 340, 210, 22, 16, 23);
        b += `<text x="554" y="70" font-family="Liberation Sans Narrow" font-weight="bold" font-size="38" fill="#1d1b18">GRID SHUTS 14 BLOCKS</text>`;
        b += textBars(554, 96, 210, 30, 16, 24) + textBars(784, 96, 200, 12, 16, 25);
        b += `<rect x="784" y="300" width="200" height="200" fill="#57534b"/>` + textBars(784, 520, 200, 12, 16, 26);
        b += `<rect x="554" y="610" width="430" height="120" fill="#e9b318" opacity="0.85"/><text x="570" y="680" font-family="Liberation Sans" font-weight="bold" font-size="40" fill="#1d1b18">SLICE 24 · 2 FOR 1</text>`;
        b += grain(w, h, 31, 1500, '#5a4a2e', 0.08);
        b += `<ellipse cx="300" cy="600" rx="90" ry="70" fill="#8a6a3a" opacity="0.18"/>`;
        return raster('newspaper', w, h, b, '#d9d4c4');
    } });

// ---- pizza box lid (1:1)
FACES.push({ name: 'pizza-lid', key: 'cyberpunk/scene-print/poor', variantId: 'pizza-lid', aspect: [1, 1], res: [512, 512], rough: 0.85,
    description: 'Pizza box lid: brown kraft card printed with a red Slice 24 roundel and checkered band, grease-spotted',
    draw: async () => {
        const w = 512, h = 512; let b = '';
        b += `<rect width="${w}" height="${h}" fill="#b08a5c"/>`;
        for (let i = 0; i < 16; i++) b += `<rect x="${i * 32}" y="${i % 2 ? 0 : 0}" width="16" height="22" fill="#9e1c16"/><rect x="${i * 32 + 16}" y="22" width="16" height="22" fill="#9e1c16"/><rect x="${i * 32}" y="468" width="16" height="22" fill="#9e1c16"/><rect x="${i * 32 + 16}" y="490" width="16" height="22" fill="#9e1c16"/>`;
        b += `<circle cx="256" cy="256" r="150" fill="#c22a1e"/><circle cx="256" cy="256" r="128" fill="none" stroke="#f3e2c2" stroke-width="8"/>`;
        b += `<text x="256" y="246" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="66" fill="#f3e2c2">SLICE</text><text x="256" y="320" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="70" fill="#f3e2c2">24</text>`;
        b += `<ellipse cx="370" cy="380" rx="40" ry="28" fill="#5a3c1c" opacity="0.35"/><ellipse cx="140" cy="150" rx="22" ry="16" fill="#5a3c1c" opacity="0.3"/>`;
        b += grain(w, h, 41, 900, '#4a3218', 0.1);
        return raster('pizza-lid', w, h, b, '#b08a5c');
    } });

// ---- can wraps (2:1): U runs round the can
for (const [variant, base, accent, word] of [['can-blue', '#1f4fb8', '#e6eef8', 'VOLT'], ['can-red', '#b8261f', '#f6e6c8', 'BRÜ'], ['can-green', '#2d7a3a', '#f2f0d8', 'KIRIN-G']]) {
    FACES.push({ name: variant, key: 'cyberpunk/scene-can/poor', variantId: variant, aspect: [2, 1], res: [512, 256], rough: 0.3, metallic: 0.6,
        description: `Drink can wrap, ${word} on ${variant.split('-')[1]} aluminium, U round the can`,
        draw: async () => {
            const w = 512, h = 256; let b = `<rect width="${w}" height="${h}" fill="${base}"/>`;
            b += `<rect x="0" y="0" width="${w}" height="18" fill="#c9ccd0"/><rect x="0" y="238" width="${w}" height="18" fill="#c9ccd0"/>`;
            b += `<text x="128" y="150" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="64" fill="${accent}" transform="rotate(-8 128 150)">${word}</text>`;
            b += `<text x="384" y="150" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="64" fill="${accent}" transform="rotate(-8 384 150)">${word}</text>`;
            b += `<rect x="250" y="60" width="12" height="140" fill="${accent}" opacity="0.5"/>`;
            return raster(variant, w, h, b, base);
        } });
}

// ---- loose papers: an invoice, a payslip and a printout tossed on the desk (1:√2)
FACES.push({ name: 'papers', key: 'cyberpunk/scene-paper/poor', variantId: 'papers', aspect: [1, 1.414], res: [512, 724], rough: 0.9,
    description: 'Loose A4 printout: a payslip with a table of hours and a red OVERDUE stamp, creased',
    draw: async () => {
        const w = 512, h = 724; let b = `<rect width="${w}" height="${h}" fill="#e8e6de"/>`;
        b += `<text x="40" y="70" font-family="Liberation Sans" font-weight="bold" font-size="28" fill="#222">PAY ADVICE · WEEK 39</text>` + textBars(40, 100, 420, 4, 20, 51);
        for (let r = 0; r < 12; r++) b += `<rect x="40" y="${200 + r * 28}" width="430" height="1.5" fill="#999"/>` + textBars(48, 206 + r * 28, 410, 1, 28, 52 + r, '#333', 0.5);
        b += `<g transform="rotate(-14 330 600)"><rect x="220" y="560" width="230" height="74" fill="none" stroke="#b3241c" stroke-width="7"/><text x="335" y="615" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="44" fill="#b3241c">OVERDUE</text></g>`;
        b += grain(w, h, 53, 500, '#4a4030', 0.07);
        return raster('papers', w, h, b, '#e8e6de');
    } });

// ---- alpha decals: stickers for the pod, water stains, a spill, the cracked mirror, graffiti keyed from Grok's black
async function keyed(name, file, { gain = 1.6, floor = 0.06 } = {}) {
    const img = sharp(file).removeAlpha(); const { width, height } = await img.metadata();
    const raw = await img.raw().toBuffer(); const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const r = raw[i * 3], g = raw[i * 3 + 1], bl = raw[i * 3 + 2], m = Math.max(r, g, bl) / 255;
        const a = Math.min(1, Math.max(0, (m - floor) * gain));
        // un-premultiply against black so the ink keeps its colour where it thins out
        const k = a > 0.01 ? Math.min(1 / Math.max(m, 0.05), 4) : 1;
        rgba[i * 4] = Math.min(255, r * (a > 0.01 ? Math.min(k * m * 1.0 / Math.max(a, 0.2), 3) : 1)); rgba[i * 4 + 1] = Math.min(255, g * (a > 0.01 ? Math.min(k * m / Math.max(a, 0.2), 3) : 1)); rgba[i * 4 + 2] = Math.min(255, bl * (a > 0.01 ? Math.min(k * m / Math.max(a, 0.2), 3) : 1));
        rgba[i * 4 + 3] = Math.round(a * 255);
    }
    const target = path.join(src, `${name}.png`);
    await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(target);
    return target;
}
for (const [name, aspect, res] of [['graffiti-tags-1', [2, 1], [2048, 1024]], ['graffiti-tags-2', [2, 1], [2048, 1024]], ['graffiti-lattice', [2, 1], [2048, 1024]]]) {
    FACES.push({ name, key: 'cyberpunk/scene-graffiti/poor', variantId: name, aspect, res, rough: 0.8, alpha: true, decal: [2, 1],
        description: `Marker and spray scribbles from the Grok ${name} sheet, keyed from black to alpha; a decal over plaster`,
        draw: async () => keyed(name, path.join(grok, `${name}.png`)) });
}
FACES.push({ name: 'stickers', key: 'cyberpunk/scene-decal/poor', variantId: 'stickers', aspect: [1, 1], res: [1024, 1024], rough: 0.5, alpha: true, decal: [0.6, 0.6],
    description: 'A scatter of peeling stickers: band logos, a smiley, a hazard badge, a cat, a barcode and torn remnants; decal for the wardrobe pod',
    draw: async () => {
        const r = rng(77); let b = '';
        const cols = ['#e8463a', '#f2c230', '#2fb8c8', '#f4f1e6', '#1d1d1d', '#d23ea0', '#7ac043'];
        for (let i = 0; i < 26; i++) {
            const x = 60 + r() * 880, y = 60 + r() * 880, s = 40 + r() * 90, rot = (r() - 0.5) * 60, c = cols[Math.floor(r() * cols.length)], c2 = cols[Math.floor(r() * cols.length)];
            const kind = Math.floor(r() * 5);
            b += `<g transform="translate(${x} ${y}) rotate(${rot})">`;
            if (kind === 0) b += `<circle r="${s / 2}" fill="${c}" stroke="#f4f1e6" stroke-width="5"/><circle cx="${-s / 7}" cy="${-s / 10}" r="${s / 16}" fill="#1d1d1d"/><circle cx="${s / 7}" cy="${-s / 10}" r="${s / 16}" fill="#1d1d1d"/><path d="M${-s / 5} ${s / 9} Q0 ${s / 3.5} ${s / 5} ${s / 9}" stroke="#1d1d1d" stroke-width="5" fill="none"/>`;
            else if (kind === 1) b += `<rect x="${-s / 2}" y="${-s / 4}" width="${s}" height="${s / 2}" rx="6" fill="${c}"/><text y="${s / 10}" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="${s / 4}" fill="${c2 === c ? '#1d1d1d' : c2}">${['NOISE', 'RIOT', 'ZERO', 'K-23', 'VOID', 'SLICE'][Math.floor(r() * 6)]}</text>`;
            else if (kind === 2) b += `<polygon points="0,${-s / 2} ${s / 2},${s / 2.4} ${-s / 2},${s / 2.4}" fill="#f2c230" stroke="#1d1d1d" stroke-width="5"/><text y="${s / 4}" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="${s / 2.2}" fill="#1d1d1d">!</text>`;
            else if (kind === 3) { b += `<rect x="${-s / 2}" y="${-s / 3}" width="${s}" height="${s / 1.5}" fill="#f4f1e6"/>`; for (let k = 0; k < 14; k++) b += `<rect x="${-s / 2 + 6 + k * (s - 12) / 14}" y="${-s / 4}" width="${1 + (k * 7 % 3)}" height="${s / 2.4}" fill="#1d1d1d"/>`; }
            else b += `<path d="M${-s / 2} ${-s / 3} L${s / 2} ${-s / 2.5} L${s / 2.2} ${s / 3} L${-s / 2.4} ${s / 2.6} Z" fill="${c}" opacity="0.75"/>`;
            b += `</g>`;
        }
        return rasterAlpha('stickers', 1024, 1024, b);
    } });
FACES.push({ name: 'water-stain', key: 'cyberpunk/scene-decal/poor', variantId: 'water-stain', aspect: [1, 1], res: [1024, 1024], rough: 0.85, alpha: true, decal: [1.2, 1.2],
    description: 'A brown water stain run down from a window corner, tide-lined; decal over plaster',
    draw: async () => {
        let b = `<defs><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="9"/><feDisplacementMap in="SourceGraphic" scale="120"/><feGaussianBlur stdDeviation="6"/></filter>
            <radialGradient id="rg" cx="0.5" cy="0.2" r="0.8"><stop offset="0" stop-color="#4a3418" stop-opacity="0.55"/><stop offset="0.7" stop-color="#5a4220" stop-opacity="0.35"/><stop offset="1" stop-color="#5a4220" stop-opacity="0"/></radialGradient></defs>`;
        b += `<g filter="url(#f)"><path d="M380 40 C 300 200, 340 420, 420 700 C 440 820, 520 960, 600 980 C 640 800, 700 500, 640 300 C 600 160, 520 60, 380 40 Z" fill="url(#rg)"/><path d="M380 40 C 300 200, 340 420, 420 700 C 440 820, 520 960, 600 980" fill="none" stroke="#3a2610" stroke-opacity="0.45" stroke-width="10"/></g>`;
        return rasterAlpha('water-stain', 1024, 1024, b);
    } });
FACES.push({ name: 'spill', key: 'cyberpunk/scene-decal/poor', variantId: 'spill', aspect: [1, 1], res: [512, 512], rough: 0.15, alpha: true, decal: [0.6, 0.6],
    description: 'A dried dark-red drink spill with a splash trail, glossy at its heart; decal over floor tiles',
    draw: async () => {
        let b = `<defs><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="60"/></filter></defs>`;
        b += `<g filter="url(#f)"><ellipse cx="230" cy="260" rx="150" ry="110" fill="#3a0d0a" opacity="0.75"/><ellipse cx="400" cy="200" rx="30" ry="22" fill="#3a0d0a" opacity="0.6"/><ellipse cx="450" cy="160" rx="14" ry="10" fill="#3a0d0a" opacity="0.6"/></g>`;
        return rasterAlpha('spill', 512, 512, b);
    } });
FACES.push({ name: 'mirror-crack', key: 'cyberpunk/scene-decal/poor', variantId: 'mirror-crack', aspect: [1, 1], res: [1024, 1024], rough: 0.05, alpha: true, decal: [0.5, 0.5],
    description: 'A star of cracks from one blow with a dirty haze at the mirror edges; decal over mirror glass',
    draw: async () => {
        const r = rng(91); let b = '<rect width="1024" height="1024" fill="none" stroke="#3b3a30" stroke-opacity="0.45" stroke-width="90"/>';
        const cx = 640, cy = 380;
        for (let i = 0; i < 13; i++) { let x = cx, y = cy, a = (i / 13) * Math.PI * 2 + r() * 0.3, d = ''; d += `M${x} ${y}`; for (let k = 0; k < 8; k++) { a += (r() - 0.5) * 0.5; const l = 40 + r() * 90; x += Math.cos(a) * l; y += Math.sin(a) * l; d += ` L${x.toFixed(0)} ${y.toFixed(0)}`; } b += `<path d="${d}" stroke="#e8f0f0" stroke-opacity="0.85" stroke-width="${2 + r() * 2}" fill="none"/>`; }
        for (let i = 0; i < 4; i++) b += `<circle cx="${cx}" cy="${cy}" r="${30 + i * 45}" stroke="#e8f0f0" stroke-opacity="0.5" stroke-width="2" fill="none" stroke-dasharray="${20 + i * 10} ${30 + i * 8}"/>`;
        return rasterAlpha('mirror-crack', 1024, 1024, b);
    } });

// ---- Grok's notices and posters, worn on our side: grime toward the edges, creases from being
// folded into a pocket, tape at the corners, a torn edge and a corner peeling off the wall
async function worn(name, file, w, h, seed, { tape = true, peel = 0.18 } = {}) {
    const r = rng(seed);
    const raw = await sharp(file).removeAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer();
    const rgba = Buffer.alloc(w * h * 4);
    const noise = (x, y, f, s) => { const xi = Math.floor(x * f), yi = Math.floor(y * f); const h1 = (a, b) => { let t = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(s, 1274126177); t = Math.imul(t ^ (t >>> 13), 1274126177); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; }; const fx = x * f - xi, fy = y * f - yi; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = h1(xi, yi), b = h1(xi + 1, yi), c = h1(xi, yi + 1), d = h1(xi + 1, yi + 1); return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy; };
    const creaseY = 0.3 + r() * 0.4, creaseX = 0.35 + r() * 0.3;
    const stainX = r(), stainY = r() * 0.4 + 0.5;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, i = (y * w + x);
        const edge = Math.min(u, 1 - u, v * (w / h), (1 - v) * (w / h));
        const grime = Math.min(1, Math.max(0, 1 - edge / 0.12)) * 0.35 + noise(u, v, 6, seed) * 0.18 + noise(u, v, 40, seed + 1) * 0.06;
        const crease = Math.max(0, 1 - Math.abs(v - creaseY - (u - 0.5) * 0.02) * 220) * 0.25 + Math.max(0, 1 - Math.abs(u - creaseX) * 260) * 0.18;
        const stain = Math.max(0, 1 - Math.hypot((u - stainX) * 1.2, v - stainY) / (0.12 + noise(u, v, 5, seed + 2) * 0.08)) * 0.35;
        let k = 1 - grime * 0.55 - crease * 0.4;
        const warm = [1, 0.96, 0.86];
        for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.max(0, Math.min(255, raw[i * 3 + c] * k * (1 - stain * (c === 2 ? 0.6 : 0.35)) * warm[c]));
        // the torn top edge and the peeled corner (bottom right) show the wall
        const torn = v < 0.012 + noise(u, 0, 60, seed + 3) * 0.02 ? 0 : 1;
        const peeled = (u + (1 - v) * (w / h) * 0.9) > 2 - peel * 2 ? 0 : 1;
        rgba[i * 4 + 3] = 255 * torn * peeled;
    }
    let img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } });
    if (tape) {
        const t = (cx, cy, rot) => `<rect x="${cx - 40}" y="${cy - 14}" width="80" height="28" fill="#d8d0a8" opacity="0.75" transform="rotate(${rot} ${cx} ${cy})"/>`;
        const overlay = svg(w, h, t(w * 0.06, h * 0.03, -30) + t(w * 0.94, h * 0.03, 25) + t(w * 0.06, h * 0.97, 20));
        img = sharp(await img.png().toBuffer()).composite([{ input: Buffer.from(overlay) }]);
    }
    const target = path.join(src, `${name}.png`);
    await img.png().toFile(target);
    return target;
}
FACES.push({ name: 'notice-dream-levy', key: 'cyberpunk/scene-notice/poor', variantId: 'dream-levy', aspect: [1, 1.414], res: [512, 724], rough: 0.85, alpha: true, decal: [0.21, 0.297],
    description: 'The Grok dream levy demand, taped up and worn: creased in four, grimy at the edges, a coffee ring, torn along the top',
    draw: async () => worn('notice-dream-levy', path.join(grok, 'notice-dream-levy.png'), 512, 724, 121, { peel: 0.08 }) });
FACES.push({ name: 'notice-compute', key: 'cyberpunk/scene-notice/poor', variantId: 'compute', aspect: [1, 1.414], res: [512, 724], rough: 0.85, alpha: true, decal: [0.21, 0.297],
    description: 'The Grok compute rationing notice, taped up and worn: creased, grimy at the edges, a stain, torn along the top',
    draw: async () => worn('notice-compute', path.join(grok, 'notice-compute.png'), 512, 724, 131, { peel: 0.1 }) });
FACES.push({ name: 'poster-vesper', key: 'cyberpunk/scene-poster/poor', variantId: 'vesper', aspect: [2, 3], res: [512, 768], rough: 0.8, alpha: true, decal: [0.5, 0.75],
    description: 'The Grok Vesper poster pasted on plaster and left: grimy edges, a crease, a corner peeling off, tape',
    draw: async () => worn('poster-vesper', path.join(grok, 'poster-vesper.png'), 512, 768, 141) });
FACES.push({ name: 'poster-mire-archive', key: 'cyberpunk/scene-poster/poor', variantId: 'mire-archive', aspect: [2, 3], res: [512, 768], rough: 0.8, alpha: true, decal: [0.5, 0.75],
    description: 'The Grok Mire Archive poster pasted on plaster and left: grimy edges, a crease, a corner peeling off, tape',
    draw: async () => worn('poster-mire-archive', path.join(grok, 'poster-mire-archive.png'), 512, 768, 151) });

// ---- write maps and requests
const requests = [];
for (const face of FACES) {
    const file = await face.draw();
    const [w, h] = face.res;
    const base = { key: face.key, variantId: face.variantId, alignment: 'exact', aspect: face.aspect, description: face.description, resolution: face.res };
    if (face.alpha || !face.emissive) {
        // printed and alpha faces go through prepared maps: basecolor (RGB), opacity from its alpha, flat data maps
        const dir = path.join(out, face.name); fs.mkdirSync(dir, { recursive: true });
        const img = sharp(file).resize(w, h, { fit: 'fill' }); const raw = await img.ensureAlpha().raw().toBuffer();
        const rgb = Buffer.alloc(w * h * 3), a = Buffer.alloc(w * h);
        for (let i = 0; i < w * h; i++) { rgb[i * 3] = raw[i * 4]; rgb[i * 3 + 1] = raw[i * 4 + 1]; rgb[i * 3 + 2] = raw[i * 4 + 2]; a[i] = raw[i * 4 + 3]; }
        const flat = (v) => Buffer.alloc(w * h, v), nrm = Buffer.alloc(w * h * 3); for (let i = 0; i < w * h; i++) { nrm[i * 3] = 128; nrm[i * 3 + 1] = 128; nrm[i * 3 + 2] = 255; }
        const write = async (n, data, c) => { const p = path.join(dir, `${n}.png`); await sharp(data, { raw: { width: w, height: h, channels: c } }).png({ compressionLevel: 9 }).toFile(p); return path.relative(root, p); };
        requests.push({ ...base, physical: { metallicFactor: 1, roughnessFactor: 1, ...(face.alpha ? { alphaMode: 'BLEND' } : {}) },
            ...(face.decal ? { decal: { worldSize: [face.decal[0], face.decal[0] * face.aspect[1] / face.aspect[0]], edgeInset: 0.02, surfaceOffset: 0.002, wrapMode: 'clamp', projection: 'surface-fit' } } : {}),
            sourceMaps: { basecolor: await write('basecolor', rgb, 3), normal: await write('normal', nrm, 3), roughness: await write('roughness', flat(Math.round(face.rough * 255)), 1), metallic: await write('metallic', flat(Math.round((face.metallic ?? 0) * 255)), 1), height: await write('height', flat(128), 1), ao: await write('ao', flat(255), 1), ...(face.alpha ? { opacity: await write('opacity', a, 1) } : {}) } });
    } else {
        requests.push({ ...base, physical: { metallicFactor: face.metallic ?? 0, roughnessFactor: face.rough, ...(face.emissive ? { emissiveStrength: face.emissive } : {}) },
            sourceImage: { path: path.relative(root, file) } });
    }
    console.error(`${face.name}: ${path.relative(root, file)}`);
}
// A key's first variant creates the entry; each further variant of that key appends to it.
const seen = new Set(), first = [], more = [];
for (const r of requests) { if (seen.has(r.key)) more.push({ ...r, append: true }); else { seen.add(r.key); first.push(r); } }
fs.writeFileSync(path.join(out, 'faces.json'), JSON.stringify(first, null, 1));
fs.writeFileSync(path.join(out, 'faces-append.json'), JSON.stringify(more, null, 1));
if (!mapsOnly) for (const file of ['faces.json', 'faces-append.json']) {
    const result = spawnSync(process.execPath, [cli, 'create', path.join(out, file), '--native', '--themes', themes], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    console.log(result.stdout.slice(0, 4000)); if (result.status) { console.error(result.stderr.slice(0, 4000)); process.exit(1); }
}

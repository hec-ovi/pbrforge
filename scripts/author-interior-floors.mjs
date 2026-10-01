/** Native photographic floor sets. Run from the materials checkout after npm run build.
 * PBRFORGE_CLI may name a built CLI; every operation pins this checkout's theme database. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const sharp = createRequire(import.meta.url)('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themes = path.join(root, 'themes');
const cli = process.env.PBRFORGE_CLI ?? path.join(root, 'dist/cli/pbrforge.js');
const sourceRoot = path.join(root, 'sources/interior-floors');
const out = path.join(root, 'out/interior-floors');
const n = 1024, tau = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = v => v - Math.floor(v);
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
fs.mkdirSync(out, { recursive: true });
function call(verb, ...args) {
    const result = spawnSync(process.execPath, [cli, verb, ...args, '--themes', themes], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const value = JSON.parse(result.stdout);
    if (!value.ok) throw new Error(`${value.error.code}: ${value.error.message}`);
    return value.data;
}
function closeEdges(data, channels = 1) {
    for (let y = 0; y < n; y++) for (let k = 0; k < channels; k++) {
        const a = (y * n) * channels + k, b = (y * n + n - 1) * channels + k;
        data[a] = data[b] = (data[a] + data[b]) / 2;
    }
    for (let x = 0; x < n; x++) for (let k = 0; k < channels; k++) {
        const a = x * channels + k, b = ((n - 1) * n + x) * channels + k;
        data[a] = data[b] = (data[a] + data[b]) / 2;
    }
    return data;
}
// Cross-fade opposite edges over a short band, preserving the entire source's
// scale. Originals stay untouched; no mirrored feature or baked scene lighting.
function periodic(data, channels = 1) {
    const band = 72;
    for (const axis of [0, 1]) {
        const source = data.slice();
        for (let i = 0; i < band; i++) {
            const w = .5 * (1 - smooth(0, band - 1, i));
            for (let line = 0; line < n; line++) for (let k = 0; k < channels; k++) {
                const a = ((axis ? i * n + line : line * n + i) * channels) + k;
                const b = ((axis ? (n - 1 - i) * n + line : line * n + n - 1 - i) * channels) + k;
                data[a] = source[a] * (1 - w) + source[b] * w;
                data[b] = source[b] * (1 - w) + source[a] * w;
            }
        }
    }
    return closeEdges(data, channels);
}
async function readSource(name) {
    const file = path.join(sourceRoot, name), meta = await sharp(file).metadata();
    if (meta.width < n || meta.height < n) throw new Error(`${name}: native ${meta.width}x${meta.height} is below ${n}; refusing to upscale`);
    const raw = await sharp(file).removeAlpha().resize(n, n, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
    return { data: periodic(Uint8Array.from(raw), 3), file: name, originalSize: [meta.width, meta.height], sha256: hash(file) };
}
async function readWear(name) {
    const file = path.join(root, 'sources/surface-remaster/raw', `${name}.png`);
    const raw = await sharp(file).removeAlpha().resize(n, n, { fit: 'fill' }).greyscale().raw().toBuffer();
    const histogram = Array.from(raw).sort((a, b) => a - b), lo = histogram[Math.floor(raw.length * .03)], hi = histogram[Math.floor(raw.length * .97)];
    return periodic(Float32Array.from(raw, v => clamp((v - lo) / Math.max(1, hi - lo))));
}
function sample(map, u, v) { return map[Math.floor(fract(v) * n) * n + Math.floor(fract(u) * n)]; }
function channelStats(data, stride = 1, offset = 0) {
    let min = Infinity, max = -Infinity, mean = 0;
    for (let i = offset; i < data.length; i += stride) { min = Math.min(min, data[i]); max = Math.max(max, data[i]); mean += data[i] / (data.length / stride); }
    return { min, max, mean };
}
function normals(heightMetres, world) {
    const normal = new Uint8Array(n * n * 3), step = world / (n - 1);
    const at = (x, y) => heightMetres[((y + n) % n) * n + ((x + n) % n)];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const nx = -(at(x + 1, y) - at(x - 1, y)) / (2 * step);
        const ny = (at(x, y + 1) - at(x, y - 1)) / (2 * step); // +Y tangent normal: image rows point down.
        const inv = 1 / Math.hypot(nx, ny, 1), p = (y * n + x) * 3;
        normal[p] = Math.round((nx * inv * .5 + .5) * 255);
        normal[p + 1] = Math.round((ny * inv * .5 + .5) * 255);
        normal[p + 2] = Math.round((inv * .5 + .5) * 255);
    }
    return closeEdges(normal, 3);
}
const smudge = await readWear('smudge'), fine = await readWear('fingerprint');
const rubber = await readSource('resilient-rubber-source.png');
const specs = [
    { id: 'clinic-studs', key: 'cyberpunk/clinic-floor/high_rich', variant: 'studded-resilient', source: rubber,
        world: .64, shape: 'stud', description: 'Charcoal resilient clinical floor; physical round studs at 40 mm pitch, 24 mm diameter and 0.9 mm rise; worn crest polish with fine manufactured rubber grain', physical: { pitchMetres: .04, diameterMetres: .024, riseMetres: .0009 } },
    { id: 'quarter-turn-ribs', key: 'cyberpunk/interior-ribbed-floor/poor', variant: 'quarter-turn', source: rubber,
        world: 1, shape: 'rib', description: 'Fine charcoal resilient ribbed floor modules; 0.5 m square quarter-turn arrangement, 5 mm ribs and 0.35 mm relief, quiet satin crests and rougher grooves', physical: { moduleMetres: .5, ribPitchMetres: .005, riseMetres: .00035, jointMetres: .0015 } },
    { id: 'b2-red-stone', key: 'cyberpunk/b2-floor/rich', variant: 'red-stone', source: await readSource('b2-red-stone-quiet-source.png'),
        world: 2, shape: 'red-stone', description: 'Deep red polished fine-veined interior stone; broad quiet mineral fields, independent restrained cleaning and abrasion response; no baked slab joints and no vein displacement', physical: { maximumGrainReliefMetres: .000008 } },
    { id: 'e6-grey-stone', key: 'cyberpunk/e6-floor/high_rich', variant: 'grey-stone', source: await readSource('e6-grey-stone-source.png'),
        world: 2, shape: 'grey-stone', description: 'Warm light-grey fine branching-vein bathroom stone; fine sealed mineral body, independently authored wipe and dry-water response; no baked joints and negligible stone relief', physical: { maximumGrainReliefMetres: .000008 } },
];
const inventory = [];
for (const spec of specs) {
    const base = spec.source.data.slice(), heightMetres = new Float32Array(n * n), rough = new Float32Array(n * n), ao = new Float32Array(n * n).fill(1);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x, u = x / (n - 1), v = y / (n - 1), wx = u * spec.world, wy = v * spec.world;
        const w = sample(smudge, spec.shape === 'red-stone' ? v + .19 : u + .37, spec.shape === 'red-stone' ? -u + .31 : v + .11);
        const f = sample(fine, u * (spec.world / .25) + .13, v * (spec.world / .25) + .41);
        const grain = (base[i * 3] + base[i * 3 + 1] + base[i * 3 + 2]) / (3 * 255);
        if (spec.shape === 'stud') {
            const dx = (fract(wx / .04) - .5) * .04, dy = (fract(wy / .04) - .5) * .04;
            const r = Math.hypot(dx, dy), top = 1 - smooth(.010, .012, r);
            heightMetres[i] = .0009 * top + (grain - .24) * .000025;
            rough[i] = clamp(.62 + .07 * w + .025 * (f - .5) - top * (.14 + .025 * w), .4, .75);
            ao[i] = 1 - .035 * smooth(.0095, .0115, r) * (1 - smooth(.0115, .0135, r));
        } else if (spec.shape === 'rib') {
            const cellX = Math.min(1, Math.floor(u * 2)), cellY = Math.min(1, Math.floor(v * 2));
            const transverse = (cellX + cellY) % 2 ? wy : wx;
            const ridge = .5 + .5 * Math.cos(tau * transverse / .005);
            const edgeDistance = Math.min(fract(wx / .5), 1 - fract(wx / .5), fract(wy / .5), 1 - fract(wy / .5)) * .5;
            const edge = smooth(.00075, .002, edgeDistance);
            heightMetres[i] = .00035 * ridge * edge + (grain - .24) * .000018;
            rough[i] = clamp(.7 + .055 * (w - .5) + .025 * (f - .5) - .095 * ridge * edge, .53, .8);
            ao[i] = .985 + .015 * ridge * edge;
        } else {
            // Veins remain in the photograph. Microscopic lapping marks are independent
            // from its bright veins: an 8-micrometre maximum relief, never a crack network.
            const micro = Math.sin(tau * u * 83) * Math.cos(tau * v * 79) * .000003;
            heightMetres[i] = micro;
            rough[i] = spec.shape === 'red-stone' ? .2 + .12 * w + .025 * (f - .5) : .25 + .13 * w + .03 * (f - .5);
        }
    }
    periodic(rough); closeEdges(heightMetres); closeEdges(ao);
    const normal = normals(heightMetres, spec.world), height = Float32Array.from(heightMetres, v => clamp(.5 + v / .002));
    const directory = path.join(out, 'prepared', spec.id); fs.mkdirSync(directory, { recursive: true });
    const maps = { basecolor: base, normal, roughness: rough, metallic: new Float32Array(n * n), height, ao };
    const sourceMaps = {}, mapInfo = {};
    for (const [name, data] of Object.entries(maps)) {
        const channels = name === 'basecolor' || name === 'normal' ? 3 : 1;
        const bytes = channels === 3 ? data : Uint8Array.from(data, v => Math.round(clamp(v) * 255));
        const target = path.join(directory, `${name}.png`);
        await sharp(bytes, { raw: { width: n, height: n, channels } }).png().toFile(target);
        sourceMaps[name] = path.relative(root, target);
        mapInfo[name] = { sha256: hash(target), ...channelStats(data) };
    }
    const request = { key: spec.key, variantId: spec.variant, alignment: 'tile', description: spec.description,
        resolution: [n, n], tiling: { worldSize: [spec.world, spec.world] }, sourceMaps,
        physical: { roughnessFactor: 1, metallicFactor: 0 }, layout: { family: 'continuous', origin: [0, 0], orientation: 'isotropic' } };
    const requestPath = path.join(root, 'batch/cyberpunk/interior-floors', `${spec.id}.json`);
    fs.mkdirSync(path.dirname(requestPath), { recursive: true }); fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
    // A CLI built in another checkout resolves relative sources there. Keep the
    // published recipe portable, but give this run explicit absolute inputs.
    const nativeRequestPath = path.join(out, `${spec.id}-native.json`);
    fs.writeFileSync(nativeRequestPath, `${JSON.stringify({ ...request,
        sourceMaps: Object.fromEntries(Object.entries(sourceMaps).map(([name, file]) => [name, path.join(root, file)])) }, null, 2)}\n`);
    const created = process.argv.includes('--prepare-only') ? null : call('create', nativeRequestPath, '--native',
        ...(process.argv.includes('--replace') ? ['--overwrite'] : []));
    const resolved = process.argv.includes('--prepare-only') ? null : call('resolve', spec.key);
    inventory.push({ key: spec.key, variant: spec.variant, source: spec.source.file, nativeSourceSize: spec.source.originalSize,
        sourceSha256: spec.source.sha256, resolution: [n, n], worldSize: [spec.world, spec.world], physicalPattern: spec.physical,
        heightEncoding: 'height map = 0.5 + physical height metres / 0.002; tangent normals computed from physical metre gradients, +Y convention',
        maps: mapInfo, roughness: channelStats(rough), reliefMetres: channelStats(heightMetres), request: path.relative(root, requestPath),
        created, resolved, status: 'technical candidate; real room/reference visual acceptance pending' });
    console.log(`${spec.key}#${spec.variant}: ${process.argv.includes('--prepare-only') ? 'prepared' : 'imported and resolved'} at ${n}x${n}`);
}
fs.writeFileSync(path.join(sourceRoot, 'authoring-index.json'), `${JSON.stringify({ version: 1, tool: 'built-in image_gen source photographs plus authored physical response maps', originalsPreserved: true, noUpscaling: true, entries: inventory }, null, 2)}\n`);

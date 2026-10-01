import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(readFileSync(path.resolve(root, file), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const bindingPath = args.includes('--binding') ? args[args.indexOf('--binding') + 1] : 'bindings/highway-materials.json';
const b = read(bindingPath);
const validate = new Ajv2020({ strict: true }).compile(read('schema/highway-materials.schema.json'));
assert(validate(b), JSON.stringify(validate.errors));
const requiredSlots = ['roadway', 'deck-concrete', 'soffit-concrete', 'pier-concrete', 'barrier-concrete', 'bearing-steel', 'joint-rubber'];
assert.deepEqual(Object.keys(b.slots).sort(), requiredSlots.sort());
assert.equal(b.placementWeathering.mode, 'disabled-until-owner-coordinates');
assert.equal(b.scalarMaps, 'absolute-linear-values');
const channels = ['basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao', 'metallicRoughness'];
const used = new Set(), catalog = new Map(), checked = new Map(), concrete = new Set();
let compressed = 0;
function bytes(relative) {
  const resolved = path.resolve(root, relative);
  assert(resolved.startsWith(root + path.sep), 'texture outside checkout: ' + relative);
  return readFileSync(resolved);
}
async function texture(id, channel, expectedPath, expectedHash) {
  const t = b.textures[id];
  assert(t, 'unknown texture ' + id);
  used.add(id);
  assert.equal(t.path, expectedPath, id + ': source path changed');
  if (expectedHash) assert.equal(t.sha256, expectedHash, id + ': native source hash changed');
  assert.equal(t.colorSpace, /basecolor$/i.test(channel) ? 'srgb' : 'linear', id + ': wrong colour space');
  assert.deepEqual(t.wrap, ['repeat', 'repeat']);
  if (!checked.has(id)) {
    const png = bytes(t.path);
    assert.equal(hash(png), t.sha256, id + ': bytes differ from declared hash');
    const metadata = await sharp(png).metadata();
    assert.deepEqual([metadata.width, metadata.height], t.resolution, id + ': wrong dimensions');
    if (t.ktx2) {
      assert.equal(hash(bytes(t.ktx2)), t.ktx2Sha256, id + ': compressed bytes differ');
      compressed++;
    }
    checked.set(id, true);
  }
}
for (const [name, slot] of Object.entries(b.slots)) {
  assert.equal(slot.tuning.roughnessFactor, 1, name + ': absolute roughness multiplied twice');
  assert.equal(slot.tuning.displacementScale, 0, name + ': macro displacement is not authorized');
  if (slot.source.type === 'catalog') {
    assert.equal(slot.sampling.mode, 'geometry-metres', name);
    const themeName = slot.source.key.split('/')[0];
    if (!catalog.has(themeName)) catalog.set(themeName, read('themes/' + themeName + '/theme.json').entries);
    const entry = catalog.get(themeName)[slot.source.key];
    const variant = entry?.variants.find(v => v.id === slot.source.variant);
    assert(variant, 'unresolved source ' + slot.source.key + '#' + slot.source.variant);
    assert.equal(entry.alignment, 'tile', name);
    assert.deepEqual(slot.sampling.worldSize, variant.tiling?.worldSize ?? entry.tiling.worldSize, name + ': physical repeat differs from source');
    assert.deepEqual(Object.keys(slot.maps).sort(), channels.slice().sort(), name + ': incomplete map set');
    assert.equal(slot.tuning.metalnessFactor, 1, name + ': absolute metal map must use factor 1');
    for (const channel of channels) {
      const relative = 'themes/' + themeName + '/' + variant.maps[channel];
      await texture(slot.maps[channel], channel, relative);
      const t = b.textures[slot.maps[channel]];
      assert.deepEqual(t.resolution, variant.resolution, name + ': catalog resolution differs');
      if (t.ktx2) assert.equal(t.ktx2, 'themes/' + themeName + '/' + variant.ktx2?.[channel], name + ': compressed catalog source mismatch');
    }
    if (name.endsWith('-concrete')) concrete.add(slot.source.key + '#' + slot.source.variant);
  } else {
    assert.equal(name, 'roadway', 'only roadway delegates native asphalt');
    assert.equal(slot.sampling.mode, 'native-world-xz', 'roadway must keep native source sampling');
    const native = read(slot.source.binding), surface = native.surfaces[slot.source.surface];
    assert(surface, 'missing native surface');
    assert.equal(hash(JSON.stringify(surface)), slot.source.surfaceSha256, 'native surface changed');
    assert.equal(hash(JSON.stringify(native.sampling.asphalt)), slot.source.samplingSha256, 'native sampler changed');
    assert.equal(surface.effect, 'asphalt'); assert.equal(surface.uv.mode, 'world-xz');
    assert.deepEqual(slot.sampling.worldSize, native.sampling.asphalt.scale);
    assert.deepEqual(slot.maps, surface.maps, 'native asphalt maps must not be replaced with a selector');
    assert.deepEqual(slot.tuning.normalScale, [surface.parameters.normalScale, surface.parameters.normalScale]);
    assert.deepEqual(slot.tuning.colorGain, [surface.parameters.colorGain, surface.parameters.colorGain, surface.parameters.colorGain]);
    for (const [channel, id] of Object.entries(slot.maps)) {
      const source = native.textures[id];
      assert(source, 'native texture absent: ' + id);
      await texture(id, channel, source.path, source.sha256);
      assert.deepEqual(b.textures[id].resolution, source.resolution, id + ': native resolution differs');
      if (b.textures[id].ktx2) {
        assert.equal(b.textures[id].ktx2, source.ktx2);
        assert.equal(b.textures[id].ktx2Sha256, source.ktx2Sha256);
      }
    }
  }
}
assert.deepEqual([...used].sort(), Object.keys(b.textures).sort(), 'unreferenced textures');
assert.equal(concrete.size, 3, 'three concrete finishes must remain distinct');
const concreteSlots = ['deck-concrete', 'soffit-concrete', 'pier-concrete'];
for (const channel of ['basecolor', 'roughness']) assert.equal(
  new Set(concreteSlots.map(name => b.textures[b.slots[name].maps[channel]].sha256)).size, 3,
  'concrete finishes cannot duplicate ' + channel
);
console.log(JSON.stringify({ ok: true, slots: requiredSlots.length, textures: used.size, compressedTextures: compressed,
  concreteFinishes: concrete.size, absoluteScalarMaps: true, nativeRoadwayPreserved: true,
  placementWeathering: 'disabled; no ownership coordinates inferred', visualAcceptance: false }));

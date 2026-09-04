import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { expect, it } from 'vitest';
import { resolve } from '../src/index.js';
import rooms from '../bindings/window-room-surfaces.json';
import roomSchema from '../schema/window-room-surfaces.schema.json';

const theme = join(dirname(fileURLToPath(import.meta.url)), '../themes/cyberpunk');

it('publishes five scenic room faces and aspect-correct seeded back pools', () => {
  expect(new Ajv2020().validate(roomSchema, rooms)).toBe(true);
  for (const room of Object.values(rooms.rooms)) {
    for (const tier of ['poor', 'mid', 'rich', 'high_rich']) {
      for (const binding of [room.back, room.left, room.right, room.floor, room.ceiling, ...room.backPool]) {
        const entry = resolve(`cyberpunk/${binding.kind}/${tier}`);
        expect(entry.alignment).toBe('exact');
        expect(entry.variants.some(variant => variant.id === binding.variant)).toBe(true);
        const wide = binding.kind === 'window-room-office-wide';
        expect(entry.aspect).toEqual(wide ? [2, 1] : [1, 1]);
      }
    }
  }
  expect(rooms.rooms.office.backPool).toHaveLength(3);
  expect(rooms.rooms.lobby.backPool).toHaveLength(3);
});

it('ships translucent fitted window grime with identical embedded and standalone alpha', async () => {
  for (const kind of ['window-grime-sill', 'window-grime-jamb']) {
    let previousPeak = Infinity;
    for (const tier of ['poor', 'mid', 'rich', 'high_rich']) {
      const entry = resolve(`cyberpunk/${kind}/${tier}`);
      const variant = entry.variants[0];
      expect(entry.physical.alphaMode).toBe('BLEND');
      expect(entry.decal?.projection).toBe('surface-fit');
      const rgba = await sharp(join(theme, variant.maps.basecolor)).raw().toBuffer({ resolveWithObject: true });
      expect(rgba.info.channels).toBe(4);
      const alpha = await sharp(join(theme, variant.maps.basecolor)).extractChannel(3).raw().toBuffer();
      const opacity = await sharp(join(theme, variant.maps.opacity!)).greyscale().raw().toBuffer();
      expect(alpha).toEqual(opacity);
      const peak = alpha.reduce((maximum, value) => Math.max(maximum, value), 0);
      expect(peak).toBeGreaterThan(0);
      expect(peak / 255).toBeLessThan(0.3);
      expect(peak).toBeLessThan(previousPeak);
      previousPeak = peak;
      const [worldWidth, worldHeight] = entry.decal!.worldSize;
      let edgePeak = 0;
      for (let y = 0; y < rgba.info.height; y++) for (let x = 0; x < rgba.info.width; x++) {
        const edge = Math.min((x + 0.5) / rgba.info.width * worldWidth, (rgba.info.width - x - 0.5) / rgba.info.width * worldWidth, (y + 0.5) / rgba.info.height * worldHeight, (rgba.info.height - y - 0.5) / rgba.info.height * worldHeight);
        if (edge < entry.decal!.edgeInset) edgePeak = Math.max(edgePeak, alpha[y * rgba.info.width + x]);
      }
      expect(edgePeak).toBe(0);
      const normal = (await sharp(join(theme, variant.maps.normal)).stats()).channels;
      expect(normal.map(channel => [channel.min, channel.max])).toEqual([[128, 128], [128, 128], [255, 255]]);
    }
  }
});

it('provides continuous concrete and fine satin metal without repeated structural marks', async () => {
  const concrete = resolve('cyberpunk/concrete-monolith/mid');
  expect(concrete.tiling?.worldSize).toEqual([4, 4]);
  expect(concrete.variants.map(variant => variant.id)).toEqual(['cast', 'weathered', 'mineral', 'graphite']);
  for (const variant of concrete.variants) expect(variant.layout?.family).toBe('continuous');
  const louvre = resolve('cyberpunk/exterior-louvre/mid');
  expect(louvre.physical.metallicFactor).toBe(1);
  expect(louvre.physical.roughnessFactor).toBe(0.52);
  const normal = (await sharp(join(theme, louvre.variants[0].maps.normal)).stats()).channels;
  for (const channel of normal.slice(0, 2)) expect(channel.stdev).toBeLessThan(2);
});

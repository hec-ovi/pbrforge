import { join } from 'node:path';
import sharp from 'sharp';
import { expect } from 'vitest';
import type { Variant } from '../../src/index.js';

/** Checks the consumer-visible bytes, without using the producer's packing code. */
export async function expectPackedMap(themeDir: string, variant: Variant): Promise<void> {
  expect(variant.maps.metallicRoughness).toBeDefined();
  const { data, info } = await sharp(join(themeDir, variant.maps.metallicRoughness!))
    .raw().toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([...variant.resolution, 3]);
  const red = Buffer.alloc(info.width * info.height);
  const green = Buffer.alloc(red.length);
  const blue = Buffer.alloc(red.length);
  for (let pixel = 0; pixel < red.length; pixel++) {
    red[pixel] = data[pixel * 3];
    green[pixel] = data[pixel * 3 + 1];
    blue[pixel] = data[pixel * 3 + 2];
  }
  expect(red.equals(Buffer.alloc(red.length, 255)), `${variant.id}: red`).toBe(true);
  expect(green.equals(await sharp(join(themeDir, variant.maps.roughness)).extractChannel(0).raw().toBuffer()),
    `${variant.id}: roughness`).toBe(true);
  expect(blue.equals(await sharp(join(themeDir, variant.maps.metallic)).extractChannel(0).raw().toBuffer()),
    `${variant.id}: metallic`).toBe(true);
}

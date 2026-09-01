import type { Recolor } from '../db/types.js';
import { parseHex, tintToward } from './color.js';
import type { Rgb } from './pixels.js';

/**
 * A tint variant of a photographed surface: the same grain, wear and seams,
 * pulled toward another color, so two buildings side by side are the same
 * material in different paint instead of the same picture twice.
 */
export function recolor(source: Rgb, tint: Recolor): Rgb {
  const target = parseHex(tint.color);
  const strength = tint.strength ?? 0.4;
  const value = tint.value ?? 1;
  const data = new Uint8Array(source.data.length);
  for (let i = 0; i < source.data.length; i += 3) {
    const shifted = tintToward(
      { r: source.data[i] / 255, g: source.data[i + 1] / 255, b: source.data[i + 2] / 255 },
      target,
      strength,
      value,
    );
    data[i] = Math.round(shifted.r * 255);
    data[i + 1] = Math.round(shifted.g * 255);
    data[i + 2] = Math.round(shifted.b * 255);
  }
  return { data, width: source.width, height: source.height };
}

/** Color maths shared by the synthesis lanes: parsing, mixing, and HSV shifts. sRGB, 0..1 per channel. */
export interface Color {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Color {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

export function mixColor(a: Color, b: Color, t: number): Color {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/** Multiplies a color by a factor, clamped to the displayable range. */
export function scaleColor(c: Color, factor: number): Color {
  return { r: clamp01(c.r * factor), g: clamp01(c.g * factor), b: clamp01(c.b * factor) };
}

export function toHsv(c: Color): { h: number; s: number; v: number } {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === c.r) h = ((c.g - c.b) / d + 6) % 6;
    else if (max === c.g) h = (c.b - c.r) / d + 2;
    else h = (c.r - c.g) / d + 4;
    h *= 60;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function fromHsv(h: number, s: number, v: number): Color {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = v - c;
  return { r: clamp01(r + m), g: clamp01(g + m), b: clamp01(b + m) };
}

/**
 * Repaints a color: the hue is the paint's, the strength is how much pigment is
 * in it, and the brightness is the surface's own, scaled. A near-grey
 * photograph has an arbitrary hue of its own, so the paint hue is taken whole
 * and the saturation is what moves; that is what makes a blue paint read blue
 * instead of landing halfway between the photograph and the can.
 */
export function tintToward(c: Color, target: Color, strength: number, value: number): Color {
  const { s, v } = toHsv(c);
  const aim = toHsv(target);
  return fromHsv(aim.h, clamp01(s + (aim.s - s) * strength), clamp01(v * value));
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

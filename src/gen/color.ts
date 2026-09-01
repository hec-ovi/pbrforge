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
 * Moves a color part of the way to a target hue and saturation and scales its
 * brightness. Pulling toward a target rather than rotating the hue is what a
 * near-grey photograph needs: rotating leaves it grey and multiplying its
 * saturation amplifies whatever color noise it happens to carry.
 */
export function tintToward(c: Color, target: Color, strength: number, value: number): Color {
  const { h, s, v } = toHsv(c);
  const aim = toHsv(target);
  const turn = (((aim.h - h + 540) % 360) - 180) * strength;
  return fromHsv(h + turn, clamp01(s + (aim.s - s) * strength), clamp01(v * value));
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

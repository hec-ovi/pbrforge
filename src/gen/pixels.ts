import sharp from 'sharp';

/** Single-channel float image; all neighborhood ops wrap toroidally so seamless inputs stay seamless. */
export interface Gray {
  data: Float32Array;
  width: number;
  height: number;
}

export interface Rgb {
  data: Uint8Array; // RGB interleaved
  width: number;
  height: number;
}

export async function decodeRgb(png: Buffer): Promise<Rgb> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

export async function encodeGrayPng(img: Gray): Promise<Buffer> {
  const bytes = new Uint8Array(img.width * img.height);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(Math.min(1, Math.max(0, img.data[i])) * 255);
  return sharp(bytes, { raw: { width: img.width, height: img.height, channels: 1 } }).png().toBuffer();
}

export async function encodeRgbPng(img: Rgb): Promise<Buffer> {
  return sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } }).png().toBuffer();
}

export function luminance(rgb: Rgb): Gray {
  const out = new Float32Array(rgb.width * rgb.height);
  for (let i = 0; i < out.length; i++) {
    out[i] = (0.2126 * rgb.data[i * 3] + 0.7152 * rgb.data[i * 3 + 1] + 0.0722 * rgb.data[i * 3 + 2]) / 255;
  }
  return { data: out, width: rgb.width, height: rgb.height };
}

/** Iterated wrap-around box blur (3 passes approximate a gaussian). */
export function wrapBlur(img: Gray, radius: number, passes = 3): Gray {
  let cur = img.data;
  const { width, height } = img;
  for (let p = 0; p < passes; p++) {
    cur = boxPassX(cur, width, height, radius);
    cur = boxPassY(cur, width, height, radius);
  }
  return { data: cur, width, height };
}

function boxPassX(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(src.length);
  const span = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let dx = -r; dx <= r; dx++) sum += src[row + ((dx + w) % w)];
    for (let x = 0; x < w; x++) {
      out[row + x] = sum / span;
      sum -= src[row + ((x - r + w) % w)];
      sum += src[row + ((x + r + 1) % w)];
    }
  }
  return out;
}

function boxPassY(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(src.length);
  const span = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let dy = -r; dy <= r; dy++) sum += src[((dy + h) % h) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / span;
      sum -= src[((y - r + h) % h) * w + x];
      sum += src[((y + r + 1) % h) * w + x];
    }
  }
  return out;
}

/** Wrap-around Sobel gradients. */
export function wrapSobel(img: Gray): { dx: Float32Array; dy: Float32Array } {
  const { data, width: w, height: h } = img;
  const dx = new Float32Array(w * h);
  const dy = new Float32Array(w * h);
  const at = (x: number, y: number) => data[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      dx[i] =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      dy[i] =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
    }
  }
  return { dx, dy };
}

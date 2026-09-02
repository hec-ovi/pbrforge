import sharp, { type Sharp } from 'sharp';
import { CHARSET, GRID } from '../pattern/GlyphAtlas.js';
import { type Rgb, wrapBlur } from '../pixels.js';
import { layoutWordmark } from './layout.js';

/**
 * Spells a name over a picture from the cells of a letter atlas, the way the
 * sign system does on a facade: one lit cell per character, scaled to the
 * layout and laid over the artwork above a soft dark scrim, so the wordmark
 * reads over any picture. The cells are added over the scrim, so a neon halo
 * keeps its colour and a panel glyph stays solid.
 */
export class AtlasText {
  private cells = new Map<string, Promise<Uint8Array>>();
  private plate?: Promise<number[]>;

  constructor(private atlas: Buffer) {}

  async compose(artwork: Rgb, text: string): Promise<{ shown: Rgb; lines: number }> {
    const { width: w, height: h } = artwork;
    const layout = layoutWordmark(text, w, h);
    const size = Math.round(layout.cell);
    const plate = await this.plateLevel();

    const layer = new Float32Array(w * h * 3);
    for (const placed of layout.cells) {
      if (placed.char === ' ') continue;
      const glyph = await this.cell(placed.char, size);
      const left = Math.round(placed.left);
      const top = Math.round(placed.top);
      for (let y = Math.max(0, -top); y < size && top + y < h; y++) {
        for (let x = Math.max(0, -left); x < size && left + x < w; x++) {
          const at = ((top + y) * w + left + x) * 3;
          const from = (y * size + x) * 3;
          for (let c = 0; c < 3; c++) {
            const lit = Math.max(0, glyph[from + c] - plate[c]) / 255;
            if (lit > layer[at + c]) layer[at + c] = lit;
          }
        }
      }
    }

    const coverage = new Float32Array(w * h);
    for (let i = 0; i < coverage.length; i++) coverage[i] = Math.max(layer[i * 3], layer[i * 3 + 1], layer[i * 3 + 2]);
    const scrim = wrapBlur({ data: coverage, width: w, height: h }, Math.max(2, Math.round(layout.cap * 0.12)), 2);

    const data = new Uint8Array(artwork.data.length);
    for (let i = 0; i < coverage.length; i++) {
      const shade = 1 - 0.85 * Math.min(1, scrim.data[i] * 2.2);
      for (let c = 0; c < 3; c++) {
        data[i * 3 + c] = Math.round(Math.min(255, artwork.data[i * 3 + c] * shade + layer[i * 3 + c] * 255));
      }
    }
    return { shown: { data, width: w, height: h }, lines: layout.lines.length };
  }

  /** One cell of the atlas, scaled to the placed size. */
  private cell(char: string, size: number): Promise<Uint8Array> {
    const key = `${char}@${size}`;
    let cell = this.cells.get(key);
    if (!cell) {
      cell = this.extract(char).then((c) => c.resize(size, size, { kernel: 'lanczos3' }).raw().toBuffer()).then((b) => new Uint8Array(b));
      this.cells.set(key, cell);
    }
    return cell;
  }

  /** The unlit level of the sheet, read off the blank cell, so only the lit glyph lands on the picture. */
  private plateLevel(): Promise<number[]> {
    this.plate ??= this.extract(' ')
      .then((c) => c.stats())
      .then((stats) => stats.channels.slice(0, 3).map((channel) => channel.mean));
    return this.plate;
  }

  private async extract(char: string): Promise<Sharp> {
    const { width, height } = await sharp(this.atlas).metadata();
    const cellWidth = width! / GRID.columns;
    const cellHeight = height! / GRID.rows;
    const index = CHARSET.indexOf(char);
    return sharp(this.atlas)
      .removeAlpha()
      .extract({
        left: (index % GRID.columns) * cellWidth,
        top: Math.floor(index / GRID.columns) * cellHeight,
        width: cellWidth,
        height: cellHeight,
      });
  }
}

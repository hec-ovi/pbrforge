import { ADVANCE, BOX, CAP } from '../alphabet.js';
import { CAP_FILL } from '../pattern/GlyphAtlas.js';

/** One atlas cell placed on the screen: which glyph, and the cell's top-left corner in pixels. */
export interface PlacedCell {
  char: string;
  left: number;
  top: number;
}

export interface Wordmark {
  lines: string[];
  /** Cap height on the screen, in pixels. */
  cap: number;
  /** Side of one placed cell, in pixels. */
  cell: number;
  cells: PlacedCell[];
}

/** The widest a line may run, as a fraction of the screen. */
const MAX_WIDTH = 0.86;
/** Baseline to baseline, in cap heights. */
const LINE_PITCH = 1.35;

/**
 * Where a brand name goes on a screen, from the name and the screen alone: the
 * cap height is a fraction of the short side, the name sits centred over the
 * bottom of the picture, and a name too wide for one line breaks at the space
 * nearest its middle. A line still too wide after that shrinks to fit. Nothing
 * is random, so the same name on the same screen lands on the same pixels.
 */
export function layoutWordmark(text: string, width: number, height: number): Wordmark {
  const portrait = height > width;
  let cap = portrait ? width * 0.16 : height * 0.1;
  const bottom = height * (portrait ? 0.9 : 0.88);
  const maxWidth = width * MAX_WIDTH;

  const lines = lineWidth(text, cap) > maxWidth ? breakAtMiddle(text) : [text];
  const widest = Math.max(...lines.map((line) => lineWidth(line, cap)));
  if (widest > maxWidth) cap *= maxWidth / widest;

  const unit = cap / CAP;
  const cell = cap / CAP_FILL;
  const cells: PlacedCell[] = [];
  lines.forEach((line, row) => {
    const capTop = bottom - cap - (lines.length - 1 - row) * LINE_PITCH * cap;
    const x0 = (width - lineWidth(line, cap)) / 2;
    [...line].forEach((char, i) => {
      cells.push({
        char,
        left: x0 + i * ADVANCE * unit - (cell - BOX * unit) / 2,
        top: capTop - (cell - cap) / 2,
      });
    });
  });
  return { lines, cap, cell, cells };
}

function lineWidth(line: string, cap: number): number {
  return (((line.length - 1) * ADVANCE + BOX) * cap) / CAP;
}

/** Two lines, broken at the space nearest the middle of the text; one line when there is no space. */
function breakAtMiddle(text: string): string[] {
  const middle = text.length / 2;
  let at = -1;
  for (let i = text.indexOf(' '); i >= 0; i = text.indexOf(' ', i + 1)) {
    if (at < 0 || Math.abs(i - middle) < Math.abs(at - middle)) at = i;
  }
  return at < 0 ? [text] : [text.slice(0, at), text.slice(at + 1)];
}

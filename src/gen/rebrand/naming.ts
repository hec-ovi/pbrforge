import { MaterialsError } from '../../db/errors.js';
import { CHARSET } from '../pattern/GlyphAtlas.js';

/** The wordmark as it is spelled: trimmed, single-spaced, uppercased, every character a cell of the letter atlas. */
export function brandText(name: string): string {
  const text = name.trim().replace(/\s+/g, ' ').toUpperCase();
  const outside = [...new Set([...text].filter((c) => !CHARSET.includes(c)))];
  if (outside.length) {
    throw new MaterialsError('E_SCHEMA', `brand name "${name}" has characters outside the letter atlas charset: ${outside.join(' ')}`);
  }
  return text;
}

/** The variant id a brand lands under: `brand:` plus the name as a slug. */
export function brandVariantId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) throw new MaterialsError('E_SCHEMA', `brand name "${name}" has no letter or digit to make a slug of`);
  return `brand:${slug}`;
}

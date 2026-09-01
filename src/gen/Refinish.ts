import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import type { FinishSpec, MaterialEntry, Variant } from '../db/types.js';
import { resolveFinish } from './finish.js';
import { deriveAo, deriveHeight, deriveNormal, deriveRoughness } from './maps.js';
import { decodeRgb, encodeGrayPng, encodeRgbPng } from './pixels.js';

/** What to re-read, and under which finish. */
export interface RefinishRequest {
  key: string;
  finish?: FinishSpec;
}

/**
 * Reads the relief and gloss maps out of a surface already in the database
 * again, under a stated finish. The basecolor is what the diffusion lane
 * produced and is never touched, so a set already approved keeps its look and
 * only changes how the light sits on it.
 */
export class Refinisher {
  constructor(private db: Database) {}

  async refinish(request: RefinishRequest): Promise<{ entry: MaterialEntry; variants: string[] }> {
    const entry = this.db.resolve(request.key);
    if (entry.alignment !== 'tile') {
      throw new MaterialsError('E_SCHEMA', `${entry.key} is an exact placement: its maps carry no relief to read`);
    }
    const finish = resolveFinish(request.finish, entry.physical);
    const themeDir = this.db.themeDir(entry.key.split('/')[0]);
    const wanted = entry.variants.filter(photographed);
    if (!wanted.length) {
      throw new MaterialsError('E_SCHEMA', `${entry.key} has no photographed variants to refinish`);
    }

    for (const variant of wanted) {
      const basecolor = await decodeRgb(readFileSync(join(themeDir, variant.maps.basecolor)));
      const height = deriveHeight(basecolor, finish);
      const files: [keyof Variant['maps'], Buffer][] = [
        ['normal', await encodeRgbPng(deriveNormal(height))],
        ['roughness', await encodeGrayPng(deriveRoughness(height, finish))],
        ['height', await encodeGrayPng(height)],
        ['ao', await encodeGrayPng(deriveAo(height))],
      ];
      for (const [name, buffer] of files) {
        const path = variant.maps[name];
        if (path) writeFileSync(join(themeDir, path), buffer);
      }
    }

    const updated = { ...entry, finish };
    this.db.write(updated, true);
    return { entry: updated, variants: wanted.map((v) => v.id) };
  }
}

/**
 * A variant whose relief is its own to re-read: drawn patterns state their maps
 * from parameters, and a tint points at the relief of the variant it came from,
 * which is refinished on its own turn.
 */
function photographed(variant: Variant): boolean {
  return variant.class !== 'pattern' && dirname(variant.maps.normal) === dirname(variant.maps.basecolor);
}

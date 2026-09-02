import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 as Ajv, type ValidateFunction } from 'ajv/dist/2020.js';
import type { Database } from '../../db/Database.js';
import { MaterialsError } from '../../db/errors.js';
import { variantDir } from '../../db/paths.js';
import type { Business, MaterialEntry, RebrandRequest, Variant } from '../../db/types.js';
import { decodeRgb, encodeRgbPng } from '../pixels.js';
import { screenEmission } from '../screen.js';
import { AtlasText } from './AtlasText.js';
import { brandText, brandVariantId } from './naming.js';
import schema from '../../../schema/rebrand-request.schema.json' with { type: 'json' };

/** The screen kinds every business is advertised on. */
const SCREEN_KINDS = ['ad-screen', 'ad-screen-tall'];

/** Which letter atlas look a tier spells its brands in. */
const LOOK: Record<string, string> = { poor: 'neon', mid: 'neon', rich: 'panel', high_rich: 'panel' };

export interface Branded {
  key: string;
  variantId: string;
  /** The screen variant whose artwork the brand landed on. */
  from: string;
  lines: number;
}

interface Job extends Business {
  text: string;
  id: string;
}

/**
 * Rebrand lane: a business gets its own variant of every screen kind of its
 * tier, the brandless artwork of one existing screen with the name spelled
 * over it from the tier's letter atlas, shown through the same display. No
 * render: image work only, and the same list always writes the same maps.
 */
export class Rebrander {
  private validate: ValidateFunction;
  private atlases = new Map<string, AtlasText>();

  constructor(private db: Database) {
    this.validate = new Ajv().compile(schema);
  }

  async rebrand(request: RebrandRequest): Promise<Branded[]> {
    if (!this.validate(request.businesses)) {
      throw new MaterialsError('E_SCHEMA', 'rebrand request invalid', this.validate.errors);
    }
    // every name is checked before anything is written, so a bad entry in the list costs nothing
    const jobs: Job[] = request.businesses.map((b) => ({ ...b, text: brandText(b.brandName), id: brandVariantId(b.brandName) }));
    const branded: Branded[] = [];
    for (const job of jobs) {
      for (const kind of SCREEN_KINDS) branded.push(await this.brand(request.theme, kind, job));
    }
    return branded;
  }

  private async brand(theme: string, kind: string, job: Job): Promise<Branded> {
    const entry = this.db.resolve(`${theme}/${kind}/${job.tier}`);
    const bases = entry.variants.filter((v) => v.screen);
    if (!bases.length) {
      throw new MaterialsError('E_KEY_NOT_FOUND', `${entry.key} has no screen variant with artwork behind it`);
    }
    const base = bases[pick(`${job.businessKind}/${job.id}`, bases.length)];
    const themeDir = this.db.themeDir(theme);
    const artwork = await decodeRgb(readFileSync(join(themeDir, base.screen!.artwork)));
    const { shown, lines } = await this.atlas(theme, job.tier).compose(artwork, job.text);

    // the folder follows the entry the key resolved to, since an alias has no folder of its own
    const [, entryKind, entryTier] = entry.key.split('/');
    const relDir = variantDir(entryKind, entryTier, job.id);
    mkdirSync(join(themeDir, relDir), { recursive: true });
    writeFileSync(join(themeDir, relDir, 'emission.png'), await encodeRgbPng(screenEmission(shown, base.screen!)));

    const variant: Variant = {
      id: job.id,
      resolution: base.resolution,
      maps: { ...base.maps, emission: join(relDir, 'emission.png') },
    };
    this.db.write(withVariant(entry, variant), true);
    return { key: entry.key, variantId: job.id, from: base.id, lines };
  }

  /** The tier's letter atlas in the tier's look, read once per run. */
  private atlas(theme: string, tier: string): AtlasText {
    let atlas = this.atlases.get(tier);
    if (!atlas) {
      const entry = this.db.resolve(`${theme}/letter-atlas/${tier}`);
      const sheet = entry.variants.find((v) => v.id === LOOK[tier]);
      if (!sheet?.maps.emission) {
        throw new MaterialsError('E_KEY_NOT_FOUND', `${entry.key} has no lit ${LOOK[tier]} sheet`);
      }
      atlas = new AtlasText(readFileSync(join(this.db.themeDir(theme), sheet.maps.emission)));
      this.atlases.set(tier, atlas);
    }
    return atlas;
  }
}

/** The entry with one variant replaced in place, or appended when it is new. */
function withVariant(entry: MaterialEntry, variant: Variant): MaterialEntry {
  const present = entry.variants.some((v) => v.id === variant.id);
  const variants = present ? entry.variants.map((v) => (v.id === variant.id ? variant : v)) : [...entry.variants, variant];
  return { ...entry, variants };
}

/** A stable choice among n, from text alone. */
function pick(text: string, n: number): number {
  return createHash('sha256').update(text).digest().readUInt32BE(0) % n;
}

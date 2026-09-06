import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 as Ajv, type ValidateFunction } from 'ajv/dist/2020.js';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import { variantDir } from '../db/paths.js';
import type { Finish, MapName, MaterialEntry, Physical, Variant } from '../db/types.js';
import { resolveFinish } from '../gen/finish.js';
import { deriveHeight, deriveMetallic, deriveRoughness, reliefMaps } from '../gen/maps.js';
import { PackedMaps } from '../gen/PackedMaps.js';
import { encodeGrayPng, encodeRgbPng } from '../gen/pixels.js';
import { loadPng } from './loadPng.js';
import requestSchema from './request.schema.json' with { type: 'json' };

const KEY = /^([a-z0-9_-]+)\/([a-z0-9_-]+)\/([a-z0-9_-]+)$/;
const MAX_SIDE = 4096;
const MAX_TILE_PIXELS = 1024 * 1024;
const MAX_EXACT_PIXELS = 4096 * 2304;

export interface FromImageRequest {
  key: string;
  path: string;
  alignment?: 'exact' | 'tile';
  description: string;
  aspect?: [number, number];
  tiling?: { worldSize: [number, number] };
  resolution?: [number, number];
  variantId?: string;
  physical?: Physical;
  finish?: { roughness?: [number, number]; grain?: number; relief?: number };
  overwrite?: boolean;
  append?: boolean;
}

/** One native albedo to a dry PBR entry. No seam gate. No emission. */
export class FromImage {
  private validate: ValidateFunction;

  constructor(private db: Database) {
    this.validate = new Ajv({ useDefaults: true }).compile(requestSchema);
  }

  async run(request: FromImageRequest): Promise<MaterialEntry> {
    if (!this.validate(request)) {
      throw new MaterialsError('E_SCHEMA', 'from-image request invalid', this.validate.errors);
    }
    const match = KEY.exec(request.key);
    if (!match) throw new MaterialsError('E_SCHEMA', `key does not match theme/kind/tier: ${request.key}`);
    const [, theme, kind, tier] = match;
    const base = request.append ? this.db.resolve(request.key) : undefined;
    const id = request.variantId ?? '1';
    if (base?.variants.some((variant) => variant.id === id)) {
      throw new MaterialsError('E_KEY_EXISTS', `${request.key} already has variant ${id}`);
    }

    const alignment = base?.alignment ?? request.alignment!;
    const physical = base?.physical ?? request.physical ?? { metallicFactor: 0, roughnessFactor: 0.65 };
    const finish: Finish = base?.finish ?? resolveFinish(request.finish, physical);
    assertDry(physical, finish);

    const [width, height] = request.resolution ?? base?.variants[0]?.resolution ?? [1024, 1024];
    const shape = alignment === 'tile'
      ? (base?.tiling?.worldSize ?? request.tiling!.worldSize)
      : (base?.aspect ?? request.aspect!);
    const expectedWidth = height * (shape[0] / shape[1]);
    if (Math.abs(width - expectedWidth) > 1) {
      throw new MaterialsError(
        'E_SCHEMA',
        `${request.key} resolution ${width}x${height} does not fit ${shape[0]}:${shape[1]} ${alignment} dimensions`,
      );
    }
    const pixels = width * height;
    const limit = alignment === 'tile' ? MAX_TILE_PIXELS : MAX_EXACT_PIXELS;
    if (width > MAX_SIDE || height > MAX_SIDE || pixels > limit) {
      throw new MaterialsError('E_SCHEMA', `${request.key} resolution ${width}x${height} exceeds the ${alignment} map budget`);
    }

    this.db.ensureTheme(theme);
    const albedo = await loadPng(request.path, width, height);
    const heightMap = deriveHeight(albedo, finish);
    const roughness = deriveRoughness(heightMap, finish);
    const files: [MapName, Buffer][] = [
      ['basecolor', await encodeRgbPng(albedo)],
      ...(await reliefMaps(heightMap, roughness)),
      ['metallic', await encodeGrayPng(deriveMetallic(albedo, physical))],
    ];

    const relDir = variantDir(kind, tier, id);
    const absDir = join(this.db.themeDir(theme), relDir);
    mkdirSync(absDir, { recursive: true });
    const maps = {} as Variant['maps'];
    for (const [name, buffer] of files) {
      writeFileSync(join(absDir, `${name}.png`), buffer);
      maps[name] = join(relDir, `${name}.png`);
    }
    const packed = await new PackedMaps(this.db.themeDir(theme)).apply([{
      id,
      class: 'image',
      resolution: [albedo.width, albedo.height],
      maps,
    }]);
    const variant = packed.variants[0];
    if (base) {
      const entry: MaterialEntry = { ...base, variants: [...base.variants, variant] };
      this.db.write(entry, true);
      return entry;
    }
    const entry: MaterialEntry = {
      key: request.key,
      alignment,
      ...(alignment === 'tile' ? { tiling: request.tiling } : { aspect: request.aspect }),
      physical,
      finish,
      variants: [variant],
    };
    this.db.write(entry, request.overwrite ?? false);
    return entry;
  }
}

function assertDry(physical: Physical, finish: Finish): void {
  if (![0, 1].includes(physical.metallicFactor ?? 0)
    || (physical.roughnessFactor ?? 1) < 0.45
    || finish.roughness.some((value) => value < 0.45)
    || (physical.transmission ?? 0) !== 0
    || (physical.emissiveStrength ?? 0) !== 0
    || (physical.alphaMode ?? 'OPAQUE') !== 'OPAQUE') {
    throw new MaterialsError('E_SCHEMA', 'from-image needs an opaque nonemissive dry matte surface');
  }
}

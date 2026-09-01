import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 as Ajv, type ValidateFunction } from 'ajv/dist/2020.js';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import type { CreateRequest, MaterialEntry, Variant } from '../db/types.js';
import { ComfyClient } from './ComfyClient.js';
import { Template, loadPrompt } from './Template.js';
import { decodeRgb, encodeGrayPng, encodeRgbPng } from './pixels.js';
import { deriveAo, deriveEmission, deriveHeight, deriveMetallic, deriveNormal, deriveRoughness } from './maps.js';
import { isSeamless, seamScore } from './seam.js';
import requestSchema from '../../schema/create-request.schema.json' with { type: 'json' };

const KEY = /^([a-z0-9_-]+)\/([a-z0-9_-]+)\/([a-z0-9_-]+)$/;

export class Generator {
  private validateRequest: ValidateFunction;

  constructor(
    private db: Database,
    private comfy: ComfyClient = new ComfyClient(),
    private template: Template = new Template(),
  ) {
    this.validateRequest = new Ajv({ useDefaults: true }).compile(requestSchema);
  }

  async create(request: CreateRequest): Promise<MaterialEntry> {
    if (!this.validateRequest(request)) {
      throw new MaterialsError('E_SCHEMA', 'create request invalid', this.validateRequest.errors);
    }
    const m = KEY.exec(request.key);
    if (!m) throw new MaterialsError('E_SCHEMA', `key does not match theme/kind/tier: ${request.key}`);
    const [, theme, kind, tier] = m;
    if (request.alignment === 'tile' && !request.tiling) {
      throw new MaterialsError('E_SCHEMA', 'tile alignment needs tiling.worldSize');
    }
    if (request.alignment === 'exact' && !request.aspect) {
      throw new MaterialsError('E_SCHEMA', 'exact alignment needs aspect');
    }
    this.db.ensureTheme(theme);
    if (!request.overwrite) {
      try {
        this.db.resolve(request.key);
        throw new MaterialsError('E_KEY_EXISTS', `${request.key} exists; pass overwrite to replace`);
      } catch (e) {
        if (e instanceof MaterialsError && e.code !== 'E_KEY_NOT_FOUND') throw e;
      }
    }

    const [width, height] = request.resolution ?? [1024, 1024];
    const baseSeed = request.seed ?? seedFrom(request.description);
    const positive = `${request.description}, ${loadPrompt('tile-suffix')} ${loadPrompt('material-field')}`;
    const negative = loadPrompt('negative');

    const variants: Variant[] = [];
    for (let v = 0; v < (request.variants ?? 1); v++) {
      const png = await this.comfy.render(
        this.template.build({ positive, negative, seed: baseSeed + v, width, height }),
      );
      variants.push(await this.buildVariant(theme, kind, tier, String(v + 1), png, request));
    }

    const entry: MaterialEntry = {
      key: request.key,
      ...(request.aliases?.length ? { aliases: request.aliases } : {}),
      alignment: request.alignment,
      ...(request.tiling ? { tiling: request.tiling } : {}),
      ...(request.aspect ? { aspect: request.aspect } : {}),
      physical: request.physical ?? {},
      variants,
    };
    this.db.write(entry, request.overwrite ?? false);
    return entry;
  }

  private async buildVariant(
    theme: string,
    kind: string,
    tier: string,
    id: string,
    png: Buffer,
    request: CreateRequest,
  ): Promise<Variant> {
    const basecolor = await decodeRgb(png);
    if (request.alignment === 'tile' && !isSeamless(basecolor)) {
      throw new MaterialsError('E_SEAM_CHECK_FAILED', `variant ${id} of ${request.key} has a visible seam`, seamScore(basecolor));
    }
    const heightMap = deriveHeight(basecolor);
    const emissionMode = request.emission ?? 'none';

    const relDir = join('assets', kind, tier, id);
    const absDir = join(this.db.themeDir(theme), relDir);
    mkdirSync(absDir, { recursive: true });
    const files: [string, Buffer][] = [
      ['basecolor', png],
      ['normal', await encodeRgbPng(deriveNormal(heightMap))],
      ['roughness', await encodeGrayPng(deriveRoughness(heightMap, request.physical ?? {}))],
      ['metallic', await encodeGrayPng(deriveMetallic(basecolor, request.physical ?? {}))],
      ['height', await encodeGrayPng(heightMap)],
      ['ao', await encodeGrayPng(deriveAo(heightMap))],
    ];
    if (emissionMode !== 'none') {
      files.push(['emission', await encodeRgbPng(deriveEmission(basecolor, emissionMode))]);
    }
    const maps = {} as Variant['maps'];
    for (const [name, buffer] of files) {
      writeFileSync(join(absDir, `${name}.png`), buffer);
      maps[name as keyof Variant['maps']] = join(relDir, `${name}.png`);
    }
    return { id, resolution: [basecolor.width, basecolor.height], maps };
  }
}

function seedFrom(text: string): number {
  return createHash('sha256').update(text).digest().readUInt32BE(0) % 2 ** 31;
}

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 as Ajv, type ValidateFunction } from 'ajv/dist/2020.js';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import type { CreateRequest, MapName, MaterialEntry, Screen, Variant } from '../db/types.js';
import { ComfyClient } from './ComfyClient.js';
import { Template, loadPrompt } from './Template.js';
import { type Rgb, decodeRgb, encodeGrayPng, encodeRgbPng } from './pixels.js';
import { synthesizeFlat } from './flat.js';
import {
  constantGray,
  deriveAo,
  deriveEmission,
  deriveHeight,
  deriveMetallic,
  deriveNormal,
  deriveRoughness,
  flatNormal,
} from './maps.js';
import { screenEmission, screenGlass } from './screen.js';
import { stampBrand } from './text.js';
import { isSeamless, seamScore } from './seam.js';
import requestSchema from '../../schema/create-request.schema.json' with { type: 'json' };

const KEY = /^([a-z0-9_-]+)\/([a-z0-9_-]+)\/([a-z0-9_-]+)$/;

/** What one variant is built from: the surface image, plus the display and its artwork on the screen lane. */
interface Source {
  basecolor: Buffer;
  screen?: { spec: Screen; artwork: Buffer };
}

export class Generator {
  private validateRequest: ValidateFunction;

  constructor(
    private db: Database,
    private comfy: ComfyClient = new ComfyClient(),
    private templates: Record<CreateRequest['alignment'], Template> = {
      tile: new Template('sdxl-tile'),
      exact: new Template('sdxl-exact'),
    },
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

    const count = request.emission === 'image' ? request.screens!.length : (request.variants ?? 1);
    const variants: Variant[] = [];
    for (let v = 0; v < count; v++) {
      const source = await this.render(request, v, baseSeed + v, width, height);
      variants.push(await this.buildVariant(theme, kind, tier, String(v + 1), source, request));
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

  /**
   * Screen lane: the surface is dark display glass and ComfyUI paints the flat artwork it shows.
   * Flat lane: near-uniform surfaces are synthesized. Otherwise ComfyUI paints the surface itself.
   */
  private async render(request: CreateRequest, index: number, seed: number, width: number, height: number): Promise<Source> {
    // flatColor and screens are guaranteed by the request schema whenever emission is `image`.
    const flat = () => synthesizeFlat(request.flatColor!, seed, width, height, request.flatNoise);
    if (request.emission === 'image') {
      const spec = request.screens![index];
      return {
        basecolor: await encodeRgbPng(screenGlass(flat(), spec)),
        screen: { spec, artwork: await this.paint(request, index, seed, width, height) },
      };
    }
    if (request.flatColor) return { basecolor: await encodeRgbPng(flat()) };
    return { basecolor: await this.paint(request, index, seed, width, height) };
  }

  private paint(request: CreateRequest, index: number, seed: number, width: number, height: number): Promise<Buffer> {
    const job = { ...prompts(request, index), seed, width, height };
    return this.comfy.render(this.templates[request.alignment].build(job));
  }

  private async buildVariant(
    theme: string,
    kind: string,
    tier: string,
    id: string,
    source: Source,
    request: CreateRequest,
  ): Promise<Variant> {
    const basecolor = await decodeRgb(source.basecolor);
    if (request.alignment === 'tile' && !isSeamless(basecolor)) {
      throw new MaterialsError('E_SEAM_CHECK_FAILED', `variant ${id} of ${request.key} has a visible seam`, seamScore(basecolor));
    }
    const files: [MapName, Buffer][] = [
      ['basecolor', source.basecolor],
      ...(source.screen
        ? await screenMaps(basecolor, source.screen, request)
        : await derivedMaps(basecolor, request)),
    ];

    const relDir = join('assets', kind, tier, id);
    const absDir = join(this.db.themeDir(theme), relDir);
    mkdirSync(absDir, { recursive: true });
    const maps = {} as Variant['maps'];
    for (const [name, buffer] of files) {
      writeFileSync(join(absDir, `${name}.png`), buffer);
      maps[name] = join(relDir, `${name}.png`);
    }
    return { id, resolution: [basecolor.width, basecolor.height], maps };
  }
}

/** Relief maps read out of the surface itself, plus emission masked from its own colors. */
async function derivedMaps(basecolor: Rgb, request: CreateRequest): Promise<[MapName, Buffer][]> {
  const physical = request.physical ?? {};
  const height = deriveHeight(basecolor);
  const mode = request.emission ?? 'none';
  return [
    ['normal', await encodeRgbPng(deriveNormal(height))],
    ['roughness', await encodeGrayPng(deriveRoughness(height, physical))],
    ['metallic', await encodeGrayPng(deriveMetallic(basecolor, physical))],
    ['height', await encodeGrayPng(height)],
    ['ao', await encodeGrayPng(deriveAo(height))],
    ...(mode === 'luminance' || mode === 'color-mask'
      ? ([['emission', await encodeRgbPng(deriveEmission(basecolor, mode))]] as [MapName, Buffer][])
      : []),
  ];
}

/** A display: no relief anywhere, uniform gloss, and the artwork seen through the pixel structure. */
async function screenMaps(
  basecolor: Rgb,
  screen: { spec: Screen; artwork: Buffer },
  request: CreateRequest,
): Promise<[MapName, Buffer][]> {
  const artwork = await decodeRgb(screen.artwork);
  if (artwork.width !== basecolor.width || artwork.height !== basecolor.height) {
    throw new MaterialsError(
      'E_GENERATION_FAILED',
      `artwork is ${artwork.width}x${artwork.height}, the screen surface is ${basecolor.width}x${basecolor.height}`,
    );
  }
  const physical = request.physical ?? {};
  const brandName = screen.spec.brandName ?? request.brandName;
  const shown = brandName ? stampBrand(artwork, brandName) : artwork;
  return [
    ['normal', await encodeRgbPng(flatNormal(basecolor))],
    ['roughness', await encodeGrayPng(constantGray(basecolor, physical.roughnessFactor ?? 1))],
    ['metallic', await encodeGrayPng(deriveMetallic(basecolor, physical))],
    ['height', await encodeGrayPng(constantGray(basecolor, 0.5))],
    ['ao', await encodeGrayPng(constantGray(basecolor, 1))],
    ['emission', await encodeRgbPng(screenEmission(shown, screen.spec))],
  ];
}

/** Prompt lanes: screen artwork, seamless material field, or a straight exact-placement photograph. */
function prompts(request: CreateRequest, index: number): { positive: string; negative: string } {
  const screen = request.screens?.[index];
  const businessKind = screen?.businessKind ?? request.businessKind;
  const subject = [
    businessKind ? `advertisement for a ${businessKind}` : '',
    screen?.description ?? request.description,
  ]
    .filter(Boolean)
    .join(', ');
  if (screen) {
    const lane = screen.kind === 'glyph-panel' ? 'screen-glyph' : 'screen-ad';
    return { positive: `${subject}, ${loadPrompt(lane)}`, negative: loadPrompt(`${lane}-negative`) };
  }
  if (request.alignment === 'tile') {
    return {
      positive: `${subject}, ${loadPrompt('tile-suffix')} ${loadPrompt('material-field')}`,
      negative: loadPrompt('negative'),
    };
  }
  return { positive: subject, negative: loadPrompt('exact-negative') };
}

function seedFrom(text: string): number {
  return createHash('sha256').update(text).digest().readUInt32BE(0) % 2 ** 31;
}

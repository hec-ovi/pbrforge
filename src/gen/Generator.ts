import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 as Ajv, type ValidateFunction } from 'ajv/dist/2020.js';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import type { CreateRequest, Finish, MapName, MaterialEntry, Physical, Screen, Variant } from '../db/types.js';
import { ComfyClient } from './ComfyClient.js';
import { Template, loadPrompt } from './Template.js';
import { type Gray, type Rgb, decodeRgb, encodeGrayPng, encodeRgbPng } from './pixels.js';
import { synthesizeFlat } from './flat.js';
import {
  constantGray,
  deriveEmission,
  deriveHeight,
  deriveMetallic,
  deriveNormal,
  deriveRoughness,
  flatNormal,
  reliefMaps,
} from './maps.js';
import { resolveFinish } from './finish.js';
import { buildPattern } from './pattern/build.js';
import { renderPattern } from './pattern/render.js';
import { recolor } from './recolor.js';
import { screenEmission, screenGlass } from './screen.js';
import { stampBrand } from './text.js';
import { isSeamless, seamScore } from './seam.js';
import requestSchema from '../../schema/create-request.schema.json' with { type: 'json' };

const KEY = /^([a-z0-9_-]+)\/([a-z0-9_-]+)\/([a-z0-9_-]+)$/;

/** What one variant is built from: the surface, its own relief and gloss when it has them, and the screen lane. */
interface Source {
  basecolor: Rgb;
  height?: Gray;
  roughness?: Gray;
  screen?: { spec: Screen; artwork: Rgb };
  /** A tint is the same surface in another paint: it keeps the relief of the variant it came from. */
  reuse?: Variant;
}

/** What the entry being written is: a new one, or the one an appended variant joins. */
interface Target {
  theme: string;
  kind: string;
  tier: string;
  alignment: CreateRequest['alignment'];
  tiling?: { worldSize: [number, number] };
  physical: Physical;
  finish: Finish;
  base?: MaterialEntry;
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
    const target = this.target(request);

    const [width, height] = request.resolution ?? [1024, 1024];
    const baseSeed = request.seed ?? seedFrom(request.description);
    const count = variantCount(request);
    const start = target.base?.variants.length ?? 0;

    const variants: Variant[] = [];
    let photographed = false;
    for (let v = 0; v < count; v++) {
      const id = request.variantId ?? String(start + v + 1);
      if (target.base?.variants.some((existing) => existing.id === id) && !request.overwrite) {
        throw new MaterialsError('E_KEY_EXISTS', `variant ${id} of ${target.base.key} exists; pass overwrite to replace`);
      }
      const source = await this.render(request, target, v, baseSeed + v, width, height);
      photographed ||= !source.screen && !source.reuse && source.height === undefined;
      variants.push(await this.buildVariant(target, id, source, request));
    }

    const entry = this.assemble(request, target, variants, photographed);
    this.db.write(entry, target.base !== undefined || (request.overwrite ?? false));
    return entry;
  }

  /**
   * Where the variant lands: a fresh entry under the request's key, or the
   * entry an append joins, which keeps its own alignment, tiling and physical.
   */
  private target(request: CreateRequest): Target {
    const m = KEY.exec(request.key);
    if (!m) throw new MaterialsError('E_SCHEMA', `key does not match theme/kind/tier: ${request.key}`);
    if (request.recolor && !request.append) {
      throw new MaterialsError('E_SCHEMA', 'recolor takes its source from the entry it is appended to');
    }
    if (request.variantId && variantCount(request) > 1) {
      throw new MaterialsError('E_SCHEMA', 'variantId names one variant; drop it or ask for one variant');
    }
    if ((request.pattern || request.recolor) && (request.variants ?? 1) > 1) {
      throw new MaterialsError('E_SCHEMA', 'the pattern and recolor lanes make one variant per request');
    }
    this.db.ensureTheme(m[1]);

    const base = request.append ? this.db.resolve(request.key) : undefined;
    if (!base && !request.overwrite) {
      try {
        this.db.resolve(request.key);
        throw new MaterialsError('E_KEY_EXISTS', `${request.key} exists; pass overwrite to replace`);
      } catch (e) {
        if (e instanceof MaterialsError && e.code !== 'E_KEY_NOT_FOUND') throw e;
      }
    }

    const alignment = base?.alignment ?? request.alignment;
    const tiling = base?.tiling ?? request.tiling;
    if (alignment === 'tile' && !tiling) {
      throw new MaterialsError('E_SCHEMA', 'tile alignment needs tiling.worldSize');
    }
    if (alignment === 'exact' && !(base?.aspect ?? request.aspect)) {
      throw new MaterialsError('E_SCHEMA', 'exact alignment needs aspect');
    }
    const [, theme, kind, tier] = KEY.exec(base?.key ?? request.key)!;
    const physical = base?.physical ?? request.physical ?? {};
    // an appended variant joins the entry's finish, so every photographed variant of one entry shares a band
    const finish = base?.finish ?? resolveFinish(request.finish, physical);
    return { theme, kind, tier, alignment, tiling, physical, finish, base };
  }

  private assemble(
    request: CreateRequest,
    target: Target,
    variants: Variant[],
    photographed: boolean,
  ): MaterialEntry {
    if (target.base) {
      const existing = target.base.variants;
      const kept = existing.map((v) => variants.find((added) => added.id === v.id) ?? v);
      return { ...target.base, variants: [...kept, ...variants.filter((a) => !existing.some((v) => v.id === a.id))] };
    }
    return {
      key: request.key,
      ...(request.aliases?.length ? { aliases: request.aliases } : {}),
      alignment: request.alignment,
      ...(request.tiling ? { tiling: request.tiling } : {}),
      ...(request.aspect ? { aspect: request.aspect } : {}),
      physical: target.physical,
      // only a photographed surface reads a finish: a pattern and a screen carry their own maps
      ...(photographed ? { finish: target.finish } : {}),
      variants,
    };
  }

  /**
   * Pattern lane: the surface is drawn from its parameters, relief and gloss included.
   * Recolor lane: another variant of the same entry, moved in hue.
   * Screen lane: the surface is dark display glass and ComfyUI paints the flat artwork it shows.
   * Flat lane: near-uniform surfaces are synthesized. Otherwise ComfyUI paints the surface itself.
   */
  private async render(
    request: CreateRequest,
    target: Target,
    index: number,
    seed: number,
    width: number,
    height: number,
  ): Promise<Source> {
    if (request.pattern) {
      // a tiling pattern is drawn in metres of surface; an exact sheet is drawn over itself
      const world = target.tiling?.worldSize ?? ([1, 1] as [number, number]);
      const pattern = buildPattern(request.pattern, world, target.physical.roughnessFactor ?? 1, seed);
      return renderPattern(pattern, width, height);
    }
    if (request.recolor) {
      const from = target.base?.variants.find((v) => v.id === request.recolor!.from);
      if (!from) throw new MaterialsError('E_SCHEMA', `no variant ${request.recolor.from} to recolor on ${request.key}`);
      const source = await decodeRgb(readFileSync(join(this.db.themeDir(target.theme), from.maps.basecolor)));
      return { basecolor: recolor(source, request.recolor), reuse: from };
    }
    // flatColor and screens are guaranteed by the request schema whenever emission is `image`.
    const flat = () => synthesizeFlat(request.flatColor!, seed, width, height, request.flatNoise);
    if (request.emission === 'image') {
      const spec = request.screens![index];
      return {
        basecolor: screenGlass(flat(), spec),
        screen: { spec, artwork: await decodeRgb(await this.paint(request, index, seed, width, height)) },
      };
    }
    if (request.flatColor) return { basecolor: flat() };
    return { basecolor: await decodeRgb(await this.paint(request, index, seed, width, height)) };
  }

  private paint(request: CreateRequest, index: number, seed: number, width: number, height: number): Promise<Buffer> {
    const job = { ...prompts(request, index), seed, width, height };
    return this.comfy.render(this.templates[request.alignment].build(job));
  }

  private async buildVariant(target: Target, id: string, source: Source, request: CreateRequest): Promise<Variant> {
    if (target.alignment === 'tile' && !isSeamless(source.basecolor)) {
      throw new MaterialsError('E_SEAM_CHECK_FAILED', `variant ${id} of ${request.key} has a visible seam`, seamScore(source.basecolor));
    }
    const mode = request.emission ?? 'none';
    const files: [MapName, Buffer][] = [
      ['basecolor', await encodeRgbPng(source.basecolor)],
      ...(source.screen
        ? await screenMaps(source.basecolor, source.screen, target.physical, request)
        : source.reuse
          ? await emissionMap(source.basecolor, mode)
          : await derivedMaps(source, target, mode)),
    ];

    const relDir = join('assets', target.kind, target.tier, id);
    const absDir = join(this.db.themeDir(target.theme), relDir);
    mkdirSync(absDir, { recursive: true });
    // a tint keeps the relief of the variant it came from: same surface, different paint
    const { emission: _stale, ...relief } = source.reuse?.maps ?? ({} as Variant['maps']);
    const maps = { ...relief } as Variant['maps'];
    for (const [name, buffer] of files) {
      writeFileSync(join(absDir, `${name}.png`), buffer);
      maps[name] = join(relDir, `${name}.png`);
    }
    return {
      id,
      ...(request.pattern ? { class: 'pattern' as const } : {}),
      resolution: [source.basecolor.width, source.basecolor.height],
      maps,
    };
  }
}

/** Screens set their own variant count; the pattern and recolor lanes make exactly one. */
function variantCount(request: CreateRequest): number {
  if (request.emission === 'image') return request.screens!.length;
  if (request.pattern || request.recolor) return 1;
  return request.variants ?? 1;
}

/** Emission alone: what a tint variant needs, since it keeps the relief it was made from. */
async function emissionMap(
  basecolor: Rgb,
  mode: NonNullable<CreateRequest['emission']>,
): Promise<[MapName, Buffer][]> {
  if (mode !== 'luminance' && mode !== 'color-mask') return [];
  return [['emission', await encodeRgbPng(deriveEmission(basecolor, mode))]];
}

/**
 * The maps around the surface: a pattern hands over its own relief and gloss,
 * a photographed surface has both read out of it, and emission is masked from
 * the surface's own colors.
 */
async function derivedMaps(
  source: Source,
  target: Target,
  mode: NonNullable<CreateRequest['emission']>,
): Promise<[MapName, Buffer][]> {
  const height = source.height ?? deriveHeight(source.basecolor, target.finish);
  const roughness = source.roughness ?? deriveRoughness(height, target.finish);
  return [
    ...(await reliefMaps(height, roughness)),
    ['metallic', await encodeGrayPng(deriveMetallic(source.basecolor, target.physical))],
    ...(mode === 'luminance' || mode === 'color-mask'
      ? ([['emission', await encodeRgbPng(deriveEmission(source.basecolor, mode))]] as [MapName, Buffer][])
      : []),
  ];
}

/** A display: no relief anywhere, uniform gloss, and the artwork seen through the pixel structure. */
async function screenMaps(
  basecolor: Rgb,
  screen: { spec: Screen; artwork: Rgb },
  physical: Physical,
  request: CreateRequest,
): Promise<[MapName, Buffer][]> {
  const artwork = screen.artwork;
  if (artwork.width !== basecolor.width || artwork.height !== basecolor.height) {
    throw new MaterialsError(
      'E_GENERATION_FAILED',
      `artwork is ${artwork.width}x${artwork.height}, the screen surface is ${basecolor.width}x${basecolor.height}`,
    );
  }
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

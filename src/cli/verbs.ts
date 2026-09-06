import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create, list, pack, rebrand, refinish, resolve, MaterialsError } from '../index.js';
import type { CreateRequest } from '../db/types.js';
import type { RefinishRequest } from '../api-types.js';
import type { Business } from '../db/types.js';
import { parseArgs, themesOption, UsageError } from './args.js';
import { previewUrl } from './doctor.js';

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    throw new MaterialsError('E_SCHEMA', `cannot read JSON: ${path}`, cause);
  }
}

export function versionData(version: string): Record<string, unknown> {
  return { version };
}

export function patternsVerb(): Record<string, unknown> {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schema', 'pattern-kinds.json');
  const catalog = JSON.parse(readFileSync(path, 'utf8')) as { kinds: { kind: string; draws: string; reads: string }[] };
  return { kinds: catalog.kinds, count: catalog.kinds.length };
}

export function resolveVerb(argv: string[]): Record<string, unknown> {
  const { options, rest } = parseArgs(argv);
  const key = rest[0];
  if (!key) throw new UsageError('usage: pbrforge resolve <theme/kind/tier> [--themes <dir>]');
  return { entry: resolve(key, themesOption(options)) };
}

export function listVerb(argv: string[]): Record<string, unknown> {
  const { options } = parseArgs(argv);
  const keys = list(
    {
      ...(options.theme ? { theme: options.theme } : {}),
      ...(options.kind ? { kind: options.kind } : {}),
      ...(options.tier ? { tier: options.tier } : {}),
    },
    themesOption(options),
  );
  return { keys, count: keys.length };
}

function nativeSource(request: CreateRequest): string | undefined {
  if (request.sourceImage?.path) return request.sourceImage.path;
  if (request.sourceAlbedo?.path) return request.sourceAlbedo.path;
  if (request.screens?.length && request.screens.every((screen) => screen.imagePath)) {
    return request.screens[0]!.imagePath;
  }
  return undefined;
}

function assertNative(request: CreateRequest): void {
  if (request.pattern || request.flatColor || request.recolor) {
    throw new UsageError(
      `--native is for a PNG from your image tool. Use sourceImage (exact), sourceAlbedo (tile), or screens[].imagePath. Not pattern, flatColor or recolor.`,
    );
  }
  if (!nativeSource(request)) {
    throw new UsageError(
      `--native needs a PNG path on the request (sourceImage, sourceAlbedo, or every screens[].imagePath). Generate it with your image tool first, then create.`,
    );
  }
}

export async function createVerb(argv: string[]): Promise<Record<string, unknown>> {
  const { flags, options, rest } = parseArgs(argv, ['overwrite', 'native']);
  const path = rest[0];
  if (!path) throw new UsageError('usage: pbrforge create <request.json> [--themes <dir>] [--overwrite] [--native]');
  const parsed = readJson(path) as CreateRequest | CreateRequest[];
  const batch = Array.isArray(parsed);
  const requests = (batch ? parsed : [parsed]).map((r) => (flags.overwrite ? { ...r, overwrite: true } : r));
  if (flags.native) {
    for (const request of requests) assertNative(request);
  }
  const opts = themesOption(options);
  const created: { key: string; variants: number; retry?: boolean }[] = [];
  const skipped: { key: string; reason: string }[] = [];
  for (const request of requests) {
    try {
      const entry = await create(request, opts);
      created.push({ key: entry.key, variants: entry.variants.length });
    } catch (error) {
      if (batch && error instanceof MaterialsError && error.code === 'E_KEY_EXISTS') {
        skipped.push({ key: request.key, reason: 'exists' });
        continue;
      }
      if (
        error instanceof MaterialsError
        && error.code === 'E_SEAM_CHECK_FAILED'
        && request.seed === undefined
        && !request.sourceAlbedo
        && !request.sourceImage
      ) {
        const entry = await create({ ...request, seed: 9973 }, opts);
        created.push({ key: entry.key, variants: entry.variants.length, retry: true });
        continue;
      }
      throw error;
    }
  }
  return { created, skipped };
}

export async function refinishVerb(argv: string[]): Promise<Record<string, unknown>> {
  const { options, rest } = parseArgs(argv);
  const path = rest[0];
  if (!path) throw new UsageError('usage: pbrforge refinish <requests.json> [--themes <dir>]');
  const parsed = readJson(path) as RefinishRequest | RefinishRequest[];
  const requests = (Array.isArray(parsed) ? parsed : [parsed]).filter((r) => r.finish || r.physical);
  if (!requests.length) throw new UsageError(`no request in ${path} states a finish or physical`);
  const opts = themesOption(options);
  const results = [];
  for (const request of requests) {
    const { entry, variants } = await refinish(request, opts);
    results.push({ key: entry.key, variants, finish: entry.finish, physical: entry.physical });
  }
  return { results };
}

export async function rebrandVerb(argv: string[]): Promise<Record<string, unknown>> {
  const { options } = parseArgs(argv);
  if (!options.theme || !options.businesses) {
    throw new UsageError('usage: pbrforge rebrand --theme <theme> --businesses <businesses.json> [--themes <dir>]');
  }
  const businesses = readJson(options.businesses) as Business[];
  const branded = await rebrand({ theme: options.theme, businesses }, themesOption(options));
  return { branded, count: branded.length };
}

export async function packVerb(argv: string[]): Promise<Record<string, unknown>> {
  const { options } = parseArgs(argv);
  if (!options.theme) throw new UsageError('usage: pbrforge pack --theme <theme> [--themes <dir>]');
  const opts = themesOption(options);
  const packed: { key: string; variants: string[] }[] = [];
  for (const key of list({ theme: options.theme }, opts)) {
    const result = await pack({ key }, opts);
    packed.push({ key, variants: result.variants });
  }
  return { packed };
}

export async function previewVerb(): Promise<Record<string, unknown>> {
  const url = previewUrl();
  let up = false;
  try {
    const res = await fetch(`${url}/api/themes`, { signal: AbortSignal.timeout(600) });
    up = res.ok;
  } catch {
    up = false;
  }
  return { url, up, start: 'npm run preview' };
}

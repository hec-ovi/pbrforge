import { readFileSync } from 'node:fs';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import { parseArgs, themesOption, UsageError } from '../cli/args.js';
import { FromImage, type FromImageRequest } from './FromImage.js';

export async function fromImageVerb(argv: string[], bundledThemesDir: string): Promise<Record<string, unknown>> {
  const { flags, options, rest } = parseArgs(argv, ['overwrite']);
  const path = rest[0];
  if (!path) throw new UsageError('usage: pbrforge from-image <request.json> [--themes <dir>] [--overwrite]');
  let request: FromImageRequest;
  try {
    request = JSON.parse(readFileSync(path, 'utf8')) as FromImageRequest;
  } catch (cause) {
    throw new MaterialsError('E_SCHEMA', `cannot read JSON: ${path}`, cause);
  }
  if (flags.overwrite) request.overwrite = true;
  const db = new Database(themesOption(options).themesDir ?? bundledThemesDir);
  const entry = await new FromImage(db).run(request);
  const variant = entry.variants[0];
  return { key: entry.key, variant: variant.id, maps: variant.maps, alignment: entry.alignment };
}

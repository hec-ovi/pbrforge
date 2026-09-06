import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MaterialsError } from '../db/errors.js';
import { UsageError } from './args.js';
import { doctor } from './doctor.js';
import { fail, ok, type Envelope } from './envelope.js';
import {
  createVerb,
  listVerb,
  packVerb,
  patternsVerb,
  previewVerb,
  rebrandVerb,
  refinishVerb,
  resolveVerb,
  versionData,
} from './verbs.js';

export const VERBS = [
  { verb: 'doctor', summary: 'whether this machine can resolve, write and preview', usage: 'doctor [--themes <dir>]' },
  { verb: 'version', summary: 'package version', usage: 'version' },
  { verb: 'help', summary: 'this list', usage: 'help' },
  { verb: 'resolve', summary: 'look up a key', usage: 'resolve <theme/kind/tier> [--themes <dir>]' },
  { verb: 'list', summary: 'matching keys, sorted', usage: 'list [--theme t] [--kind k] [--tier t] [--themes <dir>]' },
  { verb: 'patterns', summary: 'procedural pattern kinds for create', usage: 'patterns' },
  { verb: 'create', summary: 'generate from a request JSON (batch skips existing keys)', usage: 'create <request.json> [--themes <dir>] [--overwrite] [--native]' },
  { verb: 'refinish', summary: 're-read photographed maps under a finish', usage: 'refinish <requests.json> [--themes <dir>]' },
  { verb: 'rebrand', summary: 'spell business names onto screens', usage: 'rebrand --theme <theme> --businesses <businesses.json> [--themes <dir>]' },
  { verb: 'pack', summary: 'add packed metallic-roughness maps for a theme', usage: 'pack --theme <theme> [--themes <dir>]' },
  { verb: 'preview', summary: 'whether the sphere viewer is up, and how to start it', usage: 'preview' },
] as const;

function packageVersion(): string {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
  return (JSON.parse(readFileSync(path, 'utf8')) as { version: string }).version;
}

function hintFor(code: string): string | undefined {
  if (code === 'E_COMFY_UNAVAILABLE') return 'bash comfy/up.sh, then retry. Pattern, plate, recolor and rebrand do not need ComfyUI.';
  if (code === 'E_SEAM_CHECK_FAILED') return 'the tiled albedo did not wrap. Change the seed or the source and retry.';
  if (code === 'E_KEY_EXISTS') return 'pass --overwrite, or drop that key from the batch.';
  if (code === 'E_USAGE') return 'pbrforge help';
  return undefined;
}

export async function run(argv: string[]): Promise<Envelope> {
  const [verb, ...rest] = argv;
  if (!verb || verb === 'help' || verb === '--help' || verb === '-h') {
    return ok('help', { verbs: VERBS.map((v) => ({ ...v })) });
  }
  try {
    switch (verb) {
      case 'doctor':
        return ok('doctor', await doctor(rest));
      case 'version':
        return ok('version', versionData(packageVersion()));
      case 'resolve':
        return ok('resolve', resolveVerb(rest));
      case 'list':
        return ok('list', listVerb(rest));
      case 'patterns':
        return ok('patterns', patternsVerb());
      case 'create':
        return ok('create', await createVerb(rest));
      case 'refinish':
        return ok('refinish', await refinishVerb(rest));
      case 'rebrand':
        return ok('rebrand', await rebrandVerb(rest));
      case 'pack':
        return ok('pack', await packVerb(rest));
      case 'preview':
        return ok('preview', await previewVerb());
      default:
        return fail(verb, 'E_USAGE', `no verb named ${verb}, run help`, undefined, 'pbrforge help');
    }
  } catch (error) {
    if (error instanceof UsageError) return fail(verb, 'E_USAGE', error.message, undefined, hintFor('E_USAGE'));
    if (error instanceof MaterialsError) {
      return fail(verb, error.code, error.message, error.details, hintFor(error.code));
    }
    return fail(verb, 'E_INTERNAL', error instanceof Error ? error.message : String(error));
  }
}

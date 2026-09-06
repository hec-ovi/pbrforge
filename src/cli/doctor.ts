import { existsSync, readFileSync, readdirSync, accessSync, constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComfyClient } from '../gen/ComfyClient.js';
import { parseArgs } from './args.js';

export interface Check {
  check: string;
  ok: boolean;
  is: string;
  fix?: string;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PREVIEW_URL = 'http://127.0.0.1:5177';

export function defaultThemesDir(): string {
  return join(root, 'themes');
}

export function previewUrl(): string {
  return PREVIEW_URL;
}

async function previewUp(): Promise<boolean> {
  try {
    const res = await fetch(`${PREVIEW_URL}/api/themes`, { signal: AbortSignal.timeout(600) });
    return res.ok;
  } catch {
    return false;
  }
}

function writable(dir: string): boolean {
  try {
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function doctor(argv: string[]): Promise<Record<string, unknown>> {
  const { options } = parseArgs(argv);
  const themesDir = options.themes ?? defaultThemesDir();
  const checks: Check[] = [];

  const major = Number(process.versions.node.split('.')[0]);
  checks.push({
    check: 'node',
    ok: major >= 18,
    is: `node ${process.versions.node}`,
    ...(major >= 18 ? {} : { fix: 'install Node 18 or newer' }),
  });

  const themeNames = existsSync(themesDir)
    ? readdirSync(themesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
    : [];
  const indexes = themeNames.filter((name) => existsSync(join(themesDir, name, 'theme.json')));
  checks.push({
    check: 'themes',
    ok: indexes.length > 0,
    is: indexes.length ? `${themesDir} (${indexes.join(', ')})` : `${themesDir} (no theme.json)`,
    ...(indexes.length ? {} : { fix: `point --themes at a theme database or run from the pbrforge checkout` }),
  });

  if (indexes.length) {
    checks.push({
      check: 'themes-writable',
      ok: writable(themesDir),
      is: writable(themesDir) ? 'writable' : 'not writable',
      ...(writable(themesDir) ? {} : { fix: `choose a writable --themes directory` }),
    });
  }

  const skillPath = join(root, 'skills', 'pbrforge', 'SKILL.md');
  checks.push({
    check: 'skill',
    ok: existsSync(skillPath),
    is: existsSync(skillPath) ? skillPath : 'missing skills/pbrforge/SKILL.md',
    ...(existsSync(skillPath) ? {} : { fix: 'run from the pbrforge checkout' }),
  });

  const comfyUrl = process.env.COMFY_URL ?? 'http://127.0.0.1:8188';
  const comfyReady = await new ComfyClient(comfyUrl).ready();
  checks.push({
    check: 'comfy',
    ok: comfyReady,
    is: comfyReady ? `ready at ${comfyUrl}` : `not reachable at ${comfyUrl}`,
    ...(comfyReady ? {} : { fix: 'optional: bash comfy/up.sh, only needed to photograph a new surface' }),
  });

  const preview = await previewUp();
  checks.push({
    check: 'preview',
    ok: preview,
    is: preview ? `serving ${PREVIEW_URL}` : `not serving ${PREVIEW_URL}`,
    ...(preview ? {} : { fix: 'npm run preview' }),
  });

  const required = checks.filter((c) => c.check === 'node' || c.check === 'themes' || c.check === 'skill');
  const ready = required.every((c) => c.ok);
  const nextActions = checks.filter((c) => !c.ok && c.fix).map((c) => c.fix!);
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };

  return {
    ready,
    version: version.version,
    themesDir,
    preview: { url: PREVIEW_URL, up: preview },
    comfy: { url: comfyUrl, ready: comfyReady },
    checks,
    nextActions,
  };
}

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../src/cli/router.js';
import type { CreateRequest } from '../src/db/types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

let tempDirs: string[] = [];

function temp(): string {
  const path = mkdtempSync(join(tmpdir(), 'pbrforge-cli-'));
  tempDirs.push(path);
  return path;
}

afterEach(() => {
  for (const path of tempDirs) rmSync(path, { recursive: true, force: true });
  tempDirs = [];
});

describe('pbrforge CLI', () => {
  it('reports its version, verbs, pattern kinds and environment', async () => {
    const version = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version;
    expect(await run(['version'])).toEqual({ ok: true, verb: 'version', data: { version } });

    const help = await run(['help']);
    expect(help.ok).toBe(true);
    if (!help.ok) return;
    expect((help.data.verbs as { verb: string }[]).map(item => item.verb)).toEqual([
      'doctor', 'version', 'help', 'resolve', 'list', 'patterns', 'from-image', 'create', 'refinish', 'rebrand', 'pack', 'preview',
    ]);

    const patterns = await run(['patterns']);
    expect(patterns.ok).toBe(true);
    if (!patterns.ok) return;
    const kinds = patterns.data.kinds as { kind: string; draws: string; detail: string }[];
    const schema = JSON.parse(readFileSync(join(repoRoot, 'schema/create-request.schema.json'), 'utf8')) as {
      properties: { pattern: { properties: { kind: { enum: string[] } } } };
    };
    expect(kinds.map(item => item.kind)).toEqual(schema.properties.pattern.properties.kind.enum);
    expect(patterns.data.count).toBe(kinds.length);
    for (const item of kinds) {
      expect(item.draws).toBeTruthy();
      expect(readFileSync(join(repoRoot, item.detail), 'utf8').length).toBeGreaterThan(40);
    }

    expect(await run(['doctor'])).toMatchObject({ ok: true, data: { ready: true, themesDir: expect.stringMatching(/themes$/) } });
    expect(await run(['preview'])).toMatchObject({
      ok: true, data: { url: expect.any(String), up: expect.any(Boolean), start: 'npm run preview' },
    });
  });

  it('resolves and lists the bundled database and returns closed error envelopes', async () => {
    const found = await run(['resolve', 'cyberpunk/door/mid']);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    const entry = found.data.entry as { key: string; variants: { maps: Record<string, string> }[] };
    expect(entry.key).toBe('cyberpunk/door/mid');
    expect(entry.variants[0]?.maps.basecolor).toBeTruthy();

    const listed = await run(['list', '--theme', 'cyberpunk', '--kind', 'door']);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.keys).toEqual(expect.arrayContaining(['cyberpunk/door/mid']));

    expect(await run(['resolve', 'cyberpunk/no-such-kind/mid'])).toMatchObject({ ok: false, error: { code: 'E_KEY_NOT_FOUND' } });
    expect(await run(['frobnicate'])).toMatchObject({ ok: false, error: { code: 'E_USAGE' } });
  });

  it('creates from a JSON request, skipping keys a batch already holds and gating --native', async () => {
    const themesDir = temp();
    const request: CreateRequest = {
      key: 'test/door/mid', alignment: 'tile', description: 'graphite coating',
      tiling: { worldSize: [0.5, 0.5] }, resolution: [64, 64], seed: 7, variantId: 'paint',
      physical: { roughnessFactor: 0.58, metallicFactor: 0 },
      pattern: { kind: 'noise', colors: ['#292c2f', '#36393c'], cells: [4, 12], octaves: 3, depth: 0.035, variation: 0, grain: 0.018, sheen: 0.04 },
    };
    const file = join(themesDir, 'request.json');
    writeFileSync(file, JSON.stringify(request));

    const created = await run(['create', file, '--themes', themesDir]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.created).toEqual([{ key: 'test/door/mid', variants: 1 }]);
    expect(await run(['create', file, '--themes', file])).toMatchObject({ ok: false, error: { code: 'E_INTERNAL' } });
    expect(await run(['create', file, '--themes', themesDir])).toMatchObject({ ok: false, error: { code: 'E_KEY_EXISTS' } });

    const batchFile = join(themesDir, 'batch.json');
    writeFileSync(batchFile, JSON.stringify([request]));
    const skipped = await run(['create', batchFile, '--themes', themesDir]);
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.data.skipped).toEqual([{ key: 'test/door/mid', reason: 'exists' }]);

    const resolved = await run(['resolve', 'test/door/mid', '--themes', themesDir]);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const entry = resolved.data.entry as { variants: { maps: Record<string, string> }[] };
    expect(Object.keys(entry.variants[0]!.maps)).toEqual(
      expect.arrayContaining(['ao', 'basecolor', 'height', 'metallic', 'normal', 'roughness']),
    );

    const photographed: CreateRequest = {
      key: 'test/room/mid', alignment: 'exact', aspect: [1, 1],
      description: 'a fitted room plate', resolution: [64, 64],
    };
    const missing = join(themesDir, 'no-png.json');
    writeFileSync(missing, JSON.stringify(photographed));
    expect(await run(['create', missing, '--themes', themesDir, '--native'])).toMatchObject({ ok: false, error: { code: 'E_USAGE' } });

    const png = join(themesDir, 'plate.png');
    writeFileSync(png, await sharp({ create: { width: 64, height: 64, channels: 3, background: '#334455' } }).png().toBuffer());
    const nativeFile = join(themesDir, 'native.json');
    writeFileSync(nativeFile, JSON.stringify({
      ...photographed, sourceImage: { path: png },
      physical: { metallicFactor: 0, roughnessFactor: 1, emissiveStrength: 1 },
    } satisfies CreateRequest));
    const native = await run(['create', nativeFile, '--themes', themesDir, '--native']);
    expect(native.ok).toBe(true);
    if (!native.ok) return;
    expect(native.data.created).toEqual([{ key: 'test/room/mid', variants: 1 }]);
  });
});

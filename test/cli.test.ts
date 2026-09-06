import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  it('help lists every verb', async () => {
    const envelope = await run(['help']);
    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;
    const verbs = envelope.data.verbs as { verb: string }[];
    expect(verbs.map((v) => v.verb)).toEqual([
      'doctor', 'version', 'help', 'resolve', 'list', 'create', 'refinish', 'rebrand', 'pack', 'preview',
    ]);
  });

  it('resolves a shipped key and lists by kind', async () => {
    const found = await run(['resolve', 'cyberpunk/door/mid']);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    const entry = found.data.entry as { key: string; variants: { id: string; maps: Record<string, string> }[] };
    expect(entry.key).toBe('cyberpunk/door/mid');
    expect(entry.variants[0]?.maps.basecolor).toBeTruthy();
    expect(entry.variants[0]?.maps.normal).toBeTruthy();

    const listed = await run(['list', '--theme', 'cyberpunk', '--kind', 'door']);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.keys).toEqual(expect.arrayContaining(['cyberpunk/door/mid']));
  });

  it('returns a closed error for a missing key', async () => {
    const envelope = await run(['resolve', 'cyberpunk/no-such-kind/mid']);
    expect(envelope.ok).toBe(false);
    if (envelope.ok) return;
    expect(envelope.error.code).toBe('E_KEY_NOT_FOUND');
  });

  it('rejects an unknown verb as E_USAGE', async () => {
    const envelope = await run(['frobnicate']);
    expect(envelope.ok).toBe(false);
    if (envelope.ok) return;
    expect(envelope.error.code).toBe('E_USAGE');
  });

  it('doctor reports ready against the bundled database', async () => {
    const envelope = await run(['doctor']);
    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;
    expect(envelope.data.ready).toBe(true);
    expect(envelope.data.themesDir).toMatch(/themes$/);
  });

  it('creates a pattern set through the JSON CLI', async () => {
    const themesDir = temp();
    const request: CreateRequest = {
      key: 'test/door/mid',
      alignment: 'tile',
      description: 'graphite coating',
      tiling: { worldSize: [0.5, 0.5] },
      physical: { roughnessFactor: 0.58, metallicFactor: 0 },
      variantId: 'paint',
      resolution: [64, 64],
      seed: 7,
      pattern: {
        kind: 'noise',
        colors: ['#292c2f', '#36393c'],
        cells: [4, 12],
        octaves: 3,
        depth: 0.035,
        variation: 0,
        grain: 0.018,
        sheen: 0.04,
      },
    };
    const file = join(themesDir, 'request.json');
    writeFileSync(file, JSON.stringify(request));

    const created = await run(['create', file, '--themes', themesDir]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.created).toEqual([{ key: 'test/door/mid', variants: 1 }]);

    const again = await run(['create', file, '--themes', themesDir]);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.code).toBe('E_KEY_EXISTS');

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
    expect(Object.keys(entry.variants[0]!.maps).sort()).toEqual(
      expect.arrayContaining(['ao', 'basecolor', 'height', 'metallic', 'normal', 'roughness']),
    );
  });

  it('keeps the root skill copy identical to the pack', () => {
    const pack = readFileSync(join(repoRoot, 'skills', 'pbrforge', 'SKILL.md'), 'utf8');
    const root = readFileSync(join(repoRoot, 'SKILL.md'), 'utf8');
    expect(root).toBe(pack);
  });
});

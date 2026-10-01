import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const script = fileURLToPath(new URL('../scripts/check-highway-materials.mjs', import.meta.url));
const source = fileURLToPath(new URL('../bindings/highway-materials.json', import.meta.url));

it('binds seven highway parts to verified maps at their declared physical scales', () => {
  const checked = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  expect(checked.status, checked.stdout + '\n' + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({
    slots: 7, concreteFinishes: 3, absoluteScalarMaps: true, nativeRoadwayPreserved: true, visualAcceptance: false,
  });
});

it('rejects stale hashes, changed scale, roadway reinterpretation and invented ownership input', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'highway-material-binding-'));
  try {
    const base = JSON.parse(readFileSync(source, 'utf8'));
    const cases = [
      () => { const b = structuredClone(base); b.textures[b.slots['deck-concrete'].maps.basecolor].sha256 = '0'.repeat(64); return b; },
      () => { const b = structuredClone(base); b.slots['pier-concrete'].sampling.worldSize = [1, 1]; return b; },
      () => { const b = structuredClone(base); b.slots.roadway.sampling.mode = 'geometry-metres'; return b; },
      () => { const b = structuredClone(base); b.placementWeathering.sourceStation = 'uv.u'; return b; },
    ];
    for (let i = 0; i < cases.length; i++) {
      const candidate = join(temporary, String(i) + '.json');
      writeFileSync(candidate, JSON.stringify(cases[i]!()));
      const checked = spawnSync(process.execPath, [script, '--binding', candidate], { encoding: 'utf8' });
      expect(checked.status, 'Invalid binding ' + i + ' was accepted: ' + checked.stdout).not.toBe(0);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

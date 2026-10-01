import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('publishes coherent distinct street variants with valid shared texture resources', () => {
  const script = fileURLToPath(new URL('../scripts/check-street-variants.mjs', import.meta.url));
  const checked = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  expect(checked.status, `${checked.stdout}\n${checked.stderr}`).toBe(0);
  expect(JSON.parse(checked.stdout).distinctAlbedoAndRoughness).toBe(true);
});

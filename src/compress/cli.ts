import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compress } from './run.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
try {
  const result = await compress(process.argv.slice(2), {
    themesDir: join(root, 'themes'), executable: join(root, 'tools', 'ktx', 'bin', 'ktx'),
  });
  console.log(`written=${result.written} skipped=${result.skipped} seconds=${result.seconds.toFixed(2)} hottest=${result.hottest === null ? 'unavailable' : `${result.hottest.toFixed(3)}C`} narrowed=${result.narrowed}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

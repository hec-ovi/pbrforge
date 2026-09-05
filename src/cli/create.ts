import { readFileSync } from 'node:fs';
import { create, MaterialsError, type CreateRequest } from '../index.js';

const requestPath = process.argv[2];
const themesAt = process.argv.indexOf('--themes');
const themesDir = themesAt >= 0 ? process.argv[themesAt + 1] : undefined;
if (!requestPath || requestPath.startsWith('--') || (themesAt >= 0 && (!themesDir || themesDir.startsWith('--')))) {
  console.error('usage: npm run create -- <request.json> [--themes <dir>] [--overwrite]');
  process.exit(2);
}
const forceOverwrite = process.argv.includes('--overwrite');
const parsed = JSON.parse(readFileSync(requestPath, 'utf8')) as CreateRequest | CreateRequest[];
const batch = Array.isArray(parsed);
const requests = (batch ? parsed : [parsed]).map((r) => (forceOverwrite ? { ...r, overwrite: true } : r));
const options = { themesDir };

try {
  for (const request of requests) {
    try {
      const entry = await create(request, options);
      console.log(`created ${entry.key} (${entry.variants.length} variant${entry.variants.length > 1 ? 's' : ''})`);
    } catch (e) {
      if (batch && e instanceof MaterialsError && e.code === 'E_KEY_EXISTS') {
        console.log(`skipped ${request.key} (exists)`);
        continue;
      }
      if (e instanceof MaterialsError && e.code === 'E_SEAM_CHECK_FAILED' && request.seed === undefined
        && !request.sourceAlbedo && !request.sourceImage) {
        console.log(`seam check failed for ${request.key}, retrying with shifted seed`);
        const entry = await create({ ...request, seed: 9973 }, options);
        console.log(`created ${entry.key} (retry)`);
        continue;
      }
      throw e;
    }
  }
} catch (e) {
  if (e instanceof MaterialsError) {
    console.error(`${e.code}: ${e.message}`);
    process.exit(1);
  }
  throw e;
}

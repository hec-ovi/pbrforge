import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import { Generator } from '../gen/Generator.js';
import type { CreateRequest } from '../db/types.js';

const themesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'themes');
const requestPath = process.argv[2];
if (!requestPath) {
  console.error('usage: npm run create -- <request.json>  (a single request or an array; array mode skips existing keys)');
  process.exit(2);
}
const parsed = JSON.parse(readFileSync(requestPath, 'utf8')) as CreateRequest | CreateRequest[];
const batch = Array.isArray(parsed);
const requests = batch ? parsed : [parsed];
const generator = new Generator(new Database(themesDir));

try {
  for (const request of requests) {
    try {
      const entry = await generator.create(request);
      console.log(`created ${entry.key} (${entry.variants.length} variant${entry.variants.length > 1 ? 's' : ''})`);
    } catch (e) {
      if (batch && e instanceof MaterialsError && e.code === 'E_KEY_EXISTS') {
        console.log(`skipped ${request.key} (exists)`);
        continue;
      }
      if (e instanceof MaterialsError && e.code === 'E_SEAM_CHECK_FAILED' && request.seed === undefined) {
        console.log(`seam check failed for ${request.key}, retrying with shifted seed`);
        const entry = await generator.create({ ...request, seed: 9973 });
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

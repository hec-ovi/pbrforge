import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import { Refinisher, type RefinishRequest } from '../gen/Refinish.js';

const themesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'themes');
const requestPath = process.argv[2];
if (!requestPath) {
  console.error('usage: npm run refinish -- <requests.json>  (the create requests of a family; every key that states a finish is re-read)');
  process.exit(2);
}

const parsed = JSON.parse(readFileSync(requestPath, 'utf8')) as RefinishRequest | RefinishRequest[];
const requests = (Array.isArray(parsed) ? parsed : [parsed]).filter((r) => r.finish);
if (!requests.length) {
  console.error(`no request in ${requestPath} states a finish`);
  process.exit(2);
}

const refinisher = new Refinisher(new Database(themesDir));

try {
  for (const request of requests) {
    const { entry, variants } = await refinisher.refinish({ key: request.key, finish: request.finish });
    const [lo, hi] = entry.finish!.roughness;
    console.log(`refinished ${entry.key} [${variants.join(', ')}] roughness ${lo}-${hi} grain ${entry.finish!.grain}`);
  }
} catch (e) {
  if (e instanceof MaterialsError) {
    console.error(`${e.code}: ${e.message}`);
    process.exit(1);
  }
  throw e;
}

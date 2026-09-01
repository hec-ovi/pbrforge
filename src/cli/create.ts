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
  console.error('usage: npm run create -- <request.json>');
  process.exit(2);
}
const request = JSON.parse(readFileSync(requestPath, 'utf8')) as CreateRequest;
try {
  const entry = await new Generator(new Database(themesDir)).create(request);
  console.log(`created ${entry.key} (${entry.variants.length} variant${entry.variants.length > 1 ? 's' : ''})`);
} catch (e) {
  if (e instanceof MaterialsError) {
    console.error(`${e.code}: ${e.message}`);
    process.exit(1);
  }
  throw e;
}

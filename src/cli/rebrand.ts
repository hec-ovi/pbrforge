import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import { Rebrander } from '../gen/rebrand/Rebrander.js';
import type { Business } from '../db/types.js';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

const theme = option('theme');
const file = option('businesses');
if (!theme || !file) {
  console.error('usage: npm run rebrand -- --theme <theme> --businesses <businesses.json> [--themes <dir>]');
  process.exit(2);
}
const themesDir = option('themes') ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'themes');
const businesses = JSON.parse(readFileSync(file, 'utf8')) as Business[];

try {
  for (const { key, variantId, from, lines } of await new Rebrander(new Database(themesDir)).rebrand({ theme, businesses })) {
    console.log(`branded ${key}#${variantId} over ${from} (${lines} line${lines > 1 ? 's' : ''})`);
  }
} catch (e) {
  if (e instanceof MaterialsError) {
    console.error(`${e.code}: ${e.message}`);
    process.exit(1);
  }
  throw e;
}

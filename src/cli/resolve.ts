import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';

const themesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'themes');
const key = process.argv[2];
if (!key) {
  console.error('usage: npm run resolve -- <theme/kind/tier> | --list [theme]');
  process.exit(2);
}
const db = new Database(themesDir);
try {
  if (key === '--list') {
    for (const k of db.list({ theme: process.argv[3] })) console.log(k);
  } else {
    console.log(JSON.stringify(db.resolve(key), null, 2));
  }
} catch (e) {
  if (e instanceof MaterialsError) {
    console.error(`${e.code}: ${e.message}`);
    process.exit(1);
  }
  throw e;
}

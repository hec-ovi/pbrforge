import { list, pack, MaterialsError } from '../index.js';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const theme = option('theme');
if (!theme || !/^[a-z0-9_-]+$/.test(theme)) {
  console.error('usage: npm run pack -- --theme <theme> [--themes <dir>]');
  process.exit(2);
}
const options = { themesDir: option('themes') };
try {
  for (const key of list({ theme }, options)) {
    const result = await pack({ key }, options);
    console.log(`packed ${key} (${result.variants.length} changed variants)`);
  }
} catch (error) {
  if (!(error instanceof MaterialsError)) throw error;
  console.error(`${error.code}: ${error.message}`);
  process.exit(1);
}

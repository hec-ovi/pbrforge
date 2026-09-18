import { availableParallelism } from 'node:os';
import { parseArgs } from 'node:util';
import type { CompressionOptions } from './types.js';

export function compressionOptions(argv: string[]): CompressionOptions {
  const { values } = parseArgs({ args: argv, options: {
    workers: { type: 'string' }, 'max-temp': { type: 'string' }, force: { type: 'boolean' },
  } });
  const workers = values.workers === undefined ? Math.max(1, Math.floor(availableParallelism() / 4)) : Number(values.workers);
  const maxTemp = values['max-temp'] === undefined ? 90 : Number(values['max-temp']);
  if (!Number.isSafeInteger(workers) || workers < 1) throw new Error('workers must be a positive integer');
  if (!Number.isFinite(maxTemp) || maxTemp <= 4) throw new Error('max-temp must be a temperature above 4 C');
  return { workers, maxTemp, force: values.force ?? false };
}

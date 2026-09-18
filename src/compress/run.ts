import { stat } from 'node:fs/promises';
import { Catalog } from './Catalog.js';
import { KtxEncoder } from './KtxEncoder.js';
import { ThermalQueue } from './ThermalQueue.js';
import { compressionOptions } from './options.js';
import { readTemperature } from './temperature.js';
import type { CompressionRuntime, CompressionSummary } from './types.js';

export async function compress(argv: string[], runtime: CompressionRuntime): Promise<CompressionSummary> {
  const started = performance.now();
  const options = compressionOptions(argv);
  const catalog = new Catalog();
  const jobs = await catalog.jobs(runtime.themesDir);
  const queue = new ThermalQueue(options.workers, options.maxTemp, runtime.readTemperature ?? readTemperature);
  const encoder = new KtxEncoder(runtime.executable);
  const summary: CompressionSummary = {
    written: 0, skipped: 0, seconds: 0, hottest: null, narrowed: 0,
  };
  const pending = [];
  for (const job of jobs) {
    const png = await stat(job.png);
    const output = await stat(job.ktx2).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    if (!options.force && output && output.mtimeMs > png.mtimeMs) summary.skipped++;
    else pending.push(job);
  }
  await queue.run(pending, async job => {
    await encoder.encode(job);
    summary.written++;
  });
  await catalog.publish();
  return { ...summary, seconds: (performance.now() - started) / 1000, hottest: queue.hottest, narrowed: queue.narrowed };
}

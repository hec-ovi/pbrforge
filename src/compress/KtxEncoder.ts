import { execFile } from 'node:child_process';
import { rename, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import sharp from 'sharp';
import type { MapJob } from './types.js';

const execute = promisify(execFile);

export class KtxEncoder {
  constructor(private executable: string) {}

  async encode(job: MapJob): Promise<void> {
    const metadata = await sharp(job.png).metadata();
    const color = job.channel === 'basecolor' || job.channel === 'emission';
    const normal = job.channel === 'normal';
    const channels = metadata.hasAlpha ? 'R8G8B8A8' : 'R8G8B8';
    const temporary = `${job.ktx2}.${process.pid}.tmp`;
    const args = [
      'create', '--format', `${channels}_${color ? 'SRGB' : 'UNORM'}`,
      '--assign-tf', color ? 'srgb' : 'linear', '--assign-primaries', color ? 'bt709' : 'none',
      '--generate-mipmap', '--mipmap-filter', 'box', '--mipmap-wrap', job.tiled ? 'wrap' : 'clamp',
      '--threads', '1',
      ...(normal
        ? ['--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', '0.25', '--uastc-rdo-m', '--zstd', '18']
        : ['--encode', 'basis-lz', '--qlevel', color ? '255' : '128', '--clevel', '2',
          ...(color ? ['--no-endpoint-rdo', '--no-selector-rdo'] : [])]),
      job.png, temporary,
    ];
    try {
      await execute(this.executable, args);
      await rename(temporary, job.ktx2);
    } catch (error) {
      throw new Error(`Cannot compress ${job.png}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}

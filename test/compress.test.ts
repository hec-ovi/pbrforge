import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { afterEach, expect, it } from 'vitest';
import { compress } from '../src/compress/run.js';
import { ThermalQueue } from '../src/compress/ThermalQueue.js';
import { Database } from '../src/db/Database.js';
import type { MapName, ThemeIndex, Variant } from '../src/db/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const executable = join(root, 'tools/ktx/bin/ktx');
const execute = promisify(execFile);
const directories: string[] = [];
const channels: MapName[] = ['basecolor', 'normal', 'roughness', 'metallic', 'metallicRoughness', 'ao', 'height', 'opacity', 'emission'];

afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

async function fixture() {
  await mkdir(join(root, 'out'), { recursive: true });
  const workspace = await mkdtemp(join(root, 'out/compress-test-'));
  directories.push(workspace);
  const themesDir = join(workspace, 'themes');
  const theme = join(themesDir, 'sample');
  await mkdir(join(theme, 'assets'), { recursive: true });
  const maps = {} as Variant['maps'];
  for (const channel of channels) {
    maps[channel] = `assets/${channel.toLowerCase()}.png`;
    await sharp({ create: { width: 64, height: 64, channels: channel === 'basecolor' ? 4 : 3,
      background: channel === 'normal' ? { r: 128, g: 128, b: 255 } : { r: 160, g: 90, b: 40, alpha: 0.5 },
    } }).png().toFile(join(theme, maps[channel]!));
  }
  const index: ThemeIndex = { theme: 'sample', entries: {
    'sample/finish/mid': { key: 'sample/finish/mid', alignment: 'tile', tiling: { worldSize: [1, 1] }, physical: {},
      variants: [{ id: 'first', resolution: [64, 64], maps }, { id: 'shared', resolution: [64, 64], maps }],
    },
  } };
  await writeFile(join(theme, 'theme.json'), JSON.stringify(index, null, 2) + '\n');
  return { workspace, themesDir, theme, maps, runtime: { themesDir, executable, readTemperature: () => 40 } };
}

it('runs the command and writes adjacent files with the declared codecs, color flags and full mipmaps', async () => {
  const { workspace, theme, maps } = await fixture();
  await cp(join(root, 'src/compress'), join(workspace, 'src/compress'), { recursive: true });
  await cp(join(root, 'schema'), join(workspace, 'schema'), { recursive: true });
  await cp(join(root, 'package.json'), join(workspace, 'package.json'));
  await symlink(join(root, 'tools'), join(workspace, 'tools'), 'dir');
  const result = await execute('npm', ['run', '--silent', 'compress', '--', '--workers', '1'], { cwd: workspace });
  expect(result.stdout).toMatch(/^written=9 skipped=0 seconds=\d+\.\d{2} hottest=(?:\d+\.\d{3}C|unavailable) narrowed=\d+\n$/);
  for (const channel of channels) {
    const path = join(theme, maps[channel]!.replace(/\.png$/, '.ktx2'));
    const info = JSON.parse((await execute(executable, ['info', '--format', 'json', path])).stdout);
    expect(info.valid).toBe(true);
    expect(info.header).toMatchObject({ pixelWidth: 64, pixelHeight: 64, levelCount: 7,
      supercompressionScheme: channel === 'normal' ? 'KTX_SS_ZSTD' : 'KTX_SS_BASIS_LZ' });
    const dfd = info.dataFormatDescriptor.blocks[0];
    expect(dfd.colorModel).toBe(channel === 'normal' ? 'KHR_DF_MODEL_UASTC' : 'KHR_DF_MODEL_ETC1S');
    expect(dfd.transferFunction).toBe(['basecolor', 'emission'].includes(channel) ? 'KHR_DF_TRANSFER_SRGB' : 'KHR_DF_TRANSFER_LINEAR');
    expect(dfd.colorPrimaries).toBe(['basecolor', 'emission'].includes(channel) ? 'KHR_DF_PRIMARIES_BT709' : 'KHR_DF_PRIMARIES_UNSPECIFIED');
    const flags = info.keyValueData.KTXwriterScParams;
    expect(flags).toContain('--threads 1');
    if (channel === 'normal') {
      expect(flags).toContain('--uastc-quality 2 --uastc-rdo --uastc-rdo-l 0.25');
      expect(flags).toContain('--zstd 18');
      expect(dfd.samples[0].channelType).toBe('KHR_DF_CHANNEL_UASTC_RGB');
    } else {
      const color = ['basecolor', 'emission'].includes(channel);
      expect(flags).toContain(`--clevel 2 --qlevel ${color ? 255 : 128}`);
      if (color) {
        expect(flags).toContain('--no-endpoint-rdo');
        expect(flags).toContain('--no-selector-rdo');
      }
    }
  }
});

it('publishes KTX2 paths beside the PNG masters, skipping newer outputs unless forced', async () => {
  const { runtime, themesDir, theme, maps } = await fixture();
  const db = new Database(themesDir);
  expect(db.resolve('sample/finish/mid').variants[0].maps).toEqual(maps);
  expect(await compress(['--workers', '1'], runtime)).toMatchObject({ written: 9, skipped: 0 });
  for (const variant of db.resolve('sample/finish/mid').variants) {
    for (const [channel, map] of Object.entries(variant.maps)) {
      expect(map).toBe(maps[channel as MapName]);
      const compressed = variant.ktx2?.[channel as MapName];
      expect(compressed).toBe(map.replace(/\.png$/, '.ktx2'));
      expect((await stat(join(theme, compressed!))).isFile()).toBe(true);
    }
  }

  const png = join(theme, maps.basecolor);
  const ktx2 = png.replace(/\.png$/, '.ktx2');
  const timestamp = (await stat(ktx2)).mtime;
  expect(await compress(['--workers', '1'], runtime)).toMatchObject({ written: 0, skipped: 9 });
  expect((await stat(ktx2)).mtime).toEqual(timestamp);
  const equal = new Date(timestamp.getTime() - 10_000);
  await utimes(png, equal, equal);
  await utimes(ktx2, equal, equal);
  expect(await compress(['--workers', '1'], runtime)).toMatchObject({ written: 1, skipped: 8 });
  expect(await compress(['--workers', '1', '--force'], runtime)).toMatchObject({ written: 9, skipped: 0 });
});

it('drains to one worker above the ceiling and holds until four degrees below', async () => {
  let readings = 0, active = 0, completed = 0;
  const starts: { active: number; completed: number }[] = [];
  const queue = new ThermalQueue(3, 90, () => {
    readings++;
    if (readings <= 3) return 80;
    if (readings === 4) return 91;
    if (completed < 5) return 88;
    if (completed < 6) return 87;
    return 86;
  });
  await queue.run(Array.from({ length: 10 }), async () => {
    starts.push({ active: ++active, completed });
    await delay(10);
    active--;
    completed++;
  });
  expect(starts.slice(0, 3).map(start => start.active)).toEqual([1, 2, 3]);
  expect(starts.filter(start => start.completed >= 3 && start.completed < 6).map(start => start.active)).toEqual([1, 1, 1]);
  expect(Math.max(...starts.filter(start => start.completed >= 6).map(start => start.active))).toBe(3);
  expect(queue.hottest).toBe(91);
  expect(queue.narrowed).toBe(1);
});

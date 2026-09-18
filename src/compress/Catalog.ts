import { readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { MapName, ThemeIndex } from '../db/types.js';
import entrySchema from '../../schema/material-entry.schema.json' with { type: 'json' };
import indexSchema from '../../schema/theme-index.schema.json' with { type: 'json' };
import responseSchema from '../../schema/surface-response.schema.json' with { type: 'json' };
import type { MapJob } from './types.js';

export class Catalog {
  private indexes: { path: string; original: string; index: ThemeIndex }[] = [];

  async jobs(themesDir: string): Promise<MapJob[]> {
    const validate = new Ajv2020().addSchema(responseSchema).addSchema(entrySchema).compile(indexSchema);
    const jobs = new Map<string, MapJob>();
    for (const theme of (await readdir(themesDir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!theme.isDirectory()) continue;
      const dir = join(themesDir, theme.name);
      const path = join(dir, 'theme.json');
      const original = await readFile(path, 'utf8');
      const index = JSON.parse(original) as ThemeIndex;
      if (!validate(index)) throw new Error(`Invalid catalog ${path}: ${JSON.stringify(validate.errors)}`);
      this.indexes.push({ path, original, index });
      for (const entry of Object.values(index.entries)) for (const variant of entry.variants) {
        for (const [channel, map] of Object.entries(variant.maps)) {
          const png = join(dir, map);
          const existing = jobs.get(png);
          if (existing) {
            if (existing.channel !== channel) throw new Error(`Conflicting channels for ${map}`);
            existing.tiled ||= entry.alignment === 'tile';
          } else jobs.set(png, {
            png, ktx2: png.replace(/\.png$/, '.ktx2'), channel: channel as MapName,
            tiled: entry.alignment === 'tile',
          });
        }
      }
    }
    return [...jobs.values()];
  }

  async publish(): Promise<void> {
    for (const { path, original, index } of this.indexes) {
      for (const entry of Object.values(index.entries)) for (const variant of entry.variants) {
        const ktx2: NonNullable<typeof variant.ktx2> = {};
        for (const [channel, png] of Object.entries(variant.maps)) {
          const output = png.replace(/\.png$/, '.ktx2');
          const file = await stat(join(dirname(path), output)).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
            return null;
          });
          if (file?.isFile()) ktx2[channel as MapName] = output;
        }
        if (Object.keys(ktx2).length) variant.ktx2 = ktx2;
        else delete variant.ktx2;
      }
      const content = JSON.stringify(index, null, 2) + '\n';
      if (content === original) continue;
      if (await readFile(path, 'utf8') !== original) throw new Error(`Catalog changed during compression: ${path}`);
      const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, content);
      await rename(temporary, path);
    }
  }
}

import { readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { MapName, ThemeIndex } from '../db/types.js';
import entrySchema from '../../schema/material-entry.schema.json' with { type: 'json' };
import indexSchema from '../../schema/theme-index.schema.json' with { type: 'json' };
import responseSchema from '../../schema/surface-response.schema.json' with { type: 'json' };
import type { MapJob } from './types.js';

export class Catalog {
  private indexes: { path: string; original: string; index: ThemeIndex }[] = [];
  private selected?: Set<string>;
  private bindings: { path: string; original: string; binding: { textures: Record<string, {
    path: string; colorSpace: string; wrap: string[]; ktx2?: string; ktx2Sha256?: string;
  }> } }[] = [];

  async jobs(themesDir: string, selected?: Set<string>): Promise<MapJob[]> {
    this.selected = selected;
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
      for (const entry of Object.values(index.entries)) {
        if (selected && !selected.has(entry.key)) continue;
        for (const variant of entry.variants) {
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
    }
    for (const name of ['street-native', 'surface-detail']) {
      const path = join(dirname(themesDir), 'bindings', `${name}.json`);
      const original = await readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      });
      if (!original) continue;
      const binding = JSON.parse(original);
      this.bindings.push({ path, original, binding });
      for (const [id, texture] of Object.entries(binding.textures) as [string, { path: string; colorSpace: string; wrap: string[] }][]) {
        const png = join(dirname(themesDir), texture.path);
        if (jobs.has(png)) continue;
        jobs.set(png, { png, ktx2: png.replace(/\.png$/, '.ktx2'),
          channel: /normal/.test(id) ? 'normal' : texture.colorSpace === 'srgb' ? 'basecolor' : 'roughness',
          tiled: texture.wrap.includes('repeat') });
      }
    }
    return [...jobs.values()];
  }

  async publish(): Promise<void> {
    for (const { path, original, index } of this.indexes) {
      for (const entry of Object.values(index.entries)) {
        if (this.selected && !this.selected.has(entry.key)) continue;
        for (const variant of entry.variants) {
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
      }
      const content = JSON.stringify(index, null, 2) + '\n';
      if (content === original) continue;
      if (await readFile(path, 'utf8') !== original) throw new Error(`Catalog changed during compression: ${path}`);
      const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, content);
      await rename(temporary, path);
    }
    for (const { path, original, binding } of this.bindings) {
      for (const texture of Object.values(binding.textures)) {
        const output = texture.path.replace(/\.png$/, '.ktx2');
        const bytes = await readFile(join(dirname(dirname(path)), output));
        texture.ktx2 = output;
        texture.ktx2Sha256 = createHash('sha256').update(bytes).digest('hex');
      }
      if (await readFile(path, 'utf8') !== original) throw new Error(`Binding changed during compression: ${path}`);
      const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(binding, null, 2) + '\n');
      await rename(temporary, path);
    }
  }
}

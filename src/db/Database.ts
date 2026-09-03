import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Ajv2020 as Ajv, type ValidateFunction } from 'ajv/dist/2020.js';
import { MaterialsError } from './errors.js';
import type { MaterialEntry, ThemeIndex } from './types.js';
import entrySchema from '../../schema/material-entry.schema.json' with { type: 'json' };
import indexSchema from '../../schema/theme-index.schema.json' with { type: 'json' };

const KEY = /^([a-z0-9_-]+)\/([a-z0-9_-]+)\/([a-z0-9_-]+)$/;

export class Database {
  private validateIndex: ValidateFunction;

  constructor(private themesDir: string) {
    const ajv = new Ajv();
    ajv.addSchema(entrySchema);
    this.validateIndex = ajv.compile(indexSchema);
  }

  resolve(key: string): MaterialEntry {
    const m = KEY.exec(key);
    if (!m) throw new MaterialsError('E_SCHEMA', `key does not match theme/kind/tier: ${key}`);
    const index = this.readIndex(m[1]);
    const direct = index.entries[key];
    if (direct) return direct;
    for (const entry of Object.values(index.entries)) {
      if (entry.aliases?.includes(key)) return entry;
    }
    throw new MaterialsError('E_KEY_NOT_FOUND', `no entry or alias for ${key}`);
  }

  list(filter: { theme?: string; kind?: string; tier?: string } = {}): string[] {
    const themes = filter.theme ? [filter.theme] : this.themeNames();
    const keys: string[] = [];
    for (const theme of themes) {
      for (const key of Object.keys(this.readIndex(theme).entries)) {
        const [, , kind, tier] = KEY.exec(key)!;
        if (filter.kind && kind !== filter.kind) continue;
        if (filter.tier && tier !== filter.tier) continue;
        keys.push(key);
      }
    }
    return keys.sort();
  }

  /** Writes an entry whose map files are already on disk. Caller passes the verified entry. */
  write(entry: MaterialEntry, overwrite = false): void {
    const theme = KEY.exec(entry.key)![1];
    const index = this.readIndex(theme);
    if (index.entries[entry.key] && !overwrite) {
      throw new MaterialsError('E_KEY_EXISTS', `${entry.key} exists; pass overwrite to replace`);
    }
    for (const variant of entry.variants) {
      for (const file of [...Object.values(variant.maps), ...(variant.screen ? [variant.screen.artwork] : [])]) {
        if (!existsSync(join(this.themesDir, theme, file))) {
          throw new MaterialsError('E_SCHEMA', `map file missing on disk: ${file}`);
        }
      }
    }
    index.entries[entry.key] = entry;
    if (!this.validateIndex(index)) {
      throw new MaterialsError('E_SCHEMA', 'entry fails schema validation', this.validateIndex.errors);
    }
    writeFileSync(this.indexPath(theme), JSON.stringify(index, null, 2) + '\n');
  }

  themeDir(theme: string): string {
    return join(this.themesDir, theme);
  }

  ensureTheme(theme: string): void {
    const path = this.indexPath(theme);
    if (existsSync(path)) return;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ theme, entries: {} }, null, 2) + '\n');
  }

  private themeNames(): string[] {
    if (!existsSync(this.themesDir)) return [];
    return readdirSync(this.themesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  }

  private indexPath(theme: string): string {
    return join(this.themesDir, theme, 'theme.json');
  }

  private readIndex(theme: string): ThemeIndex {
    const path = this.indexPath(theme);
    if (!existsSync(path)) throw new MaterialsError('E_THEME_NOT_FOUND', `no theme.json for ${theme}`);
    let index: ThemeIndex;
    try {
      index = JSON.parse(readFileSync(path, 'utf8')) as ThemeIndex;
    } catch (cause) {
      throw new MaterialsError('E_SCHEMA', `theme.json invalid for ${theme}`, cause);
    }
    if (!this.validateIndex(index)) {
      throw new MaterialsError('E_SCHEMA', `theme.json invalid for ${theme}`, this.validateIndex.errors);
    }
    return index;
  }
}

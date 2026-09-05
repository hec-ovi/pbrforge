import { Ajv2020 } from 'ajv/dist/2020.js';
import type { PackRequest, PackResult } from '../api-types.js';
import type { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import { PackedMaps } from './PackedMaps.js';
import schema from '../../schema/pack-request.schema.json' with { type: 'json' };

/** Publishes packed response maps for a resolved entry without changing its source maps. */
export class MaterialPacker {
  private readonly validate = new Ajv2020().compile(schema);

  constructor(private readonly db: Database) {}

  async pack(request: PackRequest): Promise<PackResult> {
    if (!this.validate(request)) {
      throw new MaterialsError('E_SCHEMA', 'pack request invalid', this.validate.errors);
    }
    const entry = this.db.resolve(request.key);
    const result = await new PackedMaps(this.db.themeDir(entry.key.split('/')[0])).apply(entry.variants);
    const updated = { ...entry, variants: result.variants };
    if (result.changed.length) this.db.write(updated, true);
    return { entry: updated, variants: result.changed };
  }
}

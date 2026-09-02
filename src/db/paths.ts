import { join } from 'node:path';

/** Asset folder of a variant, relative to the theme: its id, with a namespace (`brand:slug`) opening one folder level. */
export function variantDir(kind: string, tier: string, id: string): string {
  return join('assets', kind, tier, ...id.split(':'));
}

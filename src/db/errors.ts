export type MaterialsErrorCode =
  | 'E_SCHEMA'
  | 'E_KEY_NOT_FOUND'
  | 'E_KEY_EXISTS'
  | 'E_THEME_NOT_FOUND'
  | 'E_COMFY_UNAVAILABLE'
  | 'E_GENERATION_FAILED'
  | 'E_SEAM_CHECK_FAILED';

export class MaterialsError extends Error {
  constructor(
    readonly code: MaterialsErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'MaterialsError';
  }
}

export type PreviewErrorCode = 'E_DATABASE_UNAVAILABLE';

export class PreviewError extends Error {
  constructor(
    readonly code: PreviewErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PreviewError';
  }
}

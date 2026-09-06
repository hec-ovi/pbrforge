/** One JSON object on stdout, then the process exits. */

export interface EnvelopeOk {
  ok: true;
  verb: string;
  data: Record<string, unknown>;
}

export interface EnvelopeErr {
  ok: false;
  verb: string;
  error: { code: string; message: string; details?: unknown; hint?: string };
}

export type Envelope = EnvelopeOk | EnvelopeErr;

export function ok(verb: string, data: Record<string, unknown>): EnvelopeOk {
  return { ok: true, verb, data };
}

export function fail(verb: string, code: string, message: string, details?: unknown, hint?: string): EnvelopeErr {
  return { ok: false, verb, error: { code, message, ...(details !== undefined ? { details } : {}), ...(hint ? { hint } : {}) } };
}

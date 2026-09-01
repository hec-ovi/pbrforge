import { MaterialsError } from '../db/errors.js';

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

/** Talks to a headless ComfyUI: submit an API-format graph, poll history, fetch the image. */
export class ComfyClient {
  constructor(
    private baseUrl = process.env.COMFY_URL ?? 'http://127.0.0.1:8188',
    private timeoutMs = 600_000,
  ) {}

  async ready(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async render(graph: Graph): Promise<Buffer> {
    if (!(await this.ready())) {
      throw new MaterialsError('E_COMFY_UNAVAILABLE', `ComfyUI not reachable at ${this.baseUrl}`);
    }
    const submit = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: graph, client_id: 'urbe-materials' }),
    });
    if (!submit.ok) {
      throw new MaterialsError('E_GENERATION_FAILED', `submit rejected: ${submit.status} ${await submit.text()}`);
    }
    const { prompt_id } = (await submit.json()) as { prompt_id: string };

    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`${this.baseUrl}/history/${prompt_id}`);
      if (!res.ok) continue;
      const history = (await res.json()) as Record<string, { outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }> }>;
      const outputs = history[prompt_id]?.outputs;
      if (!outputs) continue;
      for (const node of Object.values(outputs)) {
        const image = node.images?.[0];
        if (!image) continue;
        const params = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type });
        const view = await fetch(`${this.baseUrl}/view?${params}`);
        if (!view.ok) throw new MaterialsError('E_GENERATION_FAILED', `image fetch failed: ${view.status}`);
        return Buffer.from(await view.arrayBuffer());
      }
    }
    throw new MaterialsError('E_GENERATION_FAILED', `timed out after ${this.timeoutMs} ms`);
  }
}

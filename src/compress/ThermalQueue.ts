import type { TemperatureReader } from './types.js';

/** Stop admitting parallel jobs when hot, drain running jobs, then sustain one. */
export class ThermalQueue {
  hottest: number | null = null;
  narrowed = 0;
  private held = false;

  constructor(private workers: number, private ceiling: number, private read: TemperatureReader) {}

  async run<T>(jobs: T[], work: (job: T) => Promise<void>): Promise<void> {
    const active = new Set<Promise<void>>();
    let next = 0;
    let failure: unknown;
    let failed = false;
    while ((next < jobs.length && !failed) || active.size) {
      const reading = await this.read();
      if (reading !== null && Number.isFinite(reading)) {
        this.hottest = Math.max(this.hottest ?? reading, reading);
        if (!this.held && reading > this.ceiling) {
          this.held = true;
          this.narrowed++;
        } else if (this.held && reading <= this.ceiling - 4) this.held = false;
      }
      const limit = this.held ? 1 : this.workers;
      if (!failed && next < jobs.length && active.size < limit) {
        const job = jobs[next++];
        const task = Promise.resolve().then(() => work(job)).catch(error => {
          failed = true;
          failure ??= error;
        }).finally(() => active.delete(task));
        active.add(task);
      } else if (active.size) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([...active, new Promise<void>(resolve => { timer = setTimeout(resolve, 1000); })]);
        clearTimeout(timer);
      }
    }
    if (failed) throw failure;
  }
}

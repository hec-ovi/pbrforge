import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Missing or unreadable sensors yield no reading. GPU and storage sensors are excluded. */
export async function readTemperature(root = '/sys/class/hwmon'): Promise<number | null> {
  const readings: number[] = [];
  const chips = await readdir(root).catch(() => []);
  for (const chip of chips) {
    const dir = join(root, chip);
    const name = await readFile(join(dir, 'name'), 'utf8').catch(() => '');
    if (!['k10temp', 'coretemp', 'acpitz'].includes(name.trim())) continue;
    for (const file of await readdir(dir).catch(() => [])) {
      if (!/^temp\d+_input$/.test(file)) continue;
      const raw = await readFile(join(dir, file), 'utf8').catch(() => '');
      const value = Number(raw.trim()) / 1000;
      if (raw.trim() && Number.isFinite(value)) readings.push(value);
    }
  }
  return readings.length ? Math.max(...readings) : null;
}

import type { MapName } from '../db/types.js';

export interface CompressionOptions {
  workers: number;
  maxTemp: number;
  force: boolean;
}

export interface CompressionSummary {
  written: number;
  skipped: number;
  seconds: number;
  hottest: number | null;
  narrowed: number;
}

export interface MapJob {
  png: string;
  ktx2: string;
  channel: MapName;
  tiled: boolean;
}

export type TemperatureReader = () => number | null | Promise<number | null>;

export interface CompressionRuntime {
  themesDir: string;
  executable: string;
  readTemperature?: TemperatureReader;
}

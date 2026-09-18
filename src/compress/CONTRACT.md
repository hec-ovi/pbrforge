# CONTRACT: compression

Purpose: writes a KTX2 build output beside each unique catalog PNG master.

Version: 0.17.1.

Input: `npm run compress -- [--workers N] [--max-temp C] [--force]`, [options and injected runtime](types.ts), [theme schema](../../schema/theme-index.schema.json). Workers default to floor(availableParallelism / 4), at least one; ceiling defaults to 90 C. Each encoder uses one thread. The local tool is `tools/ktx/bin/ktx`.

Output: [summary](types.ts) and one stdout line with written, skipped, seconds, hottest Celsius, narrowing count. Counts refer to unique map files. Failure exits 1. Missing sensors report unavailable. Shared references encode once; retained screen artwork is authoring input.

Newer outputs are skipped unless force is set; equal timestamps rebuild. Successful runs retain PNG path strings in `variant.maps` and publish existing compressed paths by channel in the sibling `variant.ktx2` object. PNG remains the master. Files publish by rename after successful encoding; encoding failure leaves catalog references untouched.

Before each dispatch, sample all readable k10temp, coretemp and acpitz temperatures. Above the ceiling, stop parallel admission, drain running jobs and sustain one worker until a reading reaches ceiling minus 4 C or lower. Poll each second while jobs run; a missing reading keeps an active hold. Count transitions into the hold.

`ThermalQueue(workers, ceiling, readTemperature).run(jobs, work)` schedules jobs through the injected reading function and async work callback. Its `hottest` and `narrowed` fields report the observed peak and hold count.

Encoding: [five rules](../../CONTRACT.md#compression). Tile mipmaps wrap; exact mipmaps clamp. Shared tile and exact counterparts retain tile filtering.

Dependencies: [Materials](../../CONTRACT.md), Node.js, Ajv, Sharp and the official KTX Software CLI. CPU only.

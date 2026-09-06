#!/usr/bin/env node
import { run } from './router.js';

const envelope = await run(process.argv.slice(2));
process.stdout.write(`${JSON.stringify(envelope)}\n`);
process.exit(envelope.ok ? 0 : envelope.error.code === 'E_USAGE' ? 2 : 1);

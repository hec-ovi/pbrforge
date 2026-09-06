export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export interface ParsedArgs {
  flags: Record<string, boolean>;
  options: Record<string, string>;
  rest: string[];
}

/** Boolean flags take no value. Everything else `--name value` is an option. */
export function parseArgs(argv: string[], boolFlags: string[] = []): ParsedArgs {
  const bool = new Set(boolFlags);
  const flags: Record<string, boolean> = {};
  const options: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith('--')) {
      rest.push(token);
      continue;
    }
    const name = token.slice(2);
    if (!name) throw new UsageError('empty flag');
    if (bool.has(name)) {
      flags[name] = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new UsageError(`--${name} needs a value`);
    options[name] = value;
    i += 1;
  }
  return { flags, options, rest };
}

export function themesOption(options: Record<string, string>): { themesDir?: string } {
  return options.themes ? { themesDir: options.themes } : {};
}

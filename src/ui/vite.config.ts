import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const uiRoot = dirname(fileURLToPath(import.meta.url));
const themesDir = join(uiRoot, '..', '..', 'themes');

const MIME: Record<string, string> = { '.json': 'application/json', '.png': 'image/png' };

/** Serves the material database read-only: /api/themes lists themes, /themes/* serves theme.json and maps. */
function themesServer(): Plugin {
  return {
    name: 'themes-server',
    configureServer(server) {
      server.middlewares.use('/api/themes', (_req, res) => {
        const names = existsSync(themesDir)
          ? readdirSync(themesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
          : [];
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(names));
      });
      server.middlewares.use('/themes', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]);
        const path = join(themesDir, rel);
        const mime = MIME[extname(path)];
        if (!mime || !path.startsWith(themesDir) || !existsSync(path)) return next();
        res.setHeader('content-type', mime);
        res.end(readFileSync(path));
      });
    },
  };
}

export default defineConfig({
  root: uiRoot,
  server: { port: 5177 },
  plugins: [themesServer()],
});

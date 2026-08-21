import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { buildApp } from './app.js';
import { resolvePort } from './config.js';
import { connectDb } from './db.js';
import { attachSocket } from './socket.js';
import { startReminderCron } from './reminderCron.js';

/**
 * Arranque. El guard de «¿me ejecutaron directamente?» compara rutas REALES:
 * bajo el symlink `current/` de las releases, `import.meta.url` da la ruta
 * física y `process.argv[1]` la escrita — compararlas crudas dio 30 minutos de
 * caída en la mini (`deploy-mini` §4).
 */
const executedDirectly = (() => {
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  try {
    return realpathSync(new URL(import.meta.url).pathname) === realpathSync(argvPath);
  } catch {
    return false;
  }
})();

export function startServer(): void {
  const port = resolvePort();
  const app = buildApp();
  // El socket se cuelga del MISMO servidor HTTP: un proceso, un puerto, una
  // entrada en Torre (spec §12.1).
  const httpServer = createServer(app);
  attachSocket(httpServer);
  // Escuchar ANTES de conectar la base: el health contesta desde el arranque y
  // un Mongo lento no deja al proceso mudo (patrón de lila).
  httpServer.listen(port, () => {
    console.log(`[lilachat] escuchando en :${port} (http + ws)`);
  });
  // El cron arranca DESPUÉS de la base: sin conexión sus consultas quedarían
  // bufferizadas y el primer tick colgaría en silencio.
  connectDb()
    .then(() => startReminderCron())
    .catch((error) => {
    console.error('[lilachat] mongo no conectó:', error instanceof Error ? error.message : error);
  });
}

if (executedDirectly) startServer();

import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { buildApp } from './app.js';
import { resolvePort } from './config.js';
import { connectDb } from './db.js';
import { attachSocket } from './socket.js';
import { startReminderCron } from './reminderCron.js';
import { startBackupCron } from './backupCron.js';

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

/**
 * Red de seguridad del proceso.
 *
 * Express 4 NO atrapa lo que lanza un handler `async`: la promesa queda
 * rechazada sin dueño y Node 22, por defecto, mata el proceso. En F7 eso pasó
 * de verdad — una cabecera con un guion largo tumbó el server entero, y con él
 * los sockets de todos los conectados.
 *
 * Esto NO es una excusa para no manejar errores: registra con el detalle
 * completo para que el fallo se arregle. Lo que evita es que un bug en UNA ruta
 * deje sin chat a toda la familia.
 */
function protegerProceso(): void {
  process.on('unhandledRejection', (motivo) => {
    console.error('[lilachat] promesa sin manejar:', motivo);
  });
  process.on('uncaughtException', (error) => {
    console.error('[lilachat] excepción sin atrapar:', error);
  });
}

export function startServer(): void {
  protegerProceso();

  /**
   * LOS SECRETOS SE COMPRUEBAN AL ARRANCAR, no en el primer request.
   *
   * Sin `JWT_SECRET` en producción, `resolveJwtSecret()` lanza DENTRO de
   * `verifySession`, que atrapa y devuelve `null`: el server arranca perfecto,
   * el health responde 200, la web carga… y **todo el mundo recibe
   * «unauthorized» sin una sola línea en el log**. Se descubrió simulando el
   * arranque de Torre (24/08/2026), antes de desplegar.
   *
   * Fallar acá es ruidoso y ocurre una vez; fallar allá es mudo y ocurre para
   * siempre.
   */
  if (process.env.NODE_ENV === 'production') {
    for (const nombre of ['JWT_SECRET', 'MONGO_URL', 'CONSTROAD_AUTH_KEY']) {
      if (!process.env[nombre]) {
        console.error(`[lilachat] falta ${nombre}: no se arranca sin eso.`);
        process.exit(1);
      }
    }
  }
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
    .then(() => {
      startReminderCron();
      startBackupCron();
    })
    .catch((error) => {
    console.error('[lilachat] mongo no conectó:', error instanceof Error ? error.message : error);
  });
}

if (executedDirectly) startServer();

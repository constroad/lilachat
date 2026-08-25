import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { buildHttpAuthClient, type AuthClient } from './authClient.js';
import { buildAuthRouter } from './authRoutes.js';
import { buildChatRouter } from './chatRoutes.js';
import { buildMediaRouter } from './mediaRoutes.js';
import { buildEventRouter } from './eventRoutes.js';
import { buildPushRouter } from './pushRoutes.js';
import { buildBackupRouter } from './backupRoutes.js';
import { buildAssistantRouter } from './assistantRoutes.js';
import { buildContactRouter } from './contactRoutes.js';
import { buildKeyRouter } from './keyRoutes.js';
import { buildCallRouter } from './callRoutes.js';
import type { MediaUploader } from './mediaClient.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

/**
 * Dónde quedó el bundle de la web.
 *
 * Se buscan DOS rutas porque el árbol de desarrollo y el de una release no
 * tienen la misma forma: en desarrollo el server corre desde `server/dist` con
 * `web/dist` como hermano de `server/`; en la mini todo cuelga de
 * `current/`. Devuelve `null` sin ruido cuando no hay build —correr solo la API
 * es legítimo, y hacer fallar el arranque por eso dejaría el server abajo por
 * una pantalla que no siempre hace falta.
 */
function resolveWebDir(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // El bundle vive en `<release>/dist/index.js`, así que la web está al lado.
    path.resolve(here, '../web/dist'),
    // Y estas dos por si se corre desde `server/dist` (build viejo o local).
    path.resolve(here, '../../web/dist'),
    path.resolve(here, '../../../web/dist'),
  ];
  return candidates.find((candidate) => existsSync(path.join(candidate, 'index.html'))) ?? null;
}

/** Dependencias inyectables: los tests pasan un constroad-auth falso. */
export type AppDeps = { authClient?: AuthClient; mediaUploader?: MediaUploader };

/**
 * La app Express, separada del `listen` para poder testearla con supertest
 * sin abrir un puerto.
 *
 * El health lleva la IDENTIDAD del servicio: un health check contra un puerto
 * prueba que «alguien atiende ahí», no que sea Lilachat (`deploy-mini` §1).
 */
export function buildApp(deps: AppDeps = {}): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'lilachat-server', version });
  });

  app.use('/api/auth', buildAuthRouter(deps.authClient ?? buildHttpAuthClient()));
  app.use('/api/chats', buildChatRouter());
  app.use('/api/media', buildMediaRouter(deps.mediaUploader));
  app.use('/api/agenda', buildEventRouter());
  app.use('/api/push', buildPushRouter());
  app.use('/api/backup', buildBackupRouter());
  app.use('/api/assistant', buildAssistantRouter());
  app.use('/api/contacts', buildContactRouter());
  app.use('/api/keys', buildKeyRouter());
  app.use('/api/calls', buildCallRouter());

  // ─── La web (F6) ─────────────────────────────────────────────────────────
  //
  // El mismo proceso sirve la API y el bundle: un origen, sin CORS que
  // configurar, sin cookies de terceros y UNA sola entrada en Torre.
  //
  // Va DESPUÉS de `/api` para que una ruta de API inexistente conteste 404 de
  // JSON y no el `index.html` —un 200 con HTML donde el cliente espera JSON es
  // el error más difícil de leer de todos.
  const webDir = resolveWebDir();
  if (webDir) {
    app.use(express.static(webDir, { index: false }));
    // Toda ruta que no sea API cae en el `index.html`: la SPA maneja su propio
    // ruteo y un refresco en cualquier URL tiene que seguir funcionando.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(webDir, 'index.html'));
    });
  }

  /**
   * Un handler `async` que falla tiene que CONTESTAR.
   *
   * Express 4 no atrapa las promesas rechazadas: la petición queda sin
   * respuesta y el cliente espera para siempre. Con Mongo desconectado, cada
   * ruta que consulta la base dejaba el teléfono con el skeleton eterno —y en
   * el log solo aparecía «promesa sin manejar», que no le sirve a quien está
   * mirando la pantalla.
   *
   * Va DESPUÉS de las rutas y ANTES del 404, que es donde Express busca el
   * manejador de errores.
   */
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('[lilachat] ruta falló:', error instanceof Error ? error.message : error);
      if (res.headersSent) return;
      res.status(500).json({ message: 'Algo falló de nuestro lado. Inténtalo de nuevo.' });
    }
  );

  // Errores genéricos, sin stack ni rutas internas (constroad-security §5).
  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  return app;
}

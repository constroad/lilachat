import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { buildHttpAuthClient, type AuthClient } from './authClient.js';
import { buildAuthRouter } from './authRoutes.js';
import { buildChatRouter } from './chatRoutes.js';
import { buildMediaRouter } from './mediaRoutes.js';
import { buildMediaLibraryRouter } from './mediaLibraryRoutes.js';
import { buildEventRouter } from './eventRoutes.js';
import { buildPendientesRouter } from './pendientesRoutes.js';
import { buildPushRouter } from './pushRoutes.js';
import { buildBackupRouter } from './backupRoutes.js';
import { buildAssistantRouter } from './assistantRoutes.js';
import { buildCrashRouter } from './crashRoutes.js';
import { buildWorkspaceRouter } from './workspaceRoutes.js';
import { buildContactRouter } from './contactRoutes.js';
import { buildKeyRouter } from './keyRoutes.js';
import { buildCallRouter } from './callRoutes.js';
import { buildMeRouter } from './meRoutes.js';
import { buildRespaldoRouter } from './respaldoRoutes.js';
import type { MediaUploader } from './mediaClient.js';
import { buildVistaPreviaRouter, type TraerVistaPrevia } from './vistaPreviaRoutes.js';
import { traerVistaPrevia } from './traerVistaPrevia.js';
import { buildRecordatoriosDeGrupoRouter } from './recordatoriosDeGrupo.js';
import { cabecerasDeSeguridad } from './cabecerasDeSeguridad.js';
import { montarServiceWorker } from './serviceWorker.js';
import { buildVincularRouters, type OpcionesDeVinculacion } from './vincularRoutes.js';
import { buildFijadosRouter } from './fijadosRoutes.js';
import { buildDestacadosRouter } from './destacadosRoutes.js';
import { buildActivityRouter } from './activityRoutes.js';
import { buildFunRouter } from './funRoutes.js';
import { buildChecklistRouter } from './checklistRoutes.js';
import { buildStickersRouter } from './stickersRoutes.js';
import { buildReenvioRouter } from './reenvioRoutes.js';
import { buildHilosRouter } from './hilosRoutes.js';
import { buildBotRouter, buildOAuthRouter } from './bots/botRoutes.js';
import { buildBotUserRouter } from './bots/botUserRoutes.js';
import { notifyEdited } from './reparto.js';

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
export type AppDeps = {
  authClient?: AuthClient;
  mediaUploader?: MediaUploader;
  traerVistaPrevia?: TraerVistaPrevia;
  vinculacion?: OpcionesDeVinculacion;
};

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

  // Vincular por QR (W5): antes que `/api/auth`, que no conoce estas rutas.
  const vincular = buildVincularRouters(deps.vinculacion);
  app.use('/api/auth/vincular', vincular.web);
  app.use('/api/vinculos', vincular.telefono);
  app.use('/api/auth', buildAuthRouter(deps.authClient ?? buildHttpAuthClient()));
  // The bots API (`specs/BOTS-API.spec.md`): its own doors, before the chat routers.
  app.use('/api/oauth', buildOAuthRouter());
  app.use('/api/bots', buildBotRouter(notifyEdited));
  app.use('/api', buildBotUserRouter());
  app.use('/api', buildDestacadosRouter());
  app.use('/api', buildActivityRouter());
  app.use('/api', buildFunRouter());
  app.use('/api', buildStickersRouter(deps.mediaUploader));
  app.use('/api/chats', buildFijadosRouter());
  app.use('/api/chats', buildReenvioRouter());
  app.use('/api/chats', buildHilosRouter());
  app.use('/api/chats', buildChatRouter(deps.mediaUploader));
  app.use('/api/media', buildMediaLibraryRouter());
  app.use('/api/media', buildMediaRouter(deps.mediaUploader));
  app.use('/api/agenda', buildRecordatoriosDeGrupoRouter(deps.mediaUploader));
  app.use('/api/agenda', buildPendientesRouter());
  app.use('/api/agenda', buildEventRouter());
  app.use('/api/agenda', buildChecklistRouter());
  app.use('/api/push', buildPushRouter());
  app.use('/api/backup', buildBackupRouter());
  app.use('/api/assistant', buildAssistantRouter());
  // Sin sesión: una app que revienta al arrancar no llegó a tener una.
  app.use('/api/crash', buildCrashRouter());
  app.use('/api/contacts', buildContactRouter());
  app.use('/api/workspaces', buildWorkspaceRouter(deps.mediaUploader));
  app.use('/api/keys', buildKeyRouter());
  app.use('/api/calls', buildCallRouter());
  app.use('/api/me', buildMeRouter(deps.mediaUploader));
  app.use('/api/respaldos', buildRespaldoRouter());
  app.use('/api/enlaces', buildVistaPreviaRouter(deps.traerVistaPrevia ?? traerVistaPrevia));

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
    // CSP y compañía para todo lo que sirve la web (W0).
    app.use(/^(?!\/api\/).*/, cabecerasDeSeguridad);
    // El service worker (W4), sin extensión y sin caché.
    const indexHtml = readFileSync(path.join(webDir, 'index.html'), 'utf8');
    const plantillaDelSw = path.join(webDir, 'sw.js');
    if (existsSync(plantillaDelSw)) montarServiceWorker(app, { plantilla: readFileSync(plantillaDelSw, 'utf8'), indexHtml });
    app.use(
      express.static(webDir, {
        index: false,
        // Lo que tiene hash en el nombre no cambia nunca: se guarda un año.
        setHeaders: (res, archivo) => {
          // MediaPipe's wasm and the sticker packs carry their version in the folder: they never change either.
          const versioned = ['assets', 'mediapipe', 'stickers'].some((folder) => archivo.includes(`${path.sep}${folder}${path.sep}`));
          if (versioned) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      })
    );
    // Toda ruta que no sea API cae en el `index.html`: la SPA maneja su propio
    // ruteo y un refresco en cualquier URL tiene que seguir funcionando. Sin
    // caché: es el que apunta a los archivos de cada versión.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
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

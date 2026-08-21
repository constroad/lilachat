import { createRequire } from 'node:module';
import express, { type Express } from 'express';
import { buildHttpAuthClient, type AuthClient } from './authClient.js';
import { buildAuthRouter } from './authRoutes.js';
import { buildChatRouter } from './chatRoutes.js';
import { buildMediaRouter } from './mediaRoutes.js';
import { buildEventRouter } from './eventRoutes.js';
import type { MediaUploader } from './mediaClient.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

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

  // Errores genéricos, sin stack ni rutas internas (constroad-security §5).
  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  return app;
}

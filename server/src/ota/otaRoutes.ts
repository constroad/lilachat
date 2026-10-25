import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import express, { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { DemasiadoGrande, type Disco } from '../disco.js';
import { OtaStore, type UpdateKind } from './otaStore.js';
import {
  ASSET_HASH,
  NO_UPDATE_DIRECTIVE,
  RUNTIME_VERSION,
  directiveResponse,
  isRollbackDirective,
  isValidSignature,
  manifestResponse,
  summarizeManifest,
  type MultipartResponse,
} from './otaProtocol.js';

/**
 * Self-hosted Expo Updates v1 (agentes 25/10/2026). Two audiences on one prefix:
 *
 * - The PHONES (`GET /manifest`, `GET /assets/:hash`) are PUBLIC: they carry no session, and everything they
 *   get is code that is already inside every installed app. The manifest is signed by José's key and the phone
 *   checks it, so a forged answer would simply be ignored. This contradicts the «every route is guarded» rule
 *   on purpose; it is the protocol.
 * - The PUBLISHER (`PUT/HEAD /assets/:hash`, `POST /updates`) is José's machine, with `OTA_PUBLISH_TOKEN`.
 *
 * Without the disk the answer is 503 + Retry-After, never 404 (a 404 would stick in the phone's cache).
 */
export type OtaDeps = {
  disk: () => Disco | null;
  /** The publish token; unset or empty means nobody can publish. */
  token: () => string | undefined;
  /** The PUBLIC certificate the phones trust; the server verifies signatures with it, it never signs. */
  certificate: () => Promise<string | null>;
  maxAssetBytes?: number;
  orphanGraceMs?: number;
  keep?: number;
  log?: (line: string) => void;
};

const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const ORPHAN_GRACE_MS = 60 * 60_000;
const KEEP_UPDATES = 10;
const YEAR_S = 31_536_000;
const GZIP_MIN_BYTES = 1024;
const RETRY_AFTER_ABSENT_S = '5';
const RETRY_AFTER_HUNG_S = '10';
const CONTENT_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(; ?charset=[a-z0-9_-]+)?$/i;
const COMPRESSIBLE = /^(application\/(javascript|json)|text\/|image\/svg\+xml)/i;

const digest = (value: string) => createHash('sha256').update(value).digest();

function requirePublisher(token: () => string | undefined): RequestHandler {
  return (req, res, next) => {
    const expected = token();
    const given = /^Bearer (.+)$/.exec(req.header('authorization') ?? '')?.[1];
    if (!expected || !given || !timingSafeEqual(digest(given), digest(expected))) return void res.status(401).json({ message: 'Token de publicación inválido' });
    next();
  };
}

/** Express 4 does not catch a rejected handler: one that throws must answer 500, not hang. */
const guarded = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req, res, next) => {
  handler(req, res).catch(next);
};

function send(res: Response, answer: MultipartResponse): void {
  res.status(200).set({ 'expo-protocol-version': '1', 'expo-sfv-version': '0', 'cache-control': 'private, max-age=0', 'content-type': answer.contentType }).send(answer.body);
}

export function buildOtaRouter(deps: OtaDeps): Router {
  const router = Router();
  const maxAssetBytes = deps.maxAssetBytes ?? MAX_ASSET_BYTES;
  const log = deps.log ?? (() => undefined);
  const publisher = requirePublisher(deps.token);

  async function openStore(res: Response): Promise<OtaStore | null> {
    const disk = deps.disk();
    const state = disk ? await disk.estado() : 'ausente';
    if (!disk || state !== 'montado') {
      res.setHeader('Retry-After', state === 'colgado' ? RETRY_AFTER_HUNG_S : RETRY_AFTER_ABSENT_S);
      res.status(503).json({ message: 'El almacenamiento de actualizaciones no está disponible', motivo: state === 'colgado' ? 'disco_colgado' : 'disco_ausente' });
      return null;
    }
    return new OtaStore(disk, { keep: deps.keep ?? KEEP_UPDATES, orphanGraceMs: deps.orphanGraceMs ?? ORPHAN_GRACE_MS });
  }

  router.get(
    '/manifest',
    guarded(async (req, res) => {
      const runtime = req.header('expo-runtime-version') ?? '';
      if (req.header('expo-protocol-version') !== '1' || req.header('expo-platform') !== 'android' || !RUNTIME_VERSION.test(runtime)) {
        return void res.status(400).json({ message: 'Se espera protocolo 1, plataforma android y un runtime válido' });
      }
      const store = await openStore(res);
      if (!store) return;
      const latest = await store.latest(runtime);
      const current = req.header('expo-current-update-id')?.toLowerCase();
      const embedded = req.header('expo-embedded-update-id')?.toLowerCase();
      const alreadyThere = latest?.kind === 'manifest' ? current === latest.id : latest?.kind === 'directive' ? !embedded || current === embedded : true;
      if (latest && !alreadyThere) {
        log(`[ota] manifest runtime=${runtime.slice(0, 8)} current=${current?.slice(0, 8) ?? '-'} -> ${latest.kind} ${latest.id.slice(0, 8)}`);
        return send(res, latest.kind === 'manifest' ? manifestResponse(latest.payload, latest.signature) : directiveResponse(latest.payload, latest.signature));
      }
      const nothing = await store.noUpdate();
      if (!nothing) return void res.status(404).json({ message: 'Todavía no hay actualizaciones publicadas' });
      log(`[ota] manifest runtime=${runtime.slice(0, 8)} current=${current?.slice(0, 8) ?? '-'} -> noUpdateAvailable`);
      send(res, directiveResponse(nothing.payload, nothing.signature));
    })
  );

  // Registered BEFORE the public GET: Express would otherwise answer HEAD with the public handler.
  router.head(
    '/assets/:hash',
    publisher,
    guarded(async (req, res) => {
      if (!ASSET_HASH.test(req.params.hash ?? '')) return void res.status(400).end();
      const store = await openStore(res);
      if (store) res.status((await store.hasAsset(req.params.hash!)) ? 200 : 404).end();
    })
  );

  router.get(
    '/assets/:hash',
    guarded(async (req, res) => {
      const hash = req.params.hash ?? '';
      if (!ASSET_HASH.test(hash)) return void res.status(400).json({ message: 'Nombre de asset inválido' });
      const store = await openStore(res);
      if (!store) return;
      const asset = await store.openAsset(hash);
      if (!asset) return void res.status(404).end();
      res.set({ 'Content-Type': asset.contentType, 'Cache-Control': `public, max-age=${YEAR_S}, immutable` });
      if (asset.bytes >= GZIP_MIN_BYTES && COMPRESSIBLE.test(asset.contentType) && req.acceptsEncodings('gzip') === 'gzip') {
        res.set({ 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
        return void (await pipeline(createReadStream(asset.path), createGzip(), res));
      }
      res.sendFile(asset.path, { acceptRanges: true, dotfiles: 'allow', headers: { 'Content-Type': asset.contentType } }, (error) => {
        if (error && !res.headersSent) res.status(404).end();
      });
    })
  );

  router.put(
    '/assets/:hash',
    publisher,
    guarded(async (req, res) => {
      const hash = req.params.hash ?? '';
      if (!ASSET_HASH.test(hash)) return void res.status(400).json({ message: 'Nombre de asset inválido' });
      const store = await openStore(res);
      if (!store) return;
      if (await store.hasAsset(hash)) {
        req.resume();
        return void res.status(200).json({ hash, stored: false });
      }
      if (Number(req.header('content-length') ?? 0) > maxAssetBytes) return void res.status(413).set('Connection', 'close').json({ message: 'El asset pasa el tope' });
      const declared = req.header('x-ota-content-type') ?? '';
      const contentType = CONTENT_TYPE.test(declared) ? declared : 'application/octet-stream';
      try {
        const outcome = await store.receiveAsset(hash, req, contentType, maxAssetBytes);
        if (outcome === 'mismatch') return void res.status(422).json({ message: 'Los bytes no corresponden al SHA-256 del nombre' });
        res.status(201).json({ hash, stored: true });
      } catch (error) {
        if (error instanceof DemasiadoGrande) return void res.status(413).set('Connection', 'close').json({ message: 'El asset pasa el tope' });
        throw error;
      }
    })
  );

  router.post(
    '/updates',
    publisher,
    express.json({ limit: '1mb' }),
    guarded(async (req, res) => {
      const body = (req.body ?? {}) as { runtimeVersion?: unknown; manifest?: unknown; directive?: unknown; signature?: unknown; noUpdateSignature?: unknown };
      const { runtimeVersion, manifest, directive, signature, noUpdateSignature } = body;
      const payload = typeof manifest === 'string' ? manifest : directive;
      if (typeof runtimeVersion !== 'string' || !RUNTIME_VERSION.test(runtimeVersion)) return void res.status(400).json({ message: 'runtimeVersion inválido' });
      if (typeof payload !== 'string' || (typeof manifest === 'string') === (typeof directive === 'string') || typeof signature !== 'string') {
        return void res.status(400).json({ message: 'Se espera exactamente uno de manifest o directive, y su signature' });
      }
      const certificate = await deps.certificate();
      if (!certificate) return void res.status(503).json({ message: 'El server no tiene el certificado para verificar firmas' });
      const store = await openStore(res);
      if (!store) return;
      if (!isValidSignature(payload, signature, certificate)) return void res.status(422).json({ message: 'La firma no corresponde al contenido' });
      if (typeof noUpdateSignature === 'string' && !isValidSignature(NO_UPDATE_DIRECTIVE, noUpdateSignature, certificate)) {
        return void res.status(422).json({ message: 'La firma de noUpdateAvailable no es válida' });
      }
      const kind: UpdateKind = typeof manifest === 'string' ? 'manifest' : 'directive';
      let id: string;
      if (kind === 'manifest') {
        const summary = summarizeManifest(payload);
        if (!summary || summary.runtimeVersion !== runtimeVersion) return void res.status(422).json({ message: 'El manifest no es válido o su runtime no es el publicado' });
        const missing = await store.missingAssets(summary.assetHashes);
        if (missing.length > 0) return void res.status(422).json({ message: 'Faltan assets por subir', missing });
        id = summary.id;
      } else {
        if (!isRollbackDirective(payload)) return void res.status(422).json({ message: 'Solo se publica la directiva rollBackToEmbedded' });
        id = crypto.randomUUID();
      }
      const noUpdate = typeof noUpdateSignature === 'string' ? { payload: NO_UPDATE_DIRECTIVE, signature: noUpdateSignature } : undefined;
      const report = await store.publish(runtimeVersion, { kind, id, payload, signature }, noUpdate);
      log(`[ota] publicado ${kind} ${id.slice(0, 8)} runtime=${runtimeVersion.slice(0, 8)} podadas=${report.updatesRemoved} assets=${report.assetsRemoved}`);
      res.status(201).json({ id, kind, runtimeVersion, ...report });
    })
  );

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    const status = (error as { status?: number }).status;
    res.status(status && status >= 400 && status < 500 ? status : 500).json({ message: status && status < 500 ? 'Solicitud inválida' : 'Error interno de OTA' });
  });

  return router;
}

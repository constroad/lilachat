import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { buildMediaPath, buildStorageName } from '@lilachat/shared';
import type { Disco } from './disco.js';
import { buildLilaUploader, type MediaUploader, type UploadOutcome } from './mediaClient.js';
import { MEDIA_PREFIX, mediaDisk } from './mediaDisk.js';

const run = promisify(execFile);
const THUMB_SIDE = 640;
const THUMB_QUALITY = 72;
const HASH_IN_NAME = 16;
const VIDEO_THUMB_TIMEOUT_MS = 20_000;
const THUMBS_FOLDER = 'thumbs';

export type VideoThumbnailMaker = (video: string, thumb: string) => Promise<boolean>;

/** The first frame with the ffmpeg of the machine (`FFMPEG_BIN` or the one on PATH); false when there is none. */
const ffmpegThumbnail: VideoThumbnailMaker = async (video, thumb) => {
  try {
    await run(process.env.FFMPEG_BIN || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-frames:v', '1', '-vf', `scale='min(${THUMB_SIDE},iw)':-2`, '-q:v', '4', thumb], { timeout: VIDEO_THUMB_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
};

async function imageThumbnail(image: string, thumb: string): Promise<boolean> {
  const { default: sharp } = await import('sharp');
  return sharp(image).rotate().resize(THUMB_SIDE, THUMB_SIDE, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: THUMB_QUALITY, mozjpeg: true }).toFile(thumb).then(() => true, () => false);
}

/** `image-<stamp>.png` → `image-<stamp>_<hash16>.png`: our URLs are public, so they must not be guessable. */
const nameWithHash = (storageName: string, hash: string): string => {
  const dot = storageName.lastIndexOf('.');
  const base = dot === -1 ? storageName : storageName.slice(0, dot);
  return `${base}_${hash.slice(0, HASH_IN_NAME)}${dot === -1 ? '' : storageName.slice(dot)}`;
};

/**
 * Uploads to our own disk (pending 82) with the same answer lila gave: URL,
 * thumbnail, its status and the stream URL. While the root has no marker
 * (before `medios:init` runs on the mini) uploads keep going to lila, so nobody
 * loses a photo during the move.
 */
export function buildLocalUploader(deps: { disk: () => Disco | null; fallback: MediaUploader; videoThumbnail?: VideoThumbnailMaker; now?: () => Date }): MediaUploader {
  const videoThumbnail = deps.videoThumbnail ?? ffmpegThumbnail;
  return {
    async upload(params): Promise<UploadOutcome> {
      const disk = deps.disk();
      if (!disk || (await disk.estado()) !== 'montado') return deps.fallback.upload(params);
      const received = await disk.recibir(Readable.from(params.bytes));
      const name = nameWithHash(buildStorageName(params.fileName, params.kind, (deps.now ?? (() => new Date()))()), received.huella);
      const relative = `${buildMediaPath(params.chatId)}/${name}`;
      await disk.mover(received.temporal, relative);
      const thumbRelative = `${THUMBS_FOLDER}/${received.huella}.jpg`;
      await mkdir(path.join(disk.raiz, THUMBS_FOLDER), { recursive: true });
      const source = path.join(disk.raiz, relative);
      const target = path.join(disk.raiz, thumbRelative);
      const made = params.kind === 'image' ? await imageThumbnail(source, target) : params.kind === 'video' ? await videoThumbnail(source, target) : false;
      const url = `${MEDIA_PREFIX}${relative}`;
      return {
        ok: true,
        media: {
          url,
          ...(made ? { thumbnailUrl: `${MEDIA_PREFIX}${thumbRelative}` } : {}),
          thumbnailStatus: made ? 'ready' : 'unsupported',
          ...(params.kind === 'video' ? { streamUrl: url } : {}),
          sizeBytes: received.bytes,
          storageName: name,
        },
      };
    },
  };
}

/** What every route uploads with: our disk when `CHAT_STORAGE_ROOT` is set, lila while it is not. */
export function defaultMediaUploader(): MediaUploader {
  const lila = buildLilaUploader();
  return process.env.CHAT_STORAGE_ROOT ? buildLocalUploader({ disk: mediaDisk, fallback: lila }) : lila;
}

import './env.js';
import mongoose from 'mongoose';
import { connectDb } from './db.js';
import { mediaDisk } from './mediaDisk.js';
import { readMediaBytes } from './mediaClient.js';
import { pdfThumbnail } from './pdfThumbnail.js';
import { backfillPdfThumbnails } from './pdfThumbnailBackfill.js';

/**
 * Run by hand on the machine that serves Lilachat (José 17/11 approved writing production): the first page of
 * the PDFs sent before the server drew it. Without `--apply` it only counts.
 *
 *   npm run pdf:miniaturas -w server
 *   npm run pdf:miniaturas -w server -- --apply
 */
const disk = mediaDisk();
if (!disk || (await disk.estado()) !== 'montado') {
  console.error('[lilachat] el disco de medios no está montado (CHAT_STORAGE_ROOT): no hay dónde guardar las miniaturas.');
  process.exit(1);
}
await connectDb();
const apply = process.argv.includes('--apply');
const outcome = await backfillPdfThumbnails({ apply, root: disk.raiz, read: readMediaBytes, make: pdfThumbnail });
console.log(`[lilachat] PDF sin miniatura: ${outcome.found}.`);
console.log(apply ? `[lilachat] hechas ${outcome.made}, sin leer ${outcome.unreadable}, sin dibujar ${outcome.failed}.` : '[lilachat] solo conteo: con --apply las dibuja.');
await mongoose.disconnect();

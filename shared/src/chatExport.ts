import { textoDeAviso } from './avisoDeGrupo.js';
import { hasDisappeared } from './disappearing.js';

/**
 * «Exportar chat» (R31/10-B7), as WhatsApp writes it: one line per message,
 * «31/10/2026, 14:05 - Ana: texto». The media is named, not attached; what was
 * deleted for everyone says so; what disappeared is not there. PURE: the server
 * builds the file and each client only saves or shares it.
 */
export type ExportRow = {
  senderId: string;
  kind?: string;
  body?: string;
  media?: { name?: string };
  system?: { evento: string; valor?: string; quien?: { name?: string; phone?: string }; aQuien?: { name?: string; phone?: string } };
  at: Date | string;
  deletedAt?: Date | string | null;
  disappearsAt?: Date | string | null;
  hiloDe?: number;
};

export const DEFAULT_EXPORT_TIME_ZONE = 'America/Lima';

const OMITTED: Record<string, string> = {
  image: '<Foto omitida>',
  video: '<Video omitido>',
  audio: '<Audio omitido>',
  sticker: '<Sticker omitido>',
  location: '<Ubicación>',
  contact: '<Contacto>',
  poll: '<Encuesta>',
  event: '<Evento>',
  reminder: '<Recordatorio>',
  checklist: '<Lista>',
  zumbido: '<Zumbido>',
  guino: '<Guiño>',
};

const formatters: Record<string, Intl.DateTimeFormat> = {};
const ZONE_SHAPE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/;

/** The kept formatter of a zone; null when the runtime does not know it. */
function formatterOf(zone: string): Intl.DateTimeFormat | null {
  if (!ZONE_SHAPE.test(zone)) return null;
  try {
    return (formatters[zone] ??= new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  } catch {
    return null;
  }
}

/** Whether the runtime knows this IANA zone. */
export const isTimeZone = (value: string): boolean => formatterOf(value) !== null;

/** «31/10/2026, 14:05» in the reader's zone; an unknown zone falls back to Lima. */
export function exportStamp(at: Date | string, timeZone: string): string {
  const format = formatterOf(timeZone) ?? formatterOf(DEFAULT_EXPORT_TIME_ZONE)!;
  const parts = Object.fromEntries(format.formatToParts(new Date(at)).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}`;
}

function contentOf(row: ExportRow): string {
  if (row.deletedAt) return 'Se eliminó este mensaje';
  const caption = row.body?.trim() ?? '';
  if (row.kind === 'file') return [`<Archivo: ${row.media?.name ?? 'sin nombre'}>`, caption].filter(Boolean).join(' ');
  const omitted = row.kind ? OMITTED[row.kind] : undefined;
  return omitted ? [omitted, caption].filter(Boolean).join(' ') : caption;
}

/** One line, or null for what is not exported (a message whose time passed). */
export function exportLine(row: ExportRow, nameOf: (userId: string) => string, timeZone: string, now: number): string | null {
  if (hasDisappeared(row, now)) return null;
  const stamp = exportStamp(row.at, timeZone);
  if (row.kind === 'system') {
    const who = row.system?.quien?.name ?? row.system?.quien?.phone ?? nameOf(row.senderId);
    const text = row.system ? textoDeAviso({ quien: who, esMio: false, evento: row.system.evento, aQuien: row.system.aQuien?.name ?? row.system.aQuien?.phone, valor: row.system.valor }) : '';
    return `${stamp} - ${text || row.body || ''}`;
  }
  const thread = row.hiloDe !== undefined && row.hiloDe !== null ? '(en un hilo) ' : '';
  return `${stamp} - ${nameOf(row.senderId)}: ${thread}${contentOf(row)}`;
}

/** The whole file, oldest first, ending with a newline. */
export function exportChatText(rows: readonly ExportRow[], nameOf: (userId: string) => string, timeZone: string = DEFAULT_EXPORT_TIME_ZONE, now: number = Date.now()): string {
  const lines = rows.map((row) => exportLine(row, nameOf, timeZone, now)).filter((line): line is string => line !== null);
  return lines.length ? `${lines.join('\n')}\n` : '';
}

/** «Chat de Lilachat con Obra Norte.txt», without characters a file system refuses. */
export function exportFileName(chatName: string): string {
  const clean = chatName.replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return `Chat de Lilachat con ${clean || 'el chat'}.txt`;
}
/** The name the server gave the export in `Content-Disposition` (`filename*`), or the fallback. */
export function fileNameFromDisposition(header: string | null | undefined, fallback: string): string {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (!encoded) return fallback;
  try {
    return decodeURIComponent(encoded).replace(/[\\/]+/g, ' ');
  } catch {
    return fallback;
  }
}

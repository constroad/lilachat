import type { ChatDeOrigen } from './tiposDeAgenda.js';

/**
 * «Destacados» (José aprobó el 20/10): la estrella PERSONAL de WhatsApp. El
 * fijado es para todos; destacar lo ve solo quien lo marcó. Tipos y motor
 * puro para la app y la web (`GET /api/destacados`).
 */
export type MensajeDestacado = {
  kind: string;
  at?: string;
  body?: string;
  ref?: { tipo: string; id: string };
  media?: { mime?: string; thumbUrl?: string; fileName?: string };
};

export type DestacadoEnLista = {
  chatId: string;
  seq: number;
  en: string;
  chat: ChatDeOrigen;
  autor: { id: string; phone?: string; name?: string };
  mensaje: MensajeDestacado;
};

/** La línea de un destacado en la lista: el texto, o la etiqueta de lo que no es texto. */
export function textoDelDestacado(mensaje: MensajeDestacado): string {
  if (mensaje.kind === 'sticker') return 'Sticker';
  const mime = mensaje.media?.mime ?? '';
  const pie = mensaje.body?.trim();
  if (mime.startsWith('image/')) return `📷 ${pie || 'Foto'}`;
  if (mime.startsWith('video/')) return `🎬 ${pie || 'Video'}`;
  if (mime.startsWith('audio/')) return '🎤 Nota de voz';
  if (mensaje.media) return `📎 ${mensaje.media.fileName ?? pie ?? 'Archivo'}`;
  return pie || 'Mensaje';
}

/** Suma el `seq` si no estaba y lo saca si estaba (la estrella es un interruptor). */
export function alternarDestacado(seqs: readonly number[], seq: number): number[] {
  return seqs.includes(seq) ? seqs.filter((uno) => uno !== seq) : [...seqs, seq];
}

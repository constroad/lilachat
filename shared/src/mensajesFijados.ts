/**
 * Mensajes fijados en un chat (19/10, pedido de José: «hacer pin a mensajes»),
 * como WhatsApp: por 24 horas, 7 días o 30 días, hasta 3 por chat (el cuarto
 * saca al fijado hace más tiempo). En un 1:1 o un borrador fija cualquiera; en
 * un grupo, los admins (como los recordatorios del grupo). PURO: lo usan el
 * server, la app y la web.
 */
export const DURACIONES_DE_FIJADO = { '24h': 24, '7d': 7 * 24, '30d': 30 * 24 } as const;
export type DuracionDeFijado = keyof typeof DURACIONES_DE_FIJADO;
export const MAXIMO_DE_FIJADOS = 3;
const HORA_MS = 3_600_000;

/** Un fijado: qué mensaje, quién, cuándo y hasta cuándo (ISO). */
export type MensajeFijado = { seq: number; por: string; en: string; hasta: string };

export const ETIQUETAS_DE_DURACION: Record<DuracionDeFijado, string> = { '24h': '24 horas', '7d': '7 días', '30d': '30 días' };

/** Hasta cuándo queda fijado; `null` si la duración no es una de las tres. */
export function venceDelFijado(duracion: string, ahora: number): string | null {
  const horas = DURACIONES_DE_FIJADO[duracion as DuracionDeFijado];
  return horas ? new Date(ahora + horas * HORA_MS).toISOString() : null;
}

/** Los vigentes, el fijado más reciente primero. */
export function fijadosVigentes<T extends MensajeFijado>(fijados: readonly T[] | undefined, ahora: number): T[] {
  return (fijados ?? []).filter((uno) => Date.parse(uno.hasta) > ahora).sort((a, b) => Date.parse(b.en) - Date.parse(a.en));
}

/** Suma (o renueva) un fijado, sin vencidos y con el tope de 3. */
export function agregarFijado<T extends MensajeFijado>(fijados: readonly T[] | undefined, nuevo: T, ahora: number): T[] {
  const otros = fijadosVigentes(fijados, ahora).filter((uno) => uno.seq !== nuevo.seq);
  return [nuevo, ...otros].slice(0, MAXIMO_DE_FIJADOS);
}

export function puedeFijarEnElChat(params: { kind: 'direct' | 'group' | 'notas'; esAdmin: boolean }): boolean {
  return params.kind !== 'group' || params.esAdmin;
}

/** Lo que la lista manda de un fijado para dibujar la franja (sin texto en un chat secreto). */
export type VistaDelFijado = { senderId: string; kind: string; body?: string; mime?: string };

/**
 * Qué dice la franja del fijado: el texto en una línea; en un chat secreto el
 * server no lo tiene y se usa el que el dispositivo descifró; un adjunto sin
 * pie dice qué es.
 */
export function textoDelFijado(vista: VistaDelFijado, textoLocal?: string): string {
  const texto = (vista.body ?? textoLocal ?? '').replace(/\s+/g, ' ').trim();
  if (texto) return texto;
  const mime = vista.mime ?? '';
  if (vista.kind === 'voice' || (mime.startsWith('audio/') && vista.kind !== 'file')) return 'Nota de voz';
  if (mime.startsWith('image/')) return 'Foto';
  if (mime.startsWith('video/')) return 'Video';
  if (vista.kind === 'file' || mime) return 'Archivo';
  return 'Mensaje';
}

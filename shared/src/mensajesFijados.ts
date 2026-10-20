/**
 * Mensajes fijados en un chat (19/10, pedido de José: «hacer pin a mensajes»).
 * Empezó como WhatsApp (3, con plazo); el 20/10 José pidió los de Slack:
 * varios por chat (hasta 50; el siguiente saca al fijado hace más tiempo),
 * con lista «Ver todos» y la opción «sin vencimiento». En un 1:1 o un
 * borrador fija cualquiera; en un grupo, los admins. PURO: lo usan el server,
 * la app y la web.
 */
const SIN_VENCIMIENTO_HORAS = 100 * 365 * 24;
export const DURACIONES_DE_FIJADO = { '24h': 24, '7d': 7 * 24, '30d': 30 * 24, siempre: SIN_VENCIMIENTO_HORAS } as const;
export type DuracionDeFijado = keyof typeof DURACIONES_DE_FIJADO;
export const MAXIMO_DE_FIJADOS = 50;
const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
/** Más allá de esto, el plazo es «sin vencimiento» (el guardado es a 100 años). */
const UMBRAL_SIN_VENCIMIENTO_MS = 10 * 365 * DIA_MS;

/** Un fijado: qué mensaje, quién, cuándo y hasta cuándo (ISO). */
export type MensajeFijado = { seq: number; por: string; en: string; hasta: string };

export const ETIQUETAS_DE_DURACION: Record<DuracionDeFijado, string> = { '24h': '24 horas', '7d': '7 días', '30d': '30 días', siempre: 'Sin vencimiento' };

export function esSinVencimiento(hasta: string, ahora: number): boolean {
  return Date.parse(hasta) - ahora > UMBRAL_SIN_VENCIMIENTO_MS;
}

/** «sin vencimiento», «vence en 6 días», «vence en 5 h»: lo que queda, para la lista de fijados. */
export function textoDelVencimiento(hasta: string, ahora: number): string {
  if (esSinVencimiento(hasta, ahora)) return 'sin vencimiento';
  const queda = Date.parse(hasta) - ahora;
  // Redondeado: recién fijado por 7 días dice «7 días», no «6».
  if (queda >= DIA_MS) {
    const dias = Math.round(queda / DIA_MS);
    return `vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
  const horas = Math.round(queda / HORA_MS);
  return horas >= 1 ? `vence en ${horas} h` : 'vence en menos de 1 h';
}

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
  if (vista.kind === 'sticker') return 'Sticker';
  const mime = vista.mime ?? '';
  if (vista.kind === 'voice' || (mime.startsWith('audio/') && vista.kind !== 'file')) return 'Nota de voz';
  if (mime.startsWith('image/')) return 'Foto';
  if (mime.startsWith('video/')) return 'Video';
  if (vista.kind === 'file' || mime) return 'Archivo';
  return 'Mensaje';
}

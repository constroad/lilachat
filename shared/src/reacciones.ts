/**
 * Reacciones a un mensaje (José, 20/10: «que tanto los chats como los hilos
 * podamos reaccionar»). Como WhatsApp: UNA por persona —otra la reemplaza, la
 * misma la quita—, barra de seis y «+» para el resto. PURO: lo usan el server,
 * la app y la web.
 */
import { actsAsMessage } from './avisoDeGrupo.js';

export const EMOJIS_RAPIDOS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

/** Un emoji de reacción no pasa de esto (los compuestos, como una familia, son largos). */
const LARGO_MAXIMO = 32;
/** UN emoji: bandera (dos regionales) o pictograma con variante/tono, unidos por ZWJ (familias). Sin `Intl.Segmenter`: Hermes no lo tiene. */
const UN_EMOJI = /^(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}[\uFE0F\p{Emoji_Modifier}]?(?:\u200D\p{Extended_Pictographic}[\uFE0F\p{Emoji_Modifier}]?)*)$/u;

export type Reaccion = { userId: string; emoji: string; en?: string };

/** Un solo emoji (un grafema que es pictográfico). Lo que no, el server lo rechaza. */
export function esEmojiDeReaccion(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= LARGO_MAXIMO && UN_EMOJI.test(valor);
}

/** La lista después de reaccionar (`emoji`) o de quitar la mía (`null`). No muta. */
export function aplicarReaccion<T extends Reaccion>(reacciones: readonly T[] | undefined, userId: string, emoji: string | null, en: string): Reaccion[] {
  const otras: Reaccion[] = (reacciones ?? []).filter((una) => una.userId !== userId);
  return emoji ? [...otras, { userId, emoji, en }] : otras;
}

export type GrupoDeReaccion = { emoji: string; cuantos: number; mia: boolean; quienes: string[] };

/** Las pastillas: por emoji, el más usado primero y, si empatan, el que llegó antes. */
export function resumenDeReacciones(reacciones: readonly Reaccion[] | undefined, yo: string): GrupoDeReaccion[] {
  const grupos = new Map<string, GrupoDeReaccion>();
  for (const una of reacciones ?? []) {
    const grupo = grupos.get(una.emoji) ?? { emoji: una.emoji, cuantos: 0, mia: false, quienes: [] };
    grupo.cuantos += 1;
    grupo.mia ||= una.userId === yo;
    grupo.quienes.push(una.userId);
    grupos.set(una.emoji, grupo);
  }
  // `sort` es estable: el empate conserva el orden de llegada del Map.
  return [...grupos.values()].sort((a, b) => b.cuantos - a.cuantos);
}

export function miReaccion(reacciones: readonly Reaccion[] | undefined, yo: string): string | null {
  return reacciones?.find((una) => una.userId === yo)?.emoji ?? null;
}

/** A qué se reacciona: confirmado, vivo, no un aviso y fuera de un chat secreto (todavía). */
export function puedeReaccionar(mensaje: { seq: number | null; deletedAt?: string | null; kind?: string; system?: { evento?: string } | null; cifrado?: boolean }): boolean {
  return mensaje.seq !== null && !mensaje.deletedAt && actsAsMessage(mensaje) && !mensaje.cifrado;
}

const LARGO_DEL_EXTRACTO = 40;

/** El cuerpo de la notificación que le llega al autor del mensaje. */
export function textoDelAvisoDeReaccion(emoji: string, cuerpo: string | undefined): string {
  const texto = (cuerpo ?? '').replace(/\s+/g, ' ').trim();
  if (!texto) return `Reaccionó ${emoji} a tu mensaje`;
  const extracto = texto.length > LARGO_DEL_EXTRACTO ? `${texto.slice(0, LARGO_DEL_EXTRACTO)}…` : texto;
  return `Reaccionó ${emoji} a «${extracto}»`;
}

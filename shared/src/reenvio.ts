import { compareOrdinal } from './compareText.js';
/**
 * Elegir a quién reenviar, como WhatsApp (José, 20/10: «la pantalla de
 * reenviar no muestra los frecuentes ni los recientes»). Frecuentes = a donde
 * más mando, con lo viejo pesando menos; recientes = el resto por última
 * actividad; buscando, una sola lista. Hasta 5 destinos. Los chats secretos
 * no aparecen: el texto tendría que salir cifrado con la clave de cada uno.
 * PURO: lo usan la app y la web.
 */
export const MAXIMO_DE_DESTINOS = 5;
const FRECUENTES = 3;
/** A la semana, un envío vale la mitad. */
const VIDA_MEDIA_MS = 7 * 24 * 3_600_000;

export type Frecuencias = Record<string, { puntaje: number; en: number }>;
export type ChatParaReenviar = {
  id: string;
  nombre: string;
  subtitulo?: string;
  esGrupo?: boolean;
  esBorrador?: boolean;
  propio?: boolean;
  cifrado?: boolean;
  /** La última actividad del chat (ISO). */
  ultimoEn?: string;
  avatarUrl?: string;
};

const puntajeA = (registro: { puntaje: number; en: number } | undefined, ahora: number): number =>
  registro ? registro.puntaje * 0.5 ** (Math.max(0, ahora - registro.en) / VIDA_MEDIA_MS) : 0;

/** Anotar un envío a ese chat. No muta. */
export function sumarEnvio(frecuencias: Frecuencias, chatId: string, ahora: number): Frecuencias {
  return { ...frecuencias, [chatId]: { puntaje: puntajeA(frecuencias[chatId], ahora) + 1, en: ahora } };
}

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const porReciente = (a: ChatParaReenviar, b: ChatParaReenviar) => compareOrdinal(b.ultimoEn ?? '', a.ultimoEn ?? '');

export function destinosDeReenvio(params: { chats: readonly ChatParaReenviar[]; frecuencias: Frecuencias; busqueda: string; ahora: number }): { frecuentes: ChatParaReenviar[]; recientes: ChatParaReenviar[] } {
  const posibles = params.chats.filter((chat) => !chat.cifrado);
  const aguja = sinTildes(params.busqueda.trim());
  if (aguja) return { frecuentes: [], recientes: posibles.filter((chat) => sinTildes(chat.nombre).includes(aguja)).sort(porReciente) };
  const frecuentes = posibles
    .map((chat) => ({ chat, puntaje: puntajeA(params.frecuencias[chat.id], params.ahora) }))
    .filter((uno) => uno.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, FRECUENTES)
    .map((uno) => uno.chat);
  const yaEstan = new Set(frecuentes.map((chat) => chat.id));
  return { frecuentes, recientes: posibles.filter((chat) => !yaEstan.has(chat.id)).sort(porReciente) };
}

/** Elegir o soltar un destino; con 5 ya elegidos, el siguiente no entra. */
export function alternarDestino(elegidos: readonly string[], id: string): { elegidos: string[]; lleno: boolean } {
  if (elegidos.includes(id)) return { elegidos: elegidos.filter((uno) => uno !== id), lleno: false };
  if (elegidos.length >= MAXIMO_DE_DESTINOS) return { elegidos: [...elegidos], lleno: true };
  return { elegidos: [...elegidos, id], lleno: false };
}

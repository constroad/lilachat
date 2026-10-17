import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * El borrador de cada chat (FL9; auditoría §46.2): lo escrito y no mandado
 * vuelve al abrir el chat, y la lista lo muestra como «Borrador: …», como
 * WhatsApp. En el disco del teléfono, una clave por chat.
 */
const PREFIJO = 'lilachat.borrador.';

let borradores: ReadonlyMap<string, string> = new Map();
let cargados = false;
const oyentes = new Set<(mapa: ReadonlyMap<string, string>) => void>();

/** Puro: el mapa con el borrador de un chat (vacío = sin borrador). */
export function conBorrador(mapa: ReadonlyMap<string, string>, chatId: string, texto: string): Map<string, string> {
  const nuevo = new Map(mapa);
  if (texto.trim()) nuevo.set(chatId, texto);
  else nuevo.delete(chatId);
  return nuevo;
}

async function cargar(): Promise<void> {
  if (cargados) return;
  cargados = true;
  try {
    const claves = (await AsyncStorage.getAllKeys()).filter((clave) => clave.startsWith(PREFIJO));
    const pares = await AsyncStorage.multiGet(claves);
    borradores = new Map(pares.filter(([, texto]) => Boolean(texto)).map(([clave, texto]) => [clave.slice(PREFIJO.length), texto ?? '']));
    oyentes.forEach((oyente) => oyente(borradores));
  } catch {
    // Sin disco no hay borradores: se escribe igual.
  }
}

export async function leerBorrador(chatId: string): Promise<string> {
  await cargar();
  return borradores.get(chatId) ?? '';
}

export function guardarBorrador(chatId: string, texto: string): void {
  if ((borradores.get(chatId) ?? '') === (texto.trim() ? texto : '')) return;
  borradores = conBorrador(borradores, chatId, texto);
  oyentes.forEach((oyente) => oyente(borradores));
  const clave = `${PREFIJO}${chatId}`;
  void (texto.trim() ? AsyncStorage.setItem(clave, texto) : AsyncStorage.removeItem(clave)).catch(() => undefined);
}

/** Para la lista: los borradores de todos los chats, al día. */
export function useBorradores(): ReadonlyMap<string, string> {
  const [mapa, setMapa] = useState(borradores);
  useEffect(() => {
    oyentes.add(setMapa);
    void cargar().then(() => setMapa(borradores));
    return () => {
      oyentes.delete(setMapa);
    };
  }, []);
  return mapa;
}

/** Al cerrar sesión: los borradores eran de quien se fue. */
export async function olvidarBorradores(): Promise<void> {
  borradores = new Map();
  oyentes.forEach((oyente) => oyente(borradores));
  try {
    // Del disco, no del mapa: puede no haberse cargado nunca en esta sesión.
    const claves = (await AsyncStorage.getAllKeys()).filter((clave) => clave.startsWith(PREFIJO));
    await AsyncStorage.multiRemove(claves);
  } catch {
    // Sin disco no quedó nada escrito que borrar.
  }
}

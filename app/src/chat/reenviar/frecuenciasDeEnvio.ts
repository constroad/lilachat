import AsyncStorage from '@react-native-async-storage/async-storage';
import { sumarEnvio, type Frecuencias } from '@lilachat/shared';

/**
 * A dónde mando más (20/10): de acá salen los «Chats frecuentes» al reenviar.
 * Vive en el teléfono —es un orden, no un dato secreto— y se anota en cada
 * envío (`queueMessage`). Lo viejo pesa menos (`sumarEnvio`).
 */
const CLAVE = 'lilachat.frecuencias-de-envio';
let enMemoria: Frecuencias | null = null;

export async function leerFrecuencias(): Promise<Frecuencias> {
  if (enMemoria) return enMemoria;
  try {
    enMemoria = JSON.parse((await AsyncStorage.getItem(CLAVE)) ?? '{}') as Frecuencias;
  } catch {
    enMemoria = {};
  }
  return enMemoria;
}

export async function anotarEnvio(chatId: string): Promise<void> {
  enMemoria = sumarEnvio(await leerFrecuencias(), chatId, Date.now());
  // Un orden que no se guarda se rehace con los próximos envíos: no vale un error.
  await AsyncStorage.setItem(CLAVE, JSON.stringify(enMemoria)).catch(() => undefined);
}

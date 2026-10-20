import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hasta qué respuesta vi cada hilo (E3, 20/10), por chat y en este teléfono:
 * el chip marca «nuevas» si la última respuesta es posterior. No es un dato
 * del server: leer un hilo en la web no lo apaga acá (como los borradores).
 */
const CLAVE = 'lilachat-hilos-vistos';
let vistos: Record<string, Record<string, number>> | null = null;
const oyentes = new Set<() => void>();

async function cargar(): Promise<Record<string, Record<string, number>>> {
  if (vistos) return vistos;
  try {
    vistos = JSON.parse((await AsyncStorage.getItem(CLAVE)) ?? '{}') as Record<string, Record<string, number>>;
  } catch {
    vistos = {};
  }
  return vistos;
}

export function vistoHasta(chatId: string, raiz: number): number | undefined {
  return vistos?.[chatId]?.[String(raiz)];
}

/** Al abrir el hilo: visto hasta su última respuesta (nunca retrocede). */
export async function marcarHiloVisto(chatId: string, raiz: number, hasta: number): Promise<void> {
  const todos = await cargar();
  const delChat = todos[chatId] ?? {};
  if ((delChat[String(raiz)] ?? 0) >= hasta) return;
  todos[chatId] = { ...delChat, [String(raiz)]: hasta };
  oyentes.forEach((oyente) => oyente());
  await AsyncStorage.setItem(CLAVE, JSON.stringify(todos)).catch(() => undefined);
}

export function suscribirHilosVistos(oyente: () => void): () => void {
  oyentes.add(oyente);
  void cargar().then(oyente);
  return () => void oyentes.delete(oyente);
}

/** Al cerrar sesión: lo visto es de quien se fue. */
export async function olvidarHilosVistos(): Promise<void> {
  vistos = {};
  await AsyncStorage.removeItem(CLAVE).catch(() => undefined);
}

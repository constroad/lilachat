import type { ResumenDeHiloEnCliente, ThreadSummaryOfRoot } from '@lilachat/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Up to which reply I saw each thread (E3, 20/10), per chat: the chip shows
 * new replies when the last one is later. Since 16/11 the server keeps it too
 * (`visto` in `GET /hilos`), so a thread read on the web is read here.
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

/** The thread summaries of each chat, all of them (the root may be older than the loaded messages). */
const summaries = new Map<string, Map<number, ResumenDeHiloEnCliente>>();

export function rememberThreadSummary(chatId: string, root: number, summary: ResumenDeHiloEnCliente): void {
  const ofChat = summaries.get(chatId) ?? new Map<number, ResumenDeHiloEnCliente>();
  ofChat.set(root, summary);
  summaries.set(chatId, ofChat);
  oyentes.forEach((oyente) => oyente());
}

export function threadSummariesOf(chatId: string): ThreadSummaryOfRoot[] {
  return [...(summaries.get(chatId)?.entries() ?? [])].map(([root, summary]) => ({ root, summary }));
}

export function suscribirHilosVistos(oyente: () => void): () => void {
  oyentes.add(oyente);
  void cargar().then(oyente);
  return () => void oyentes.delete(oyente);
}

/** Al cerrar sesión: lo visto es de quien se fue. */
export async function olvidarHilosVistos(): Promise<void> {
  vistos = {};
  summaries.clear();
  await AsyncStorage.removeItem(CLAVE).catch(() => undefined);
}

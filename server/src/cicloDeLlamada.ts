import { Types } from 'mongoose';
import { CALL_TIMEOUT_MS, cuerpoDeLlamada, valorDeLlamada } from '@lilachat/shared';
import type { Message } from './chatModels.js';
import { chatMemberIds, datosDeUsuario, escribirAviso } from './chatService.js';
import {
  guardarOferta,
  inicioDeOferta,
  marcarContestada,
  sigueSonando,
  terminarLlamada,
  verificarRechazo,
  type FinDeLlamada,
} from './llamadas.js';

/**
 * El ciclo de una llamada en el server (FL8.1).
 *
 * `llamadas.ts` guarda el estado; acá se decide qué pasa en cada paso:
 * - **Suena**: se guarda la oferta, se avisa a los desconectados y se programa
 *   el vencimiento del timbre.
 * - **La contestan**: deja de sonar y se apagan los teléfonos que la tenían a
 *   pantalla completa (el que contestó en uno puede tener otro sonando).
 * - **Termina** (colgar, rechazar o vencer): se apagan los teléfonos y queda la
 *   línea en el chat —«Llamada perdida» con push, o la duración sin push— UNA
 *   sola vez aunque cuelguen los dos.
 *
 * Las salidas (socket, push) se inyectan: `socket.ts` las cablea y los tests
 * las reemplazan, sin import circular con el socket.
 */
type Miembros = { chatId: string; from: string; members: string[] };

export type DependenciasDelCiclo = {
  emitirA: (userId: string, evento: string, frame: object) => void;
  /** Con push a los desconectados (la llamada perdida). */
  publicar: (mensaje: Message, members: string[]) => Promise<unknown>;
  /** Solo por socket (la contestada: los dos estaban ahí). */
  avisarSinPush: (mensaje: Message, members: string[]) => Promise<unknown>;
  avisarFin: (params: Miembros) => Promise<void>;
  avisarLlamada: (params: Miembros & { video: boolean }) => Promise<void>;
  ahora?: () => number;
  programar?: (tarea: () => void, ms: number) => void;
};

/** Margen sobre el timbre: que el teléfono que llama corte primero. */
const MARGEN_DE_VENCIMIENTO_MS = 1_500;

let deps: DependenciasDelCiclo | null = null;

export function configurarCiclo(dependencias: DependenciasDelCiclo): void {
  deps = dependencias;
}

const ahora = () => deps?.ahora?.() ?? Date.now();

function programar(tarea: () => void, ms: number): void {
  if (deps?.programar) return deps.programar(tarea, ms);
  setTimeout(tarea, ms).unref();
}

export function alOfrecer(params: Miembros & { video: boolean; frame: object }): void {
  if (!deps) return;
  const desde = ahora();
  guardarOferta(params.chatId, params.frame, params.from, desde, { video: params.video, members: params.members });
  void deps.avisarLlamada(params).catch((error) => reportar('avisar la llamada', error));
  // Venció sin que nadie contestara ni colgara (el que llama cerró la app, se
  // quedó sin red): la llamada igual se cierra y queda como perdida.
  programar(() => {
    if (inicioDeOferta(params.chatId) !== desde) return;
    if (sigueSonando(params.chatId, desde, desde)) void alTerminar(params.chatId);
  }, CALL_TIMEOUT_MS + MARGEN_DE_VENCIMIENTO_MS);
}

export async function alContestar(chatId: string): Promise<void> {
  if (!deps) return;
  const miembros = marcarContestada(chatId, ahora());
  if (!miembros) return;
  await deps.avisarFin({ chatId, ...miembros }).catch((error) => reportar('apagar los timbres', error));
}

export async function alTerminar(chatId: string): Promise<void> {
  if (!deps) return;
  const fin = terminarLlamada(chatId, ahora());
  if (!fin) return;
  await Promise.all([
    deps.avisarFin({ chatId, from: fin.from, members: fin.members }).catch((error) => reportar('apagar los timbres', error)),
    escribirLinea(chatId, fin).catch((error) => reportar('escribir la línea', error)),
  ]);
}

/**
 * «Rechazar» tocado en la notificación con la app cerrada: el token dice
 * quién y qué chat. Se le corta a quien llama como si el teléfono hubiera
 * mandado `call.end`.
 */
export async function rechazarDesdeAviso(token: string): Promise<boolean> {
  if (!deps) return false;
  const rechazo = verificarRechazo(token);
  if (!rechazo || !Types.ObjectId.isValid(rechazo.chatId)) return false;
  const members = await chatMemberIds(new Types.ObjectId(rechazo.chatId));
  if (!members.includes(rechazo.userId)) return false;
  for (const member of members) {
    if (member === rechazo.userId) continue;
    deps.emitirA(member, 'call.end', { chatId: rechazo.chatId, motivo: 'rechazada', from: rechazo.userId });
  }
  await alTerminar(rechazo.chatId);
  return true;
}

async function escribirLinea(chatId: string, fin: FinDeLlamada): Promise<void> {
  if (!deps) return;
  const quien = await datosDeUsuario(fin.from);
  const valor = valorDeLlamada({ video: fin.video, segundos: fin.segundos });
  const mensaje = await escribirAviso({
    chatId,
    quien: new Types.ObjectId(fin.from),
    evento: 'llamada',
    valor,
    body: cuerpoDeLlamada({ valor, quien: quien.visible }),
    quien2: { phone: quien.phone, name: quien.name },
  });
  // En un chat secreto `escribirAviso` no escribe: no hay nada que publicar.
  if (!mensaje) return;
  await (fin.segundos === null ? deps.publicar(mensaje, fin.members) : deps.avisarSinPush(mensaje, fin.members));
}

function reportar(accion: string, error: unknown): void {
  console.error(`[llamada] no se pudo ${accion}:`, error instanceof Error ? error.message : error);
}

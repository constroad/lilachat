import { CALL_CONNECT_TIMEOUT_MS, CALL_TIMEOUT_MS } from '@lilachat/shared';
import jwt from 'jsonwebtoken';
import { UserModel } from './models.js';
import { resolveJwtSecret } from './sessions.js';

/**
 * Las ofertas de llamada que todavía están SONANDO (FL8).
 *
 * El server reenviaba `call.offer` a los sockets conectados en ese instante y
 * nada más: quien tenía la app en la lista, en otro chat o cerrada no se
 * enteraba (la escucha vivía en la pantalla del chat, y el socket pausado no
 * recibe nada). Ahora la oferta se guarda mientras suena (`CALL_TIMEOUT_MS`):
 * quien conecta en ese tiempo —por ejemplo, al tocar el push «Llamada de…»—
 * la recibe y puede contestar.
 *
 * En memoria a propósito: dura 30 s, y si el server se reinicia la llamada
 * muere igual (el socket del que llama también).
 */
type DatosDeOferta = { video: boolean; members: string[] };
type Pendiente = DatosDeOferta & { frame: object; from: string; at: number; candidatos: object[] };
/** Contestada y en curso (FL8.1): de acá sale la duración al terminar. */
type EnCurso = DatosDeOferta & { from: string; contestadaEn: number };
/** Cómo terminó: `segundos: null` es que nadie contestó. */
export type FinDeLlamada = DatosDeOferta & { from: string; segundos: number | null };

const pendientes = new Map<string, Pendiente>();
/** Una oferta junta unos pocos candidatos (host, srflx, relay por interfaz); más es ruido. */
const MAX_CANDIDATOS_POR_OFERTA = 40;
const enCurso = new Map<string, EnCurso>();
/**
 * The callee tapped «Contestar» and its answer is on the way (backlog 114): by
 * chat, with the offer it belongs to (`offerAt`), so a new offer never inherits it.
 */
const answering = new Map<string, { offerAt: number; since: number }>();

export function guardarOferta(
  chatId: string,
  frame: object,
  from: string,
  ahora: number = Date.now(),
  datos: DatosDeOferta = { video: false, members: [] }
): void {
  pendientes.set(chatId, { ...datos, frame, from, at: ahora, candidatos: [] });
}

/**
 * Un candidato ICE de quien llama, guardado con su oferta (FL11). El que
 * conecta tarde —contestando desde la notificación— recibe la oferta Y sus
 * candidatos: antes le llegaba solo la oferta y quedaba en «Conectando…».
 * Los del otro lado no se guardan: quien llama tiene la app abierta y le
 * llegan en vivo.
 */
export function guardarCandidato(chatId: string, frame: object, from: string): void {
  const pendiente = pendientes.get(chatId);
  if (!pendiente || pendiente.from !== from || pendiente.candidatos.length >= MAX_CANDIDATOS_POR_OFERTA) return;
  pendiente.candidatos.push(frame);
}

/** Los candidatos de la oferta que sigue sonando en ese chat, en el orden en que llegaron. */
export function candidatosDeLaOferta(chatId: string): object[] {
  return [...(pendientes.get(chatId)?.candidatos ?? [])];
}

const answeringSince = (chatId: string, offer: Pendiente): number | undefined => {
  const mark = answering.get(chatId);
  return mark?.offerAt === offer.at ? mark.since : undefined;
};

/** When an unanswered offer gives up: the 30 s ring, or the connect window once answering. */
function deadlineOf(chatId: string, offer: Pendiente): number {
  const since = answeringSince(chatId, offer);
  return since === undefined ? offer.at + CALL_TIMEOUT_MS : since + CALL_CONNECT_TIMEOUT_MS;
}

/** ¿Sigue sonando esta oferta? (la que se guardó en `desde`, si se pasa). */
export function sigueSonando(chatId: string, ahora: number = Date.now(), desde?: number): boolean {
  const pendiente = pendientes.get(chatId);
  if (!pendiente || (desde !== undefined && pendiente.at !== desde)) return false;
  return ahora <= deadlineOf(chatId, pendiente);
}

/** The deadline of the offer ringing in that chat, or `null` if none rings. */
export function offerDeadline(chatId: string): number | null {
  const offer = pendientes.get(chatId);
  return offer ? deadlineOf(chatId, offer) : null;
}

/**
 * The callee said «answering» (backlog 114): the ring stops counting and the
 * offer waits for its answer. Only someone it rings for, once; returns who the
 * call is between, or `null` when there is nothing to mark.
 */
export function markAnswering(chatId: string, userId: string, ahora: number = Date.now()): { from: string; members: string[] } | null {
  const offer = pendientes.get(chatId);
  if (!offer || answeringSince(chatId, offer) !== undefined || ahora > deadlineOf(chatId, offer)) return null;
  if (userId === offer.from || !offer.members.includes(userId)) return null;
  answering.set(chatId, { offerAt: offer.at, since: ahora });
  return { from: offer.from, members: offer.members };
}

/** Cuándo empezó a sonar la oferta vigente de ese chat. */
export function inicioDeOferta(chatId: string): number | null {
  return pendientes.get(chatId)?.at ?? null;
}

/** La contestaron: deja de sonar y empieza a contar. Devuelve quiénes eran. */
export function marcarContestada(chatId: string, ahora: number = Date.now()): { from: string; members: string[] } | null {
  const pendiente = pendientes.get(chatId);
  if (!pendiente) return null;
  pendientes.delete(chatId);
  answering.delete(chatId);
  enCurso.set(chatId, { video: pendiente.video, members: pendiente.members, from: pendiente.from, contestadaEn: ahora });
  return { from: pendiente.from, members: pendiente.members };
}

/**
 * Terminó (colgaron, rechazaron o venció el timbre). Devuelve cómo, UNA sola
 * vez: los dos teléfonos mandan `call.end` y la línea del chat no se duplica.
 */
export function terminarLlamada(chatId: string, ahora: number = Date.now()): FinDeLlamada | null {
  const activa = enCurso.get(chatId);
  if (activa) {
    enCurso.delete(chatId);
    return { video: activa.video, members: activa.members, from: activa.from, segundos: Math.max(0, Math.floor((ahora - activa.contestadaEn) / 1000)) };
  }
  const pendiente = pendientes.get(chatId);
  if (!pendiente) return null;
  pendientes.delete(chatId);
  answering.delete(chatId);
  return { video: pendiente.video, members: pendiente.members, from: pendiente.from, segundos: null };
}

/** Contestar, colgar, rechazar o «ocupado»: deja de sonar. */
export function limpiarOferta(chatId: string): void {
  pendientes.delete(chatId);
  answering.delete(chatId);
}

/** Las que siguen sonando en mis chats, sin las que hice yo. */
export function ofertasVigentes(chatIds: readonly string[], userId: string, ahora: number = Date.now()): object[] {
  const vigentes: object[] = [];
  for (const chatId of chatIds) {
    const pendiente = pendientes.get(chatId);
    if (!pendiente) continue;
    if (ahora > deadlineOf(chatId, pendiente)) {
      pendientes.delete(chatId);
  answering.delete(chatId);
      continue;
    }
    if (pendiente.from !== userId) vigentes.push({ ...pendiente.frame, quedaMs: deadlineOf(chatId, pendiente) - ahora });
  }
  return vigentes;
}

/** ¿Hay alguna sonando? Evita una consulta por conexión cuando no hay ninguna. */
export function hayOfertasPendientes(): boolean {
  return pendientes.size > 0;
}

/**
 * La señal tal como se reenvía: con su autor y, en la OFERTA, con su nombre y
 * teléfono. La app arma el nombre de quien llama con el chat que tiene
 * cargado, y al abrir desde el push «Llamada de…» (o con un chat recién
 * creado) todavía no lo tiene: la pantalla decía «Llamada» en vez de la
 * persona (prueba real del 17/10/2026). Las otras señales no consultan la base.
 */
export async function frameConAutor(evento: string, payload: object, userId: string): Promise<object> {
  const frame = { ...payload, from: userId };
  if (evento !== 'call.offer') return frame;
  const autor = await UserModel.findById(userId).select('name phone').lean();
  return autor ? { ...frame, fromName: autor.name ?? null, fromPhone: autor.phone } : frame;
}

/**
 * El token para RECHAZAR desde la notificación (FL8.1). Con la app cerrada el
 * teléfono no tiene el JWT a mano (vive cifrado en el llavero de la app), así
 * que el push de la llamada trae uno corto que solo sirve para rechazar esa
 * llamada. Se firma con un secreto DERIVADO: firmado con el de las sesiones,
 * `verifySession` lo aceptaría como sesión.
 *
 * It also says «answering» from the lock screen (backlog 114): that only stops the ring.
 */
const AUDIENCIA_RECHAZO = 'rechazo-llamada';
const VIDA_DEL_RECHAZO_S = 90;
const secretoDeRechazo = () => `${resolveJwtSecret()}:${AUDIENCIA_RECHAZO}`;

export function firmarRechazo(params: { chatId: string; userId: string }, vidaSegundos: number = VIDA_DEL_RECHAZO_S): string {
  return jwt.sign({ c: params.chatId, u: params.userId }, secretoDeRechazo(), {
    audience: AUDIENCIA_RECHAZO,
    expiresIn: vidaSegundos,
  });
}

export function verificarRechazo(token: string): { chatId: string; userId: string } | null {
  try {
    const claims = jwt.verify(token, secretoDeRechazo(), { audience: AUDIENCIA_RECHAZO }) as { c?: unknown; u?: unknown };
    return typeof claims.c === 'string' && typeof claims.u === 'string' ? { chatId: claims.c, userId: claims.u } : null;
  } catch {
    return null;
  }
}

/** Solo para tests. */
export function __reiniciarLlamadas(): void {
  pendientes.clear();
  enCurso.clear();
  answering.clear();
}

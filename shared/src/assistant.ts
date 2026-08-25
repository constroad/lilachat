/**
 * Las decisiones del asistente (F8).
 *
 * **Stitch no diseñó ninguna pantalla de IA** — el spec las lista como
 * pendientes de diseño (§4). Lo de acá es decisión propia, y se anota para que
 * nadie lo confunda con algo copiado de una captura.
 *
 * Todo lo que decide QUÉ se le manda al modelo vive en este módulo, con test y
 * sin red. El motivo no es de estilo: lo que se manda es **conversación privada
 * de una familia**, y el recorte, el tope y las exclusiones no pueden depender
 * de que un prompt esté bien redactado.
 */

/** El nombre por el que se lo llama, en UN solo lugar. */
export const ASSISTANT_NAME = 'lila';

/** Topes por defecto. Acotan el gasto y, sobre todo, cuánto se comparte. */
export const CONTEXT_LIMITS = { maxMessages: 40, maxChars: 8_000 } as const;

export type LilaMention = { request: string };

/**
 * ¿Están llamando a Lila?
 *
 * Sin mención NO se llama al modelo. Es la diferencia entre un asistente al que
 * se invoca y uno que lee todo lo que la familia escribe — y esa diferencia es
 * la razón por la que alguien aceptaría tenerlo en el chat.
 */
export function detectLilaMention(text: string): LilaMention | null {
  const match = new RegExp(`@${ASSISTANT_NAME}\\b`, 'i').exec(text ?? '');
  if (!match) return null;

  return { request: text.slice(match.index + match[0].length).trim() };
}

export type ContextMessage = { seq: number; body: string; from: string; kind: string };

/**
 * Qué mensajes viajan como contexto.
 *
 * Los **más recientes**, nunca los primeros: lo que se pregunta es siempre
 * sobre el final de la conversación. Y con dos topes, no uno — veinte mensajes
 * cortos y veinte párrafos largos no cuestan lo mismo, y lo que se factura (y
 * lo que se comparte) es el texto.
 */
export function selectContextMessages(
  messages: ContextMessage[],
  limits: { maxMessages: number; maxChars?: number }
): ContextMessage[] {
  // Solo texto: una foto no aporta al resumen y su URL sería un enlace al
  // storage viajando a un tercero sin ninguna utilidad.
  const soloTexto = messages.filter((message) => message.kind === 'text' && message.body?.trim());

  const recientes = soloTexto.slice(-limits.maxMessages);
  if (!limits.maxChars) return recientes;

  // Se recorta desde el PRINCIPIO: si hay que soltar algo, se suelta lo viejo.
  const elegidos: ContextMessage[] = [];
  let total = 0;
  for (let index = recientes.length - 1; index >= 0; index -= 1) {
    const message = recientes[index]!;
    if (total + message.body.length > limits.maxChars) break;
    total += message.body.length;
    elegidos.unshift(message);
  }
  return elegidos;
}

export type EventDraft = { title: string; startsAt: string; location?: string };

const MAX_TITLE = 120;
const MAX_LOCATION = 120;

/**
 * El borrador de evento que devuelve el modelo.
 *
 * **Se valida como si viniera de un cliente hostil.** Lo que llega es TEXTO: un
 * modelo puede alucinar campos, inventar una fecha imposible o devolver un
 * título de diez mil caracteres. Confiar en la salida de un modelo porque «se
 * le pidió JSON» es el mismo error que confiar en el `body` de un request.
 */
export function parseEventDraft(raw: string): EventDraft | null {
  // Los modelos envuelven el JSON en explicaciones o en un bloque de código.
  // Se busca el primer objeto balanceado en vez de exigir una salida limpia.
  const inicio = raw.indexOf('{');
  const fin = raw.lastIndexOf('}');
  if (inicio === -1 || fin <= inicio) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(inicio, fin + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const { title, startsAt, location } = parsed as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim()) return null;
  if (typeof startsAt !== 'string') return null;

  const fecha = new Date(startsAt);
  if (Number.isNaN(fecha.getTime())) return null;

  return {
    title: title.trim().slice(0, MAX_TITLE),
    startsAt,
    ...(typeof location === 'string' && location.trim()
      ? { location: location.trim().slice(0, MAX_LOCATION) }
      : {}),
  };
}

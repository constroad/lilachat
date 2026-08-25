/**
 * La cola de salida de mensajes. Motor PURO, compartido por app y web.
 *
 * Se encola **el hecho** («mandé este texto a este chat»), no la pantalla que
 * lo produjo. Las reglas salieron de colas ya probadas en producción
 * (asistencia, recepciones, evidencias de despacho) y ninguna es opcional:
 *
 * 1. **`clientKey` nace en el cliente** y sobrevive a todos los reintentos. Es
 *    lo que hace que reenviar el mismo mensaje no lo duplique.
 * 2. **Un duplicado del server es ÉXITO.** Que conteste «ya lo tenía» significa
 *    que el hecho está guardado — que es exactamente lo que se quería.
 * 3. **Anti-wedge**: un ítem que el server rechaza PARA SIEMPRE (400/403/404/
 *    410) se descarta con motivo visible. Si se quedara al frente reintentando,
 *    bloquearía todo lo que viene atrás — la cola entera muere por un mensaje.
 * 4. **401 vacía la cola**: la credencial ya no vale, y reintentar con ella no
 *    va a funcionar nunca.
 * 5. **Sin respuesta NO es rechazo**: se reintenta con espera creciente.
 */

export type OutboxItem = {
  /** Idempotencia: nace acá y no cambia jamás. */
  clientKey: string;
  chatId: string;
  kind: 'text' | 'image' | 'video' | 'file';
  body?: string;
  /**
   * El sobre cifrado, en los chats secretos (F9). **Excluyente con `body`**: la
   * cola vive en disco, así que guardar los dos dejaría el texto legible en el
   * teléfono aunque el server nunca lo vea.
   */
  envelope?: { v: 1; nonce: string; ciphertext: string };
  mediaId?: string;
  replyToSeq?: number;
  /** Reloj del cliente: sirve para ordenar lo pendiente en pantalla. */
  queuedAt: string;
  attempts: number;
};

export type SendOutcome =
  | { status: 'sent'; seq: number }
  /** El server ya lo tenía: mismo hecho, mismo `seq`. */
  | { status: 'duplicate'; seq: number }
  | { status: 'rejected'; httpStatus: number; message?: string }
  | { status: 'unauthorized' }
  | { status: 'unreachable' };

export type OutboxEffect =
  | { action: 'confirm'; clientKey: string; seq: number }
  | { action: 'discard'; clientKey: string; reason: string }
  | { action: 'retry'; clientKey: string; delayMs: number }
  | { action: 'clear-all'; reason: string };

/** Estados finales del server: reintentar no cambiaría nada. */
const PERMANENT_REJECTIONS = new Set([400, 403, 404, 410, 413, 422]);

/** Espera creciente, con techo: 1s, 2s, 4s… hasta 60s. */
export const RETRY_BASE_MS = 1_000;
export const RETRY_MAX_MS = 60_000;

export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(RETRY_BASE_MS * 2 ** exponent, RETRY_MAX_MS);
}

/**
 * Qué hacer con un ítem según lo que contestó el server. Es la función que
 * concentra TODAS las reglas de arriba; el resto del código solo la obedece.
 */
export function resolveOutcome(item: OutboxItem, outcome: SendOutcome): OutboxEffect {
  switch (outcome.status) {
    case 'sent':
    case 'duplicate':
      // Regla 2: el duplicado se confirma igual que un envío nuevo.
      return { action: 'confirm', clientKey: item.clientKey, seq: outcome.seq };
    case 'unauthorized':
      return { action: 'clear-all', reason: 'Tu acceso ya no está activo.' };
    case 'rejected':
      if (PERMANENT_REJECTIONS.has(outcome.httpStatus)) {
        return {
          action: 'discard',
          clientKey: item.clientKey,
          reason: outcome.message || 'El servidor rechazó este mensaje.',
        };
      }
      // 5xx y demás: el server está mal, no el mensaje.
      return { action: 'retry', clientKey: item.clientKey, delayMs: retryDelayMs(item.attempts) };
    case 'unreachable':
      return { action: 'retry', clientKey: item.clientKey, delayMs: retryDelayMs(item.attempts) };
  }
}

/** Aplica un efecto a la cola. Devuelve una cola NUEVA (no muta). */
export function applyEffect(queue: OutboxItem[], effect: OutboxEffect): OutboxItem[] {
  switch (effect.action) {
    case 'clear-all':
      return [];
    case 'confirm':
    case 'discard':
      return queue.filter((item) => item.clientKey !== effect.clientKey);
    case 'retry':
      return queue.map((item) =>
        item.clientKey === effect.clientKey ? { ...item, attempts: item.attempts + 1 } : item
      );
  }
}

/**
 * Encolar. Idempotente por `clientKey`: tocar «enviar» dos veces con el mismo
 * mensaje no lo encola dos veces.
 */
export function enqueue(queue: OutboxItem[], item: OutboxItem): OutboxItem[] {
  if (queue.some((queued) => queued.clientKey === item.clientKey)) return queue;
  return [...queue, item];
}

/** El siguiente a mandar: FIFO estricto — el orden del chat es el del autor. */
export function nextPending(queue: OutboxItem[]): OutboxItem | null {
  return queue[0] ?? null;
}

/**
 * Arma lo que se encola, cifrando ANTES si el chat es secreto.
 *
 * La cola se persiste en AsyncStorage —o sea, en DISCO—. En un chat con candado
 * el texto plano no puede quedar ahí: no serviría de nada contra quien tenga el
 * teléfono. Por eso el cifrado ocurre acá, al encolar, y no al enviar.
 *
 * Devuelve `null` cuando no hay nada que mandar o cuando el cifrado FALLA. Ese
 * segundo caso importa: caer a texto plano sería el peor error posible —el
 * usuario ve el candado y el mensaje sale desnudo—, así que se prefiere no
 * mandar y que la pantalla lo diga.
 */
export function buildOutboxItem(params: {
  chatId: string;
  clientKey: string;
  text: string;
  queuedAt: string;
  replyToSeq?: number;
  /** Solo en chats cifrados. `null` = no se pudo cifrar. */
  seal?: (text: string) => { v: 1; nonce: string; ciphertext: string } | null;
}): OutboxItem | null {
  const text = params.text.trim();
  if (!text) return null;

  const base = {
    clientKey: params.clientKey,
    chatId: params.chatId,
    kind: 'text' as const,
    queuedAt: params.queuedAt,
    attempts: 0,
    ...(params.replyToSeq !== undefined ? { replyToSeq: params.replyToSeq } : {}),
  };

  if (!params.seal) return { ...base, body: text };

  const envelope = params.seal(text);
  return envelope ? { ...base, envelope } : null;
}

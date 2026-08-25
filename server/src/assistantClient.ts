/**
 * El cliente de Claude (F8).
 *
 * **La clave vive SOLO en el server.** El teléfono nunca habla con Anthropic:
 * una key dentro de un APK es una key publicada, y el mismo principio ya se
 * aplicó con lila y con constroad-auth.
 *
 * Sin `ANTHROPIC_API_KEY` no se finge: se devuelve un fallo que DICE qué falta.
 * Un asistente que contesta «no pude» sin explicar por qué es exactamente el
 * modo de falla que costó una hora con el OTP de WhatsApp.
 */
/**
 * El host se puede apuntar a otro lado SOLO por variable de entorno.
 *
 * Existe para poder correr el E2E entero —rutas, socket, base, este mismo
 * cliente— contra un doble local cuando no hay clave. En producción la variable
 * no está y se usa el host real; no hay forma de que un cliente lo cambie.
 */
const API_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';
const MODEL = 'claude-opus-5';
const TIMEOUT_MS = 30_000;

export type AskOutcome =
  | { ok: true; text: string }
  | { ok: false; code: 'sin_configurar' | 'sin_respuesta' | 'rechazado'; message: string };

export interface AssistantClient {
  ask(params: {
    system: string;
    prompt: string;
    maxTokens?: number;
    /** `low` en lo casual: un resumen de chat no necesita razonar largo. */
    effort?: 'low' | 'medium' | 'high';
  }): Promise<AskOutcome>;
}

export function buildAssistantClient(): AssistantClient {
  return {
    async ask({ system, prompt, maxTokens = 700, effort = 'low' }) {
      const key = process.env.ANTHROPIC_API_KEY || '';
      if (!key) {
        return {
          ok: false,
          code: 'sin_configurar',
          message: 'Falta ANTHROPIC_API_KEY en el servidor.',
        };
      }

      try {
        const response = await fetch(`${API_BASE}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': API_VERSION,
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: maxTokens,
            system,
            thinking: { type: 'enabled', effort },
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) {
          const cuerpo = await response.text().catch(() => '');
          // El detalle al log, no al chat de la familia: puede traer la
          // organización, el modelo y parte del prompt.
          console.error(`[lila] Anthropic ${response.status}: ${cuerpo.slice(0, 200)}`);
          return { ok: false, code: 'rechazado', message: `El asistente no pudo responder.` };
        }

        const data = (await response.json()) as {
          content?: { type: string; text?: string }[];
        };
        const text = (data.content ?? [])
          .filter((bloque) => bloque.type === 'text')
          .map((bloque) => bloque.text ?? '')
          .join('')
          .trim();

        return text
          ? { ok: true, text }
          : { ok: false, code: 'rechazado', message: 'El asistente no devolvió nada.' };
      } catch (error) {
        console.error('[lila] sin respuesta:', error instanceof Error ? error.message : error);
        return { ok: false, code: 'sin_respuesta', message: 'El asistente no está disponible.' };
      }
    },
  };
}

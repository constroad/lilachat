import type { ModelAsker } from './agentesModel.js';

/**
 * Lila the assistant's transport (F8). Since 18/11 Lilachat holds no model key and names no provider (José): the
 * summary, the @lila answer and the event draft are tasks Lilachat asks agentes for (`agentesModel.ts`), and agentes
 * picks the model and its token cap. The phone never talks to a model either.
 *
 * Without a model on agentes' side nothing is faked: the failure says so, without exposing server configuration in
 * the chat (José, 22/10).
 */
export type AssistantTask = 'assistant.catch_up' | 'assistant.mention' | 'event.draft';

export type AskOutcome =
  | { ok: true; text: string }
  | { ok: false; code: 'sin_configurar' | 'sin_respuesta' | 'rechazado'; message: string };

export interface AssistantClient {
  ask(params: {
    task: AssistantTask;
    /** The chat's members: their space signs the ask to agentes and carries its usage. */
    memberIds: readonly string[];
    system: string;
    prompt: string;
  }): Promise<AskOutcome>;
}

/** Loaded on the first ask: `agentesModel` reaches the bots, which reach back into the chat services. */
const askAgentes: ModelAsker = async (memberIds, request) => (await import('./agentesModel.js')).askAgentesModel(memberIds, request);

export function buildAssistantClient(ask: ModelAsker = askAgentes): AssistantClient {
  return {
    async ask({ task, memberIds, system, prompt }) {
      const answer = await ask(memberIds, { task, system, input: prompt });
      if (!answer.ok) {
        return answer.reason === 'not_configured'
          ? { ok: false, code: 'sin_configurar', message: 'Lila no tiene un modelo configurado todavía.' }
          : { ok: false, code: 'rechazado', message: 'El asistente no pudo responder.' };
      }
      const text = answer.text.trim();
      return text ? { ok: true, text } : { ok: false, code: 'rechazado', message: 'El asistente no devolvió nada.' };
    },
  };
}

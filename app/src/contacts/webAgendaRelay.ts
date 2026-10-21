import { cleanPhonesRequest, namesFromAgenda } from '@lilachat/shared';
import { agendaPorTelefono, precargarAgenda } from './agendaEnMemoria';

type AgendaRequest = { requestId?: unknown; phones?: unknown } | undefined;
type Emitter = { emit: (event: 'agenda.respuesta', payload: { requestId: string; nombres: Record<string, string> }) => unknown };

/**
 * The linked web asks for the names of the numbers it shows (José, 20/10,
 * option «b», like WhatsApp Web). The phone answers from its address book and
 * the server only passes the answer along: nothing is stored there.
 *
 * It always answers, even with nothing (permission denied), so the server
 * forgets the request right away instead of waiting for it to expire.
 */
export async function answerAgendaRequest(socket: Emitter, request: AgendaRequest): Promise<void> {
  const requestId = typeof request?.requestId === 'string' ? request.requestId : '';
  const phones = cleanPhonesRequest(request?.phones);
  if (!requestId || phones.length === 0) return;
  await precargarAgenda();
  socket.emit('agenda.respuesta', { requestId, nombres: namesFromAgenda(phones, agendaPorTelefono()) });
}

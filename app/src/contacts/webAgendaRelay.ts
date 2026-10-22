import { cleanPhonesRequest, fullAgendaFrom, namesFromAgenda, type AgendaContact } from '@lilachat/shared';
import { agendaPorTelefono, precargarAgenda } from './agendaEnMemoria';

type AgendaRequest = { requestId?: unknown; phones?: unknown } | undefined;
type Emitter = { emit: (event: 'agenda.respuesta', payload: { requestId: string; nombres: Record<string, string> }) => unknown };
type FullEmitter = { emit: (event: 'agenda.respuestaTodo', payload: { requestId: string; contactos: AgendaContact[] }) => unknown };

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

/**
 * «Nuevo chat» on the linked web asks for the whole address book (pending 20,
 * like WhatsApp Web): the phone sends it through the server, which stores
 * nothing. With no permission it answers an empty list, so the web stops waiting.
 */
export async function answerFullAgendaRequest(socket: FullEmitter, request: { requestId?: unknown } | undefined): Promise<void> {
  const requestId = typeof request?.requestId === 'string' ? request.requestId : '';
  if (!requestId) return;
  await precargarAgenda();
  socket.emit('agenda.respuestaTodo', { requestId, contactos: fullAgendaFrom(agendaPorTelefono()) });
}

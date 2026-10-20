import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { avisarTarjeta } from '@lilachat/shared';
import { TarjetaDelMensaje } from './TarjetaDelMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from '../contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from '../types';

/**
 * W3c (20/10): las tarjetas del chat en la web, como en la app. Lo que se fija
 * es el REQUEST (votar, responder) y lo que se ve con lo que el server manda.
 */
const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Obra', memberIds: ['yo', 'ana'], lastSeq: 9, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const respuestas: Record<string, { status: number; body: unknown }> = {};
let llamadas: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  llamadas = [];
  for (const clave of Object.keys(respuestas)) delete respuestas[clave];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      llamadas.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const clave = Object.keys(respuestas).find((parte) => url.endsWith(parte));
      const respuesta = clave ? respuestas[clave]! : { status: 200, body: {} };
      return new Response(JSON.stringify(respuesta.body), { status: respuesta.status });
    })
  );
});

const mensaje = (tipo: 'encuesta' | 'evento' | 'recordatorio', id: string): MensajeEnPantalla => ({ chatId: 'c1', seq: 5, senderId: 'ana', clientKey: `k-${id}`, kind: 'text', body: 'tarjeta', at: new Date().toISOString(), ref: { tipo, id } });

function dibujar(m: MensajeEnPantalla, extra: Partial<ContextoDeLaConversacion> = {}) {
  const contexto: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map([['ana', 'Ana']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), ...extra };
  render(
    <ConversacionContext.Provider value={contexto}>
      <TarjetaDelMensaje mensaje={m} mio={false} conAutor />
    </ConversacionContext.Provider>
  );
}

describe('la encuesta en el chat (web)', () => {
  it('muestra la pregunta y las opciones, y votar manda el índice', async () => {
    respuestas['/agenda/polls/p1'] = { status: 200, body: { poll: { id: 'p1', chatId: 'c1', question: '¿Qué llevamos?', options: [{ text: 'Arroz', votes: ['ana'] }, { text: 'Lasaña', votes: [] }], allowMultiple: false, anonymous: false } } };
    dibujar(mensaje('encuesta', 'p1'));
    expect(await screen.findByText('¿Qué llevamos?')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    await userEvent.click(screen.getByTestId('votar-p1-1'));
    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/agenda/polls/p1/vote'))?.body).toEqual({ optionIndex: 1 }));
  });

  it('borrada (404) lo dice, sin reintentar para siempre', async () => {
    respuestas['/agenda/polls/p2'] = { status: 404, body: { message: 'no' } };
    dibujar(mensaje('encuesta', 'p2'));
    expect(await screen.findByText('Esta encuesta ya no está disponible.')).toBeTruthy();
  });
});

describe('el evento en el chat (web)', () => {
  it('responder «Voy» manda el rsvp; a quien lo creó no se le pregunta', async () => {
    respuestas['/agenda/events/e1'] = { status: 200, body: { event: { id: 'e1', chatId: 'c1', title: 'Almuerzo', startsAt: '2026-10-25T18:00:00.000Z', location: 'Av. Arequipa 1450', rsvpSummary: { yes: 4, maybe: 1, no: 0, pending: 2 }, myRsvp: null, mio: false } } };
    dibujar(mensaje('evento', 'e1'));
    expect(await screen.findByText('Almuerzo')).toBeTruthy();
    expect(screen.getByText('Av. Arequipa 1450')).toBeTruthy();
    await userEvent.click(screen.getByTestId('rsvp-e1-yes'));
    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/agenda/events/e1/rsvp'))?.body).toEqual({ rsvp: 'yes' }));
  });

  it('se vuelve a pedir cuando el server avisa que cambió (ref.changed)', async () => {
    respuestas['/agenda/events/e2'] = { status: 200, body: { event: { id: 'e2', chatId: 'c1', title: 'Reunión', startsAt: '2026-10-27T00:00:00.000Z', rsvpSummary: { yes: 0, maybe: 0, no: 0, pending: 1 }, myRsvp: null, mio: true } } };
    dibujar(mensaje('evento', 'e2'));
    await screen.findByText('Reunión');
    expect(screen.queryByTestId('rsvp-e2-yes')).toBeNull();
    const antes = llamadas.filter((l) => l.url.endsWith('/agenda/events/e2')).length;
    avisarTarjeta({ tipo: 'evento', id: 'e2' });
    await waitFor(() => expect(llamadas.filter((l) => l.url.endsWith('/agenda/events/e2')).length).toBe(antes + 1));
  });
});

describe('el recordatorio en el chat (web)', () => {
  it('título, cuándo suena y la descripción con su link tocable', async () => {
    respuestas['/agenda/reminders/r1'] = { status: 200, body: { reminder: { _id: 'r1', title: 'Hacer ejercicios', note: 'Rutina: https://youtu.be/sd4cF1Teoig', startsAt: '2030-10-21T11:30:00.000Z', recurrence: 'daily', active: true, chatId: 'c1' } } };
    dibujar(mensaje('recordatorio', 'r1'));
    expect(await screen.findByText('Hacer ejercicios')).toBeTruthy();
    expect(screen.getByText(/Diario/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'https://youtu.be/sd4cF1Teoig' }).getAttribute('href')).toBe('https://youtu.be/sd4cF1Teoig');
  });

  it('quien puede editarlo lo abre para editar', async () => {
    const recordatorio = { _id: 'r2', title: 'Pagar la luz', startsAt: '2030-10-21T14:00:00.000Z', recurrence: 'once', active: true, chatId: 'c1' };
    respuestas['/agenda/reminders/r2'] = { status: 200, body: { reminder: recordatorio } };
    const onEditarRecordatorio = vi.fn();
    dibujar(mensaje('recordatorio', 'r2'), { onEditarRecordatorio });
    await userEvent.click(await screen.findByTestId('editar-recordatorio-r2'));
    expect(onEditarRecordatorio).toHaveBeenCalledWith(expect.objectContaining({ _id: 'r2', title: 'Pagar la luz' }));
  });
});

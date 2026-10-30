import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineaDePendientes } from './LineaDePendientes';

/** «Pendientes» en la web (20/10), como la app: una línea por cuándo tocan. */
const enHoras = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();
let llamadas: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      llamadas.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith('/api/agenda/events')) {
        return new Response(JSON.stringify({ events: [{ id: 'e1', chatId: 'c1', title: 'Almuerzo de obra', startsAt: enHoras(1), rsvpSummary: { yes: 1, maybe: 0, no: 0, pending: 1 }, myRsvp: null, mio: false, chat: { kind: 'group', name: 'Obra' }, attendees: [{ userId: 'a', rsvp: 'yes' }, { userId: 'yo' }], personas: { a: { phone: '987654321', name: 'Ana' } } }] }), { status: 200 });
      }
      if (url.endsWith('/api/agenda/linea')) {
        return new Response(
          JSON.stringify({
            recordatorios: [{ _id: 'r1', title: 'Pagar la luz', startsAt: enHoras(30 * 24), recurrence: 'once', active: true, chatId: 'c1', chat: { kind: 'group', name: 'Obra' } }],
            vencidos: [{ _id: 'r2', title: 'Llamar al proveedor', startsAt: enHoras(-2), recurrence: 'once', active: false }],
            apagados: [{ _id: 'r3', title: 'Tomar agua', startsAt: enHoras(-100), recurrence: 'daily', active: false }],
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    })
  );
});

describe('LineaDePendientes', () => {
  it('muestra Vencidos, Hoy y Más adelante con eventos y recordatorios, y de dónde viene cada uno', async () => {
    render(<LineaDePendientes jwt="j" me="yo" onEditarRecordatorio={() => {}} />);
    expect(await screen.findByText('Almuerzo de obra')).toBeTruthy();
    expect(screen.getByTestId('seccion-vencidos').textContent).toContain('Llamar al proveedor');
    expect(screen.getByTestId('seccion-despues').textContent).toContain('Pagar la luz');
    expect(screen.getByText('En «Obra»')).toBeTruthy();
    expect(screen.getByText('Sin responder')).toBeTruthy();
  });

  it('responder un evento manda el rsvp; «Posponer» abre el recordatorio', async () => {
    const onEditar = vi.fn();
    render(<LineaDePendientes jwt="j" me="yo" onEditarRecordatorio={onEditar} />);
    await userEvent.click(await screen.findByTestId('pendiente-evento-e1'));
    await userEvent.click(screen.getByTestId('rsvp-e1-yes'));
    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/api/agenda/events/e1/rsvp'))?.body).toEqual({ rsvp: 'yes' }));
    await userEvent.click(screen.getByTestId('posponer-r2'));
    expect(onEditar).toHaveBeenCalledWith(expect.objectContaining({ _id: 'r2' }));
  });

  it('tocar un evento abre su detalle con quiénes van, por respuesta (pending 10)', async () => {
    render(<LineaDePendientes jwt="j" me="yo" onEditarRecordatorio={() => {}} />);
    await userEvent.click(await screen.findByTestId('pendiente-evento-e1'));
    const detail = screen.getByTestId('detalle-evento-e1');
    expect(detail.textContent).toContain('Almuerzo de obra');
    expect(screen.getByTestId('asistentes-yes').textContent).toContain('Van (1)');
    expect(screen.getByTestId('asistentes-yes').textContent).toContain('Ana');
    expect(screen.getByTestId('asistentes-no').textContent).toContain('Ningún participante rechazó la invitación.');
    expect(screen.getByTestId('asistentes-pending').textContent).toContain('Tú');
    await userEvent.click(screen.getByTestId('volver-a-pendientes'));
    expect(screen.queryByTestId('detalle-evento-e1')).toBeNull();
  });

  it('un apagado se prende desde su interruptor', async () => {
    render(<LineaDePendientes jwt="j" me="yo" onEditarRecordatorio={() => {}} />);
    await userEvent.click(await screen.findByTestId('prender-r3'));
    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/api/agenda/reminders/r3/toggle'))?.body).toEqual({ active: true }));
  });
});

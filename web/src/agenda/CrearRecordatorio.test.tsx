import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrearRecordatorio, aValorLocal, validarRecordatorio } from './CrearRecordatorio';

/**
 * W3c (20/10): el recordatorio del chat también se crea y se edita desde la
 * web, con el MISMO cuerpo que manda la app (`CreateReminderScreen`).
 */
let llamadas: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      llamadas.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ id: 'r-nuevo' }), { status: 201 });
    })
  );
});

describe('validarRecordatorio', () => {
  const ahora = new Date('2026-10-20T15:00:00Z');
  it('pide un nombre', () => {
    expect(validarRecordatorio({ titulo: '  ', cuando: new Date('2026-10-21T15:00:00Z'), repetir: 'once', ahora })).toBe('Ponle un nombre al recordatorio.');
  });
  it('una vez y en el pasado no se puede; repetido sí (sigue sonando)', () => {
    const ayer = new Date('2026-10-19T15:00:00Z');
    expect(validarRecordatorio({ titulo: 'Pagar', cuando: ayer, repetir: 'once', ahora })).toBe('Esa hora ya pasó. Elige una que venga.');
    expect(validarRecordatorio({ titulo: 'Pagar', cuando: ayer, repetir: 'daily', ahora })).toBeNull();
  });
  it('una fecha inválida se dice', () => {
    expect(validarRecordatorio({ titulo: 'Pagar', cuando: new Date('nada'), repetir: 'once', ahora })).toBe('Elige el día y la hora.');
  });
});

describe('aValorLocal', () => {
  it('arma el valor de un input datetime-local en la hora local', () => {
    expect(aValorLocal(new Date(2026, 9, 24, 10, 5))).toBe('2026-10-24T10:05');
  });
});

describe('CrearRecordatorio', () => {
  it('crea en el chat con el cuerpo de la app y dice a quién le suena', async () => {
    const alGuardar = vi.fn();
    render(<CrearRecordatorio jwt="j" chat={{ id: 'c1', name: 'Wilson', kind: 'direct' }} onClose={() => {}} onGuardado={alGuardar} />);
    expect(screen.getByText('Con «Wilson»: les suena a los dos.')).toBeTruthy();
    await userEvent.type(screen.getByTestId('titulo-recordatorio'), 'Hacer ejercicios');
    await userEvent.type(screen.getByTestId('nota-recordatorio'), 'Rutina: https://youtu.be/x');
    await userEvent.click(screen.getByTestId('atajo-manana'));
    await userEvent.click(screen.getByTestId('repetir-daily'));
    await userEvent.click(screen.getByTestId('btn-guardar-recordatorio'));
    await waitFor(() => expect(alGuardar).toHaveBeenCalled());
    const cuerpo = llamadas.find((l) => l.url.endsWith('/api/agenda/reminders') && l.method === 'POST')?.body as Record<string, unknown>;
    expect(cuerpo).toMatchObject({ title: 'Hacer ejercicios', note: 'Rutina: https://youtu.be/x', recurrence: 'daily', chatId: 'c1' });
    expect(new Date(String(cuerpo.startsAt)).getHours()).toBe(9);
  });

  it('sin nombre no manda nada y lo dice en el campo', async () => {
    render(<CrearRecordatorio jwt="j" chat={{ id: 'c1', name: 'Obra', kind: 'group' }} onClose={() => {}} onGuardado={() => {}} />);
    await userEvent.click(screen.getByTestId('btn-guardar-recordatorio'));
    expect(await screen.findByText('Ponle un nombre al recordatorio.')).toBeTruthy();
    expect(llamadas.filter((l) => l.method === 'POST')).toHaveLength(0);
  });

  it('editar manda PATCH al recordatorio y eliminar pide confirmar', async () => {
    const alGuardar = vi.fn();
    vi.stubGlobal('confirm', vi.fn(() => true));
    const editando = { _id: 'r9', title: 'Pagar la luz', startsAt: '2030-10-21T14:00:00.000Z', recurrence: 'once' as const, active: true, chatId: 'c1' };
    render(<CrearRecordatorio jwt="j" chat={{ id: 'c1', name: 'Obra', kind: 'group' }} editando={editando} onClose={() => {}} onGuardado={alGuardar} />);
    const titulo = screen.getByTestId('titulo-recordatorio') as HTMLInputElement;
    expect(titulo.value).toBe('Pagar la luz');
    await userEvent.clear(titulo);
    await userEvent.type(titulo, 'Pagar el agua');
    await userEvent.click(screen.getByTestId('btn-guardar-recordatorio'));
    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/api/agenda/reminders/r9') && l.method === 'PATCH')?.body).toMatchObject({ title: 'Pagar el agua', recurrence: 'once' }));
    await userEvent.click(screen.getByTestId('btn-eliminar-recordatorio'));
    await waitFor(() => expect(llamadas.some((l) => l.url.endsWith('/api/agenda/reminders/r9') && l.method === 'DELETE')).toBe(true));
  });
});

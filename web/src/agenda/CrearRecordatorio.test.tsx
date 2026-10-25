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

/** José 25/10: «avisar» before (15 min, configurable, several) and a location. */
describe('CrearRecordatorio: avisos previos y ubicación', () => {
  const openForm = (onSaved = vi.fn()) => render(<CrearRecordatorio jwt="j" chat={null} onClose={() => {}} onGuardado={onSaved} />);
  const cuerpoEnviado = () => llamadas.find((l) => l.url.endsWith('/api/agenda/reminders') && l.method === 'POST')?.body as Record<string, unknown>;

  it('un recordatorio nuevo ya trae «15 min» marcado', async () => {
    openForm();
    expect(screen.getByTestId('aviso-15').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('aviso-5').getAttribute('aria-pressed')).toBe('false');
  });

  it('se pueden marcar varios y se mandan, el más largo primero', async () => {
    const onSaved = vi.fn();
    openForm(onSaved);
    await userEvent.type(screen.getByTestId('titulo-recordatorio'), 'Reunión');
    await userEvent.click(screen.getByTestId('atajo-manana'));
    await userEvent.click(screen.getByTestId('aviso-60'));
    await userEvent.click(screen.getByTestId('aviso-5'));
    await userEvent.click(screen.getByTestId('btn-guardar-recordatorio'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(cuerpoEnviado()).toMatchObject({ advance: [60, 15, 5] });
  });

  it('desmarcar todos manda la lista vacía: sin aviso previo', async () => {
    const onSaved = vi.fn();
    openForm(onSaved);
    await userEvent.type(screen.getByTestId('titulo-recordatorio'), 'Reunión');
    await userEvent.click(screen.getByTestId('atajo-manana'));
    await userEvent.click(screen.getByTestId('aviso-15'));
    await userEvent.click(screen.getByTestId('btn-guardar-recordatorio'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(cuerpoEnviado()).toMatchObject({ advance: [] });
  });

  it('«Otro» agrega un aviso a medida, en minutos, horas o días', async () => {
    const onSaved = vi.fn();
    openForm(onSaved);
    await userEvent.type(screen.getByTestId('titulo-recordatorio'), 'Reunión');
    await userEvent.click(screen.getByTestId('atajo-manana'));
    await userEvent.click(screen.getByTestId('aviso-otro'));
    await userEvent.type(screen.getByTestId('aviso-otro-cantidad'), '2');
    await userEvent.selectOptions(screen.getByTestId('aviso-otro-unidad'), 'h');
    await userEvent.click(screen.getByTestId('aviso-otro-agregar'));
    expect(screen.getByTestId('aviso-120').getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByTestId('btn-guardar-recordatorio'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(cuerpoEnviado()).toMatchObject({ advance: [120, 15] });
  });

  it('una cantidad que no sirve se dice y no se agrega', async () => {
    openForm();
    await userEvent.click(screen.getByTestId('aviso-otro'));
    await userEvent.type(screen.getByTestId('aviso-otro-cantidad'), '0');
    await userEvent.click(screen.getByTestId('aviso-otro-agregar'));
    expect(await screen.findByText('Escribe una cantidad entera, de 1 minuto a 7 días.')).toBeTruthy();
  });

  it('la ubicación se manda recortada', async () => {
    const onSaved = vi.fn();
    openForm(onSaved);
    await userEvent.type(screen.getByTestId('titulo-recordatorio'), 'Reunión');
    await userEvent.click(screen.getByTestId('atajo-manana'));
    await userEvent.type(screen.getByTestId('ubicacion-recordatorio'), '  Av. Javier Prado 123 ');
    await userEvent.click(screen.getByTestId('btn-guardar-recordatorio'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(cuerpoEnviado()).toMatchObject({ location: 'Av. Javier Prado 123' });
  });

  it('al editar trae lo guardado, sin sumarle el aviso por defecto', async () => {
    render(
      <CrearRecordatorio
        jwt="j"
        chat={null}
        editando={{ _id: 'r1', title: 'Reunión', startsAt: new Date(Date.now() + 86_400_000).toISOString(), recurrence: 'once', active: true, location: 'Planta Lurín', advance: [60] }}
        onClose={() => {}}
        onGuardado={() => {}}
      />
    );
    expect(screen.getByTestId('aviso-60').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('aviso-15').getAttribute('aria-pressed')).toBe('false');
    expect((screen.getByTestId('ubicacion-recordatorio') as HTMLInputElement).value).toBe('Planta Lurín');
  });
});


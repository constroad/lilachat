import { describe, expect, it } from 'vitest';
import { cambiosDeEvento, cambiosDeRecordatorio } from './agendaEdicion.js';

/**
 * Editar avisos y eventos (José, 17/10/2026: «no hay como editar avisos, y
 * pienso que pasa lo mismo en eventos»). El server solo sabía crear. Lo que
 * se puede cambiar y cómo se valida vive acá, puro, para que la ruta no
 * invente reglas.
 */
const actual = { startsAt: new Date('2026-10-20T15:00:00.000Z') };

describe('cambiosDeRecordatorio', () => {
  it('cambia título, nota y repetición', () => {
    const r = cambiosDeRecordatorio({ title: ' Tomar agua ', note: 'cada 2 h', recurrence: 'daily' }, actual);

    expect(r).toEqual({ ok: true, set: { title: 'Tomar agua', note: 'cada 2 h', recurrence: 'daily' }, unset: [] });
  });

  /** Sin esto el cron ve `remindedAt` puesto y el aviso movido nunca suena. */
  it('mover la hora rearma el aviso (remindedAt en null) y lo reactiva', () => {
    const r = cambiosDeRecordatorio({ startsAt: '2026-10-21T13:00:00.000Z' }, actual);

    expect(r).toEqual({
      ok: true,
      set: { startsAt: new Date('2026-10-21T13:00:00.000Z'), remindedAt: null, active: true },
      unset: [],
    });
  });

  it('la misma hora no rearma nada: no vuelve a sonar algo ya avisado', () => {
    const r = cambiosDeRecordatorio({ startsAt: actual.startsAt.toISOString(), title: 'X' }, actual);

    expect(r).toEqual({ ok: true, set: { title: 'X' }, unset: [] });
  });

  it('nota vacía se BORRA, no se guarda como texto vacío', () => {
    expect(cambiosDeRecordatorio({ note: '   ' }, actual)).toEqual({ ok: true, set: {}, unset: ['note'] });
  });

  it('título vacío, fecha inválida o repetición desconocida: error en palabras', () => {
    expect(cambiosDeRecordatorio({ title: '  ' }, actual)).toEqual({ ok: false, message: 'Escribe de qué es el recordatorio.' });
    expect(cambiosDeRecordatorio({ startsAt: 'mañana' }, actual)).toEqual({ ok: false, message: 'Elige cuándo.' });
    expect(cambiosDeRecordatorio({ recurrence: 'yearly' }, actual)).toEqual({ ok: false, message: 'Repetición inválida.' });
  });

  /** Pending 65: monthly, and the rule that says which weekdays or the month's last day. */
  it('accepts monthly and a repeat rule; an empty rule is cleared', () => {
    // Act
    const monthly = cambiosDeRecordatorio({ recurrence: 'monthly', repeat: { monthDay: 'last' } }, actual);
    const cleared = cambiosDeRecordatorio({ repeat: {} }, actual);
    // Assert
    expect(monthly).toEqual({ ok: true, set: { recurrence: 'monthly', repeat: { monthDay: 'last' } }, unset: [] });
    expect(cleared).toEqual({ ok: true, set: {}, unset: ['repeat'] });
  });

  it('ignora campos que no son editables (dueño, chat, sello del cron)', () => {
    const r = cambiosDeRecordatorio({ userId: 'otro', chatId: 'x', remindedAt: null, active: false }, actual);

    expect(r).toEqual({ ok: true, set: {}, unset: [] });
  });

  it('un cuerpo que no es objeto no rompe', () => {
    expect(cambiosDeRecordatorio(null, actual)).toEqual({ ok: true, set: {}, unset: [] });
    expect(cambiosDeRecordatorio('basura', actual)).toEqual({ ok: true, set: {}, unset: [] });
  });
});

describe('cambiosDeEvento', () => {
  it('cambia título, descripción y lugar; vacíos se borran', () => {
    const r = cambiosDeEvento({ title: 'Asado', description: '', location: ' Casa de la abuela ' }, actual);

    expect(r).toEqual({ ok: true, set: { title: 'Asado', location: 'Casa de la abuela' }, unset: ['description'] });
  });

  it('mover la fecha rearma el aviso a los invitados', () => {
    const r = cambiosDeEvento({ startsAt: '2026-10-22T23:00:00.000Z' }, actual);

    expect(r).toEqual({ ok: true, set: { startsAt: new Date('2026-10-22T23:00:00.000Z'), remindedAt: null }, unset: [] });
  });

  it('la hora de fin: válida y después del inicio; vacía se borra', () => {
    expect(cambiosDeEvento({ endsAt: '2026-10-20T17:00:00.000Z' }, actual)).toEqual({
      ok: true,
      set: { endsAt: new Date('2026-10-20T17:00:00.000Z') },
      unset: [],
    });
    expect(cambiosDeEvento({ endsAt: '2026-10-20T14:00:00.000Z' }, actual)).toEqual({
      ok: false,
      message: 'La hora de fin tiene que ser después del inicio.',
    });
    expect(cambiosDeEvento({ endsAt: null }, actual)).toEqual({ ok: true, set: {}, unset: ['endsAt'] });
  });

  it('el fin se compara con el inicio NUEVO si también se mueve', () => {
    const r = cambiosDeEvento({ startsAt: '2026-10-25T15:00:00.000Z', endsAt: '2026-10-25T18:00:00.000Z' }, actual);

    expect(r.ok).toBe(true);
  });

  it('título vacío o fecha inválida: error', () => {
    expect(cambiosDeEvento({ title: '' }, actual)).toEqual({ ok: false, message: 'Ponle un nombre al evento.' });
    expect(cambiosDeEvento({ startsAt: 'x' }, actual)).toEqual({ ok: false, message: 'Elige cuándo es.' });
  });

  it('avisar a los invitados se puede apagar y prender', () => {
    expect(cambiosDeEvento({ remindGuests: false }, actual)).toEqual({ ok: true, set: { remindGuests: false }, unset: [] });
    expect(cambiosDeEvento({ remindGuests: true }, actual)).toEqual({ ok: true, set: { remindGuests: true }, unset: [] });
    expect(cambiosDeEvento({ remindGuests: 'si' }, actual)).toEqual({ ok: true, set: {}, unset: [] });
  });

  it('no deja tocar invitados, creador ni chat por acá', () => {
    expect(cambiosDeEvento({ attendees: [], createdBy: 'x', chatId: 'y' }, actual)).toEqual({ ok: true, set: {}, unset: [] });
  });
});

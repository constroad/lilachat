import { describe, expect, it } from 'vitest';
import { formFields, type AppForm, type FormSchemaProperty } from './appForms.js';
import { filledRemarks, isWideForm, LIVE_TYPING_PAUSE_MS, refreshDelayMs } from './appFormLive.js';

const fieldsOf = (properties: Record<string, FormSchemaProperty>) => formFields({ id: 'f', title: 'F', schema: { type: 'object', properties } } as AppForm);
const services = Array.from({ length: 12 }, (_, index) => `6a5503b40afd38abc67ff7${String(index).padStart(2, '0')}`);

/** agentes' «Completar gasto» (12/11): Proyecto/Servicio, the service, its partida, and the amount. */
const expense = fieldsOf({
  deQue: { type: 'string', enum: ['proyecto', 'servicio'], title: '¿De qué es?', 'x-refresh': true },
  servicioId: { type: 'string', title: '¿De qué servicio?', enum: services, 'x-refresh': true },
  monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', 'x-refresh': true },
  detalle: { type: 'string', title: 'Detalle', 'x-refresh': true },
  fecha: { type: 'string', format: 'date', title: 'Fecha', 'x-refresh': true },
});

describe('refreshDelayMs (Andrea 12/11: the clients, then the partidas, took long)', () => {
  it('a pick leaves at once: the segmented, a long list, a date', () => {
    expect(refreshDelayMs(expense, {}, { deQue: 'servicio' })).toBe(0);
    expect(refreshDelayMs(expense, { deQue: 'servicio' }, { deQue: 'servicio', servicioId: services[3] })).toBe(0);
    expect(refreshDelayMs(expense, {}, { fecha: '2026-11-12' })).toBe(0);
  });

  it('typing a number or a text waits until it settles', () => {
    expect(refreshDelayMs(expense, {}, { monto: 40 })).toBe(LIVE_TYPING_PAUSE_MS);
    expect(refreshDelayMs(expense, {}, { detalle: 'Cemento' })).toBe(LIVE_TYPING_PAUSE_MS);
  });

  it('a pick with a typed change in the same draft still waits for the typing', () => {
    expect(refreshDelayMs(expense, { deQue: 'proyecto' }, { deQue: 'servicio', monto: 40 })).toBe(LIVE_TYPING_PAUSE_MS);
  });

  it('a field without `x-refresh` never counts, nor a value that did not change', () => {
    const fields = fieldsOf({ monto: { type: 'number', title: 'Monto' }, deQue: { type: 'string', enum: ['a', 'b'], 'x-refresh': true } });
    expect(refreshDelayMs(fields, { deQue: 'a' }, { deQue: 'a', monto: 5 })).toBe(0);
  });
});

describe('isWideForm (Andrea 12/11: the partidas showed in a tiny space)', () => {
  it('a long list of options or a list of rows takes the wide dialog', () => {
    expect(isWideForm(expense)).toBe(true);
    expect(isWideForm(fieldsOf({ partidas: { type: 'array', title: 'Partidas', items: { type: 'object', properties: { monto: { type: 'number', title: 'Monto' } } } } }))).toBe(true);
  });

  it('a short form with a segmented and a few fields stays narrow', () => {
    expect(isWideForm(fieldsOf({ estado: { type: 'string', enum: ['pagado', 'por_pagar'] }, monto: { type: 'number', title: 'Monto' } }))).toBe(false);
  });
});

describe('filledRemarks: the app\'s live remarks sit under what the person has filled in (José 13/11)', () => {
  const fields = fieldsOf({
    monto: { type: 'number', title: 'Monto' },
    nota: { type: 'string', title: 'Nota' },
    partidas: { type: 'array', title: 'Partidas', items: { type: 'object', properties: { monto: { type: 'number', title: 'Monto' } } } },
  });
  const remarks = { partidas: 'Elige al menos una partida.', monto: 'Ese monto ya está registrado.', 'partidas[0].monto': 'No cuadra.', _: 'Revisa el gasto.' };

  it('«Elige al menos una partida» waits: nothing is picked, and the send is the one that asks for it', () => {
    expect(filledRemarks(remarks, fields, { monto: 120 })).not.toHaveProperty('partidas');
  });

  it('a remark under a field with an answer stays, a zero too', () => {
    expect(filledRemarks(remarks, fields, { monto: 0 }).monto).toBe('Ese monto ya está registrado.');
    expect(filledRemarks(remarks, fields, { monto: 120 }).monto).toBe('Ese monto ya está registrado.');
  });

  it('a blank text, a missing value and an empty list all count as nothing answered', () => {
    const blank = filledRemarks({ nota: 'Muy corta.', monto: 'Falta.', partidas: 'Falta.' }, fields, { nota: '  ', partidas: [] });
    expect(blank).toEqual({});
  });

  it('a remark on a row, or one that belongs to no field, stays', () => {
    const kept = filledRemarks(remarks, fields, { partidas: [{ monto: 10 }] });
    expect(kept['partidas[0].monto']).toBe('No cuadra.');
    expect(kept.partidas).toBe('Elige al menos una partida.');
    expect(kept._).toBe('Revisa el gasto.');
  });
});

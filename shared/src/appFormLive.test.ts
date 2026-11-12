import { describe, expect, it } from 'vitest';
import { formFields, type AppForm, type FormSchemaProperty } from './appForms.js';
import { isWideForm, LIVE_TYPING_PAUSE_MS, refreshDelayMs } from './appFormLive.js';

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

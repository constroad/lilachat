import { describe, expect, it } from 'vitest';
import { formFields, type AppForm, type FormSchemaProperty } from './appForms.js';
import { isDesignedForm, isSplitForm, numberedStepsOf } from './appFormSteps.js';

const formWith = (properties: Record<string, FormSchemaProperty>): AppForm => ({ id: 'f', title: 'F', schema: { type: 'object', properties } });
/** Services are records (database ids): a field that grows, so it opens a search. */
const SERVICES = ['6a5b0dce293506d652e2ab05', '6a56726f1e86f1c14d14a1c6', '6a55427258cf0904ab6ca1d9'];

/** agentes' «Completar gasto» (design gst-02): what it goes to, which one, how to split, and the partidas. */
const expense = formWith({
  destino: { type: 'string', title: '¿Proyecto o servicio?', enum: ['servicio', 'proyecto'], 'x-labels': { servicio: 'Servicio', proyecto: 'Proyecto' } },
  servicioId: { type: 'string', title: '¿De qué servicio?', enum: SERVICES, 'x-visible-if': { destino: ['servicio'] } },
  repartir: { type: 'string', title: 'Repartir', enum: ['una', 'iguales', 'segun', 'mano'], 'x-labels': { una: 'Una partida', iguales: 'Partes iguales', segun: 'Según partida', mano: 'A mano' }, 'x-visible-if': { destino: ['servicio'] } },
  partidas: {
    type: 'array',
    title: 'Partidas',
    'x-visible-if': { repartir: ['iguales', 'mano'] },
    items: { type: 'object', required: ['partidaId'], properties: { partidaId: { type: 'string', title: 'Partida', enum: ['mat', 'mo', 'eq'] }, monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' } } },
  },
  monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' },
  estado: { type: 'string', title: 'Estado', enum: ['pagado', 'por_pagar'], 'x-labels': { pagado: 'Pagado', por_pagar: 'Por pagar' } },
});

describe('numberedStepsOf: the steps of a split form wear a number (design gst-02: «1. ¿A QUÉ VA?»)', () => {
  it('numbers what it goes to, the long list to pick from and the partidas; the way to split is the partidas\' own pills', () => {
    // Arrange
    const fields = formFields(expense);
    // Act
    const steps = numberedStepsOf(fields);
    // Assert
    expect(steps).toEqual({ destino: 1, servicioId: 2, partidas: 3 });
  });

  it('a step that is not on screen takes no number, and the rest close up', () => {
    const fields = formFields(expense);
    const shown = fields.filter((field) => field.name !== 'servicioId');
    expect(numberedStepsOf(fields, shown)).toEqual({ destino: 1, partidas: 2 });
  });

  it('the partidas still hidden (nothing chosen yet): the first steps are numbered from the start, so the form does not change its look', () => {
    const fields = formFields(expense);
    const shown = fields.filter((field) => field.name !== 'partidas');
    expect(numberedStepsOf(fields, shown)).toEqual({ destino: 1, servicioId: 2 });
  });

  it('the plain inputs of the form (amount, state) are never numbered', () => {
    const steps = numberedStepsOf(formFields(expense));
    expect(steps).not.toHaveProperty('monto');
    expect(steps).not.toHaveProperty('estado');
  });

  it('knows a form that splits by its list of ticks, shown or not', () => {
    expect(isSplitForm(formFields(expense))).toBe(true);
    expect(isSplitForm(formFields(formWith({ monto: { type: 'number', title: 'Monto' } })))).toBe(false);
  });

  it('a form that splits nothing is left as it is', () => {
    const plain = formWith({
      destino: { type: 'string', title: '¿Dónde?', enum: ['a', 'b'] },
      servicioId: { type: 'string', title: '¿Cuál?', enum: SERVICES, 'x-visible-if': { destino: ['a'] } },
    });
    expect(numberedStepsOf(formFields(plain))).toEqual({});
  });
});

/** agentes' «Revisar gasto» in its first mode (one partida): no list of ticks yet, but the folded «Corregir datos». */
const reviewOnePartida = formWith({
  destino: { type: 'string', title: '¿Proyecto o servicio?', enum: ['servicio', 'proyecto'], 'x-labels': { servicio: 'Servicio', proyecto: 'Proyecto' } },
  servicioId: { type: 'string', title: '¿De qué servicio?', enum: SERVICES },
  reparto: { type: 'string', title: 'Repartir', enum: ['Una partida', 'Partes iguales', 'Según partida', 'A mano'] },
  partidaId: { type: 'string', title: 'Partida', enum: SERVICES },
  monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', 'x-section': 'Corregir datos', 'x-collapsed': true },
});

describe('isDesignedForm: a form that declares sections wears the design from its first step (agentes 13/11)', () => {
  it('«Revisar gasto» with one partida has no list of ticks, and is still the designed form: the look does not jump when the mode changes', () => {
    const fields = formFields(reviewOnePartida);
    expect(isSplitForm(fields)).toBe(false);
    expect(isDesignedForm(fields)).toBe(true);
  });

  it('a form that splits by its list of ticks is designed, as before', () => {
    expect(isDesignedForm(formFields(expense))).toBe(true);
  });

  it('a plain form, without a list and without sections, is left as it is', () => {
    expect(isDesignedForm(formFields(formWith({ monto: { type: 'number', title: 'Monto' } })))).toBe(false);
  });

  it('numbers the steps of the one-partida mode: the service, then the partida', () => {
    expect(numberedStepsOf(formFields(reviewOnePartida))).toEqual({ servicioId: 1, partidaId: 2 });
  });
});

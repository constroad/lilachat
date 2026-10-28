import { describe, expect, it } from 'vitest';
import { firstErrorField, formFields, initialValues, itemPath, showsInitials, validateFormSpec, validateFormValues, type AppForm, type FormField } from './appForms.js';

/** Portal's `crear_pedido` with its trucks as rows (José, 28/10: «una fila con el número de carros y al costado los m³»). */
const orderForm: AppForm = {
  id: 'crear_pedido',
  title: 'Crear un pedido',
  schema: {
    type: 'object',
    properties: {
      m3: { type: 'number', title: 'm³ del pedido', exclusiveMinimum: 0, maximum: 500 },
      despachos: {
        type: 'array',
        title: 'Carros',
        description: 'Carros y lo que lleva cada uno.',
        minItems: 1,
        maxItems: 6,
        default: [{ carros: 1, m3: 25 }],
        items: {
          type: 'object',
          required: ['carros', 'm3'],
          properties: {
            carros: { type: 'integer', title: 'Carros', minimum: 1, maximum: 60 },
            m3: { type: 'number', title: 'm³ por carro', 'x-unit': 'm³', exclusiveMinimum: 0, maximum: 40 },
          },
        },
      },
    },
    required: ['m3', 'despachos'],
  },
};

/** A quote with the products it needs (agentes, 28/10): a card per product, a field that shows for one answer. */
const quoteForm: AppForm = {
  id: 'crear_cotizacion',
  title: 'Crear una cotización',
  schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        title: 'Productos',
        minItems: 1,
        'x-add-label': 'Agregar producto',
        items: {
          type: 'object',
          required: ['producto', 'cantidad', 'detalle'],
          properties: {
            producto: { type: 'string', enum: ['mezcla', 'otro'], 'x-labels': { mezcla: 'Mezcla asfáltica', otro: 'Otro' }, title: 'Producto' },
            cantidad: { type: 'number', title: 'Cantidad', exclusiveMinimum: 0 },
            detalle: { type: 'string', title: 'Qué otro producto', 'x-visible-if': { producto: ['otro'] } },
            fecha: { type: 'string', format: 'date', title: 'Para cuándo' },
          },
        },
      },
    },
    required: ['items'],
  },
};

const field = (form: AppForm, name: string) => formFields(form).find((one) => one.name === name) as FormField;
const TODAY = new Date('2026-10-28T15:00:00Z');

describe('a list in a form: rows of trucks, cards of products (José and agentes, 28/10)', () => {
  it('two short numbers per item are a row; the bounds, the button and the starting rows come from the schema', () => {
    // Arrange
    const despachos = field(orderForm, 'despachos');
    // Act
    const start = initialValues(formFields(orderForm), TODAY);
    // Assert
    expect(despachos).toMatchObject({ kind: 'list', label: 'Carros', required: true, min: 1, max: 6, addLabel: 'Agregar fila', layout: 'row' });
    expect(despachos.kind === 'list' && despachos.fields).toEqual<FormField[]>([
      { kind: 'number', name: 'carros', label: 'Carros', required: true, min: 1, max: 60, integer: true },
      { kind: 'number', name: 'm3', label: 'm³ por carro', required: true, unit: 'm³', min: 0, minExclusive: true, max: 40, integer: false },
    ]);
    expect(start.despachos).toEqual([{ carros: 1, m3: 25 }]);
  });

  it('a product with a choice, a field that shows for one answer and a date is a card, with the app\'s button', () => {
    // Arrange
    const items = field(quoteForm, 'items');
    // Act
    const start = initialValues(formFields(quoteForm), TODAY);
    // Assert
    expect(items).toMatchObject({ kind: 'list', min: 1, max: 10, addLabel: 'Agregar producto', layout: 'card' });
    // It starts with minItems items, each with its own defaults (today for a date).
    expect(start.items).toEqual([{ fecha: '2026-10-28' }]);
  });

  it('a list that may be empty starts empty', () => {
    // Arrange
    const optional: AppForm = { ...quoteForm, schema: { ...quoteForm.schema, properties: { items: { ...quoteForm.schema.properties!.items, minItems: 0 } }, required: [] } };
    // Act
    const start = initialValues(formFields(optional), TODAY);
    // Assert
    expect(start.items).toEqual([]);
  });

  it('sends an array of clean objects: numbers read, unknown keys dropped, a hidden field neither required nor sent', () => {
    // Arrange
    const raw = { m3: '65', despachos: [{ carros: '2', m3: '25', extra: 'x' }, { carros: 1, m3: '15' }] };
    const quote = { items: [{ producto: 'mezcla', cantidad: 3, detalle: 'no se ve', fecha: '2026-10-30' }] };
    // Act
    const order = validateFormValues(formFields(orderForm), raw);
    const quoted = validateFormValues(formFields(quoteForm), quote);
    // Assert
    expect(order).toEqual({ ok: true, values: { m3: 65, despachos: [{ carros: 2, m3: 25 }, { carros: 1, m3: 15 }] } });
    expect(quoted).toEqual({ ok: true, values: { items: [{ producto: 'mezcla', cantidad: 3, fecha: '2026-10-30' }] } });
  });

  it('says what is wrong under THAT field of THAT item, with the path the app uses too', () => {
    // Arrange
    const raw = { m3: 65, despachos: [{ carros: 2, m3: 25 }, { carros: 1.5, m3: 0 }] };
    const quote = { items: [{ producto: 'otro', cantidad: 2 }] };
    // Act
    const order = validateFormValues(formFields(orderForm), raw);
    const quoted = validateFormValues(formFields(quoteForm), quote);
    // Assert
    expect(itemPath('despachos', 1, 'm3')).toBe('despachos[1].m3');
    expect(order).toEqual({ ok: false, errors: { 'despachos[1].carros': 'Va un número entero.', 'despachos[1].m3': 'Mayor que 0 y hasta 40.' } });
    // «Otro» shows its detail, and now it is required.
    expect(quoted).toEqual({ ok: false, errors: { 'items[0].detalle': 'Escribe algo aquí.' } });
  });

  it('fewer items than the minimum or more than the maximum is said on the list itself', () => {
    // Arrange
    const fields = formFields(orderForm);
    const seven = Array.from({ length: 7 }, () => ({ carros: 1, m3: 25 }));
    // Act
    const none = validateFormValues(fields, { m3: 65, despachos: [] });
    const tooMany = validateFormValues(fields, { m3: 65, despachos: seven });
    // Assert
    expect(none).toEqual({ ok: false, errors: { despachos: 'Agrega al menos uno.' } });
    expect(tooMany).toEqual({ ok: false, errors: { despachos: 'Hasta 6.' } });
  });

  it('refuses a list it cannot draw, saying why', () => {
    // Arrange
    const withProps = (items: unknown) => ({ id: 'f', title: 'F', schema: { type: 'object', properties: { lista: { type: 'array', items } } } });
    // Act
    const strings = validateFormSpec(withProps({ type: 'string' }));
    const nested = validateFormSpec(withProps({ type: 'object', properties: { sub: { type: 'array', items: { type: 'object', properties: { a: { type: 'string' } } } } } }));
    const located = validateFormSpec(withProps({ type: 'object', properties: { donde: { type: 'object', 'x-input': 'location' } } }));
    const wide = validateFormSpec(withProps({ type: 'object', properties: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`c${i}`, { type: 'string' }])) }));
    // Assert
    expect(strings).toEqual({ ok: false, message: 'La lista «lista» va con items de type "object" y al menos un campo.' });
    expect(nested).toEqual({ ok: false, message: 'Dentro de «lista» no va otra lista.' });
    expect(located).toEqual({ ok: false, message: 'Dentro de «lista» no va una ubicación.' });
    expect(wide).toEqual({ ok: false, message: 'Un ítem de «lista» lleva hasta 8 campos.' });
  });

  it('a default with keys the item does not have keeps only its own, and never more rows than the maximum', () => {
    // Arrange
    const many = Array.from({ length: 9 }, () => ({ carros: 1, m3: 25, otro: true }));
    const form: AppForm = { ...orderForm, schema: { ...orderForm.schema, properties: { despachos: { ...orderForm.schema.properties!.despachos, default: many } } } };
    // Act
    const start = initialValues(formFields(form), TODAY);
    // Assert
    expect(start.despachos).toEqual(Array.from({ length: 6 }, () => ({ carros: 1, m3: 25 })));
  });
});

describe('limits that exclude their edge (zod .positive(); E2E 28/10: an expense of 0 reached the app)', () => {
  const amount = (property: Record<string, unknown>): AppForm => ({ id: 'gasto', title: 'Gasto', schema: { type: 'object', properties: { monto: { type: 'number', ...property } }, required: ['monto'] } });

  it('exclusiveMinimum 0 refuses 0 under the field and takes 0.5', () => {
    // Arrange
    const fields = formFields(amount({ exclusiveMinimum: 0 }));
    // Act
    const zero = validateFormValues(fields, { monto: 0 });
    const half = validateFormValues(fields, { monto: '0,5' });
    // Assert
    expect(zero).toEqual({ ok: false, errors: { monto: 'Mayor que 0.' } });
    expect(half).toEqual({ ok: true, values: { monto: 0.5 } });
  });

  it('exclusiveMaximum refuses the edge; with both kinds of limit the message says each', () => {
    // Arrange
    const below = formFields(amount({ exclusiveMaximum: 100 }));
    const mixed = formFields(amount({ minimum: 1, exclusiveMaximum: 100 }));
    // Act
    const edge = validateFormValues(below, { monto: 100 });
    const outside = validateFormValues(mixed, { monto: 0 });
    // Assert
    expect(edge).toEqual({ ok: false, errors: { monto: 'Menor que 100.' } });
    expect(outside).toEqual({ ok: false, errors: { monto: 'Desde 1 y menor que 100.' } });
  });
});

describe('photos from the gallery, only when the app asks (E2E 28/10: a transfer receipt is a screenshot)', () => {
  it('x-gallery on a list of photos lets the person pick one; without it, only the camera', () => {
    // Arrange
    const photos = (extra: Record<string, unknown>): AppForm => ({ id: 'gasto', title: 'Gasto', schema: { type: 'object', properties: { fotos: { type: 'array', 'x-input': 'photo', items: { type: 'string' }, ...extra } } } });
    // Act
    const withGallery = formFields(photos({ 'x-gallery': true }))[0];
    const cameraOnly = formFields(photos({}))[0];
    // Assert
    expect(withGallery).toMatchObject({ kind: 'photo', multiple: true, gallery: true });
    expect(cameraOnly).not.toHaveProperty('gallery');
  });
});

describe('initials beside an option only when the app asks for them (agentes, 28/10: «MM» beside a mix design whose value is an id)', () => {
  it('x-avatar: initials draws them beside people; without it, no option has them, ids or not', () => {
    // Arrange
    const choice = (values: string[], extra: Record<string, unknown> = {}): AppForm => ({ id: 'f', title: 'F', schema: { type: 'object', properties: { c: { type: 'string', enum: values, ...extra } } } });
    const ids = ['6a71ae537c8d2b5b5ad796a1', '6a72bba87c8d2b5b5ad7c287'];
    // Act
    const people = formFields(choice(ids, { 'x-avatar': 'initials' }))[0];
    const designs = formFields(choice(ids))[0];
    const answers = formFields(choice(['si', 'no']))[0];
    const unknown = formFields(choice(ids, { 'x-avatar': 'photo' }))[0];
    // Assert
    expect(people.kind === 'choice' && showsInitials(people)).toBe(true);
    expect(designs.kind === 'choice' && showsInitials(designs)).toBe(false);
    expect(answers.kind === 'choice' && showsInitials(answers)).toBe(false);
    expect(unknown.kind === 'choice' && showsInitials(unknown)).toBe(false);
  });
});

describe('after a refusal the sheet goes to the field with the error (E2E 28/10: «Diseño» was out of sight and nothing seemed to happen)', () => {
  it('the first field in the form\'s order with an error, its own or one of its items\'', () => {
    // Arrange
    const names = ['cliente', 'diseno', 'despachos'];
    // Act
    const design = firstErrorField(names, { despachos: 'x', diseno: 'Más de 40 caracteres.' });
    const item = firstErrorField(names, { 'despachos[1].m3': 'Mayor que 0.' });
    const general = firstErrorField(names, { _: 'Portal no pudo responder.' });
    // Assert
    expect(design).toBe('diseno');
    expect(item).toBe('despachos');
    expect(general).toBeNull();
  });
});

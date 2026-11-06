import { describe, expect, it } from 'vitest';
import { withoutKnownFields } from './appFormKnown';
import type { AppForm } from './appForms';

const linkForm: AppForm = {
  id: 'crear_enlace_de_servicio',
  title: 'Crear el enlace de un servicio',
  schema: {
    type: 'object',
    required: ['servicioId', 'dias'],
    properties: {
      servicioId: { type: 'string', title: 'Servicio', oneOf: [{ const: 'srv-1', title: 'Obra uno' }, { const: 'srv-2', title: 'Obra dos' }] },
      dias: { type: 'integer', title: 'Días', default: 7 },
    },
  },
};

describe('a form opened from a place that already knows an answer (José 06/11: «xq me vuelve a preguntar»)', () => {
  it('does not ask what the place knows, and keeps it to send with the answers', () => {
    // Act
    const asked = withoutKnownFields(linkForm, { servicioId: 'srv-2' });
    // Assert
    expect(Object.keys(asked.form.schema.properties ?? {})).toEqual(['dias']);
    expect(asked.form.schema.required).toEqual(['dias']);
    expect(asked.context).toEqual({ servicioId: 'srv-2' });
  });

  it('asks when the value is not one the form offers: the place cannot answer past the form\'s own options', () => {
    // Act
    const asked = withoutKnownFields(linkForm, { servicioId: 'srv-of-another-client' });
    // Assert
    expect(asked.form).toBe(linkForm);
    expect(asked.context).toEqual({});
  });

  it('values with no field in the form stay out of it and out of the answers', () => {
    // Act
    const asked = withoutKnownFields(linkForm, { alcance: 'pedido', clienteId: 'cli-1' });
    // Assert
    expect(asked.form).toBe(linkForm);
    expect(asked.context).toEqual({});
  });

  it('keeps a field another one depends on: without it that other field would never show', () => {
    // Arrange
    const form: AppForm = {
      id: 'pago',
      title: 'Registrar pago',
      schema: {
        required: ['medio'],
        properties: {
          medio: { type: 'string', enum: ['efectivo', 'banco'] },
          operacion: { type: 'string', 'x-visible-if': { medio: ['banco'] } },
          monto: { type: 'number' },
        },
      },
    };
    // Act
    const asked = withoutKnownFields(form, { medio: 'banco' });
    // Assert
    expect(asked.form).toBe(form);
    expect(asked.context).toEqual({});
  });

  it('keeps a field that shows only with another answer: its value could not be checked here', () => {
    // Arrange
    const form: AppForm = {
      id: 'pago',
      title: 'Registrar pago',
      schema: {
        properties: {
          medio: { type: 'string', enum: ['efectivo', 'banco'] },
          operacion: { type: 'string', 'x-visible-if': { medio: ['banco'] } },
        },
      },
    };
    // Act
    const asked = withoutKnownFields(form, { operacion: '123' });
    // Assert
    expect(asked.form).toBe(form);
  });

  it('a form with nothing left to ask stays whole: an empty sheet tells the person nothing', () => {
    // Arrange
    const form: AppForm = { id: 'uno', title: 'Uno', schema: { required: ['servicioId'], properties: { servicioId: { type: 'string' } } } };
    // Act
    const asked = withoutKnownFields(form, { servicioId: 'srv-1' });
    // Assert
    expect(asked.form).toBe(form);
    expect(asked.context).toEqual({});
  });

  it('a form without required fields stays without them', () => {
    // Arrange
    const form: AppForm = { id: 'dos', title: 'Dos', schema: { properties: { servicioId: { type: 'string' }, nota: { type: 'string' } } } };
    // Act
    const asked = withoutKnownFields(form, { servicioId: 'srv-1' });
    // Assert
    expect(asked.form.schema).not.toHaveProperty('required');
    expect(Object.keys(asked.form.schema.properties ?? {})).toEqual(['nota']);
  });
});

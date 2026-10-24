import { describe, expect, it } from 'vitest';
import { FRESH_LOCATION_MS, formFields, initialValues, liveSelfieFieldOf, validateFormSpec, validateFormValues, visibleFields, type FormField } from './appForms.js';

/** Inframaq's real `registrar_marca` (agentes, 23/10), as the app sends it. */
const attendanceForm = {
  id: 'registrar_marca',
  title: 'Marcar asistencia',
  submit_label: 'Marcar',
  schema: {
    type: 'object',
    properties: {
      accion: { type: 'string', enum: ['ingreso', 'refrigerio', 'retorno', 'salida'], title: 'Acción', 'x-labels': { ingreso: 'Ingreso', refrigerio: 'Refrigerio', retorno: 'Retorno', salida: 'Salida' } },
      ubicacion: { type: 'object', title: 'Tu ubicación', 'x-input': 'location', properties: { lat: { type: 'number' }, lng: { type: 'number' }, precision: { type: 'number', 'x-unit': 'm' } } },
      foto: { type: 'string', format: 'uri', title: 'Selfie', 'x-input': 'photo', description: 'Una foto tuya al marcar' },
      actividades: { type: 'string', maxLength: 300, title: 'Actividades del día' },
    },
    required: ['accion', 'ubicacion', 'foto'],
    additionalProperties: false,
  },
};

describe('an app form (R160, like Slack\'s modals; agentes builds it from the tool\'s inputSchema)', () => {
  it('reads the spec and turns the schema into fields, in order, with labels, help and what is required', () => {
    // Arrange
    const valid = validateFormSpec(attendanceForm);
    // Act
    const fields = valid.ok ? formFields(valid.form) : [];
    // Assert
    expect(valid.ok && valid.form).toMatchObject({ id: 'registrar_marca', title: 'Marcar asistencia', submitLabel: 'Marcar' });
    expect(fields).toEqual<FormField[]>([
      { kind: 'choice', name: 'accion', label: 'Acción', required: true, segmented: true, options: [{ value: 'ingreso', label: 'Ingreso' }, { value: 'refrigerio', label: 'Refrigerio' }, { value: 'retorno', label: 'Retorno' }, { value: 'salida', label: 'Salida' }] },
      { kind: 'location', name: 'ubicacion', label: 'Tu ubicación', required: true },
      { kind: 'photo', name: 'foto', label: 'Selfie', help: 'Una foto tuya al marcar', required: true },
      { kind: 'text', name: 'actividades', label: 'Actividades del día', required: false, multiline: true, maxLength: 300 },
    ]);
  });

  it('a number with its unit and range, a long enum as a list, a date, and a label from the name when there is no title', () => {
    const fields = formFields({ id: 'medida', title: 'Medida', schema: { type: 'object', properties: { nivel: { type: 'number', 'x-unit': 'gl', minimum: 0, maximum: 20000 }, tanque: { type: 'string', enum: ['t1', 't2', 't3', 't4', 't5'] }, fecha: { type: 'string', format: 'date' }, nota_corta: { type: 'string' } } } });
    expect(fields).toEqual<FormField[]>([
      { kind: 'number', name: 'nivel', label: 'Nivel', required: false, unit: 'gl', min: 0, max: 20000, integer: false },
      { kind: 'choice', name: 'tanque', label: 'Tanque', required: false, segmented: false, options: ['t1', 't2', 't3', 't4', 't5'].map((value) => ({ value, label: value.toUpperCase() })) },
      { kind: 'date', name: 'fecha', label: 'Fecha', required: false, withTime: false },
      { kind: 'text', name: 'nota_corta', label: 'Nota corta', required: false, multiline: false },
    ]);
  });

  it('refuses a spec that cannot be drawn, saying why', () => {
    expect(validateFormSpec({ ...attendanceForm, id: '' }).ok).toBe(false);
    expect(validateFormSpec({ ...attendanceForm, title: '' }).ok).toBe(false);
    expect(validateFormSpec({ ...attendanceForm, schema: { type: 'array' } }).ok).toBe(false);
    const unknown = validateFormSpec({ ...attendanceForm, schema: { type: 'object', properties: { x: { type: 'string', 'x-input': 'firma' } } } });
    expect(unknown.ok ? '' : unknown.message).toMatch(/x/);
    const tooMany = validateFormSpec({ ...attendanceForm, schema: { type: 'object', properties: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`f${i}`, { type: 'string' }])) } });
    expect(tooMany.ok).toBe(false);
  });
});

describe('the values a person sends', () => {
  const spec = validateFormSpec(attendanceForm);
  const fields = spec.ok ? formFields(spec.form) : [];
  const good = { accion: 'ingreso', ubicacion: { lat: -11.98, lng: -76.95, precision: 6 }, foto: 'file:f1' };

  it('keeps what is valid, trims text and drops what the form does not have', () => {
    const result = validateFormValues(fields, { ...good, actividades: '  Mantenimiento de la tolva  ', otra: 'x' });
    expect(result).toEqual({ ok: true, values: { ...good, actividades: 'Mantenimiento de la tolva' } });
  });

  it('says, field by field, what is missing or wrong', () => {
    const result = validateFormValues(fields, { accion: 'almuerzo', ubicacion: { lat: 200, lng: -76.95, precision: 6 }, actividades: 'x'.repeat(301) });
    expect(result.ok ? {} : result.errors).toEqual({
      accion: 'Elige una de las opciones.',
      ubicacion: 'La ubicación no es válida.',
      foto: 'Falta la foto.',
      actividades: 'Hasta 300 caracteres.',
    });
  });

  it('numbers within their range, and an optional field left empty is fine', () => {
    const numberFields = formFields({ id: 'm', title: 'M', schema: { type: 'object', properties: { nivel: { type: 'number', minimum: 0, maximum: 100 }, cuenta: { type: 'integer' } }, required: ['nivel'] } });
    expect(validateFormValues(numberFields, { nivel: '42.5' })).toEqual({ ok: true, values: { nivel: 42.5 } });
    expect(validateFormValues(numberFields, { nivel: 120, cuenta: 2.5 })).toEqual({ ok: false, errors: { nivel: 'Entre 0 y 100.', cuenta: 'Va un número entero.' } });
  });
});

describe('fields that show only for some answers (José, 23/10: «si voy a marcar ingreso, ¿por qué pide actividades?»)', () => {
  const form = { id: 'registrar_asistencia', title: 'Marcar asistencia', schema: { type: 'object', properties: {
    accion: { type: 'string', enum: ['ingreso', 'salida'] },
    actividades: { type: 'string', maxLength: 300, 'x-visible-if': { accion: ['salida'] } },
  }, required: ['accion', 'actividades'] } };

  it('an option without x-labels reads capitalized; the field carries when it shows', () => {
    const [accion, actividades] = formFields(form);
    expect(accion).toMatchObject({ options: [{ value: 'ingreso', label: 'Ingreso' }, { value: 'salida', label: 'Salida' }] });
    expect(actividades).toMatchObject({ visibleIf: { accion: ['salida'] } });
  });

  it('hidden until its answer is picked; a hidden field is neither drawn, nor required, nor sent', () => {
    const fields = formFields(form);
    expect(visibleFields(fields, { accion: 'ingreso' }).map((field) => field.name)).toEqual(['accion']);
    expect(visibleFields(fields, { accion: 'salida' }).map((field) => field.name)).toEqual(['accion', 'actividades']);
    expect(validateFormValues(fields, { accion: 'ingreso', actividades: 'algo que quedó escrito' })).toEqual({ ok: true, values: { accion: 'ingreso' } });
    expect(validateFormValues(fields, { accion: 'salida' })).toEqual({ ok: false, errors: { actividades: 'Escribe algo aquí.' } });
  });
});

describe('connecting an account inside Lilachat (José, 23/10: «ingresar allí mismo el código»)', () => {
  // Arrange: agentes' two forms, the destination prefilled with the verified phone.
  const destination = { id: 'cuenta_destino', title: 'Conecta tu cuenta de Inframaq', schema: { type: 'object', properties: { destino: { type: 'string', title: 'Correo o WhatsApp', default: '902049935' } }, required: ['destino'] } };
  const code = { id: 'cuenta_codigo', title: 'Escribe el código', schema: { type: 'object', properties: { codigo: { type: 'string', title: 'Código', maxLength: 6, pattern: '^\\d{6}$' } }, required: ['codigo'] } };
  const otp = { id: 'cuenta_codigo', title: 'Escribe el código', schema: { type: 'object', properties: { codigo: { type: 'string', 'x-input': 'otp', maxLength: 6 } }, required: ['codigo'] } };

  it('starts with the default the app sent', () => {
    expect(initialValues(formFields(destination))).toEqual({ destino: '902049935' });
    expect(initialValues(formFields(code))).toEqual({});
  });

  it('a six-digit code is a code field, with x-input otp or with a digits pattern', () => {
    expect(validateFormSpec(otp)).toMatchObject({ ok: true });
    expect(formFields(otp)[0]).toMatchObject({ kind: 'text', digits: 6 });
    expect(formFields(code)[0]).toMatchObject({ kind: 'text', digits: 6 });
  });

  it('asks for exactly the digits, and a pasted code with spaces is cleaned', () => {
    const fields = formFields(code);
    expect(validateFormValues(fields, { codigo: '12a4' })).toEqual({ ok: false, errors: { codigo: 'Escribe los 6 dígitos.' } });
    expect(validateFormValues(fields, { codigo: ' 123 456 ' })).toEqual({ ok: true, values: { codigo: '123456' } });
  });

  it('a default that is not one of the options is not used', () => {
    const choice = { id: 'f', title: 'F', schema: { type: 'object', properties: { accion: { type: 'string', enum: ['ingreso', 'salida'], default: 'fiesta' } } } };
    expect(initialValues(formFields(choice))).toEqual({});
  });
});

describe('signing with the camera on and the place of now (José, 24/10)', () => {
  // Arrange: Inframaq's attendance form, with a location and a selfie.
  const attendance = { id: 'registrar_asistencia', title: 'Marcar asistencia', schema: { type: 'object', properties: { accion: { type: 'string', enum: ['ingreso', 'salida'] }, ubicacion: { type: 'object', 'x-input': 'location' }, foto: { type: 'string', 'x-input': 'photo' } }, required: ['accion', 'ubicacion', 'foto'] } };
  const fields = formFields(attendance);
  const sent = (age?: number) => ({ accion: 'ingreso', foto: 'f1', ubicacion: { lat: -11.98, lng: -76.95, precision: 5, ...(age !== undefined ? { age } : {}) } });

  it('the photo of a form with a location is a live selfie; a photo alone is not', () => {
    expect(liveSelfieFieldOf(fields)?.name).toBe('foto');
    expect(liveSelfieFieldOf(fields.filter((field) => field.kind !== 'location'))).toBeNull();
  });

  it('a reading of seconds ago signs; an old one, a negative age or none is refused', () => {
    expect(validateFormValues(fields, sent(10_000), { requireFresh: true })).toMatchObject({ ok: true, values: { ubicacion: { age: 10_000 } } });
    expect(validateFormValues(fields, sent(FRESH_LOCATION_MS + 1), { requireFresh: true })).toEqual({ ok: false, errors: { ubicacion: 'Tu ubicación no es de ahora: vuelve a marcar.' } });
    expect(validateFormValues(fields, sent(-5), { requireFresh: true })).toMatchObject({ ok: false });
    expect(validateFormValues(fields, sent(), { requireFresh: true })).toEqual({ ok: false, errors: { ubicacion: 'Actualiza Lilachat: para marcar se lee tu ubicación de ahora.' } });
  });

  it('without the check (the phone before it sends) only the fields are checked', () => {
    expect(validateFormValues(fields, sent()).ok).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { FRESH_LOCATION_MS, filterChoiceOptions, formFields, initialValues, liveSelfieFieldOf, matchSpan, validateFormSpec, validateFormValues, visibleFields, type FormField } from './appForms.js';

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
      { kind: 'choice', name: 'accion', label: 'Acción', required: true, segmented: true, searchable: false, options: [{ value: 'ingreso', label: 'Ingreso' }, { value: 'refrigerio', label: 'Refrigerio' }, { value: 'retorno', label: 'Retorno' }, { value: 'salida', label: 'Salida' }] },
      { kind: 'location', name: 'ubicacion', label: 'Tu ubicación', required: true },
      { kind: 'photo', name: 'foto', label: 'Selfie', help: 'Una foto tuya al marcar', required: true, multiple: false, max: 1, min: 1 },
      { kind: 'text', name: 'actividades', label: 'Actividades del día', required: false, multiline: true, maxLength: 300 },
    ]);
  });

  it('a number with its unit and range, a long enum as a list, a date, and a label from the name when there is no title', () => {
    const fields = formFields({ id: 'medida', title: 'Medida', schema: { type: 'object', properties: { nivel: { type: 'number', 'x-unit': 'gl', minimum: 0, maximum: 20000 }, tanque: { type: 'string', enum: ['t1', 't2', 't3', 't4', 't5'] }, fecha: { type: 'string', format: 'date' }, nota_corta: { type: 'string' } } } });
    expect(fields).toEqual<FormField[]>([
      { kind: 'number', name: 'nivel', label: 'Nivel', required: false, unit: 'gl', min: 0, max: 20000, integer: false },
      { kind: 'choice', name: 'tanque', label: 'Tanque', required: false, segmented: false, searchable: false, options: ['t1', 't2', 't3', 't4', 't5'].map((value) => ({ value, label: value.toUpperCase() })) },
      { kind: 'date', name: 'fecha', label: 'Fecha', required: false, mode: 'date' },
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
    // The app gets exactly its schema: `age` is checked here and never sent (agentes, 24/10).
    expect(validateFormValues(fields, sent(10_000), { requireFresh: true })).toEqual({ ok: true, values: { accion: 'ingreso', foto: 'f1', ubicacion: { lat: -11.98, lng: -76.95, precision: 5 } } });
    expect(validateFormValues(fields, sent(FRESH_LOCATION_MS + 1), { requireFresh: true })).toEqual({ ok: false, errors: { ubicacion: 'Tu ubicación no es de ahora: vuelve a marcar.' } });
    expect(validateFormValues(fields, sent(-5), { requireFresh: true })).toMatchObject({ ok: false });
    expect(validateFormValues(fields, sent(), { requireFresh: true })).toEqual({ ok: false, errors: { ubicacion: 'Actualiza Lilachat: para marcar se lee tu ubicación de ahora.' } });
  });

  it('without the check (the phone before it sends) only the fields are checked', () => {
    expect(validateFormValues(fields, sent()).ok).toBe(true);
  });
});

describe('Portal\'s tank and material lists (E2E 24/10: ids on screen, a repeated id, a cut button)', () => {
  it('names options from oneOf const/title, keeps a repeated value once, and cuts the button at a whole word', () => {
    // Arrange
    const form = {
      id: 'registrar_movimiento_material',
      title: 'Registrar un movimiento de material',
      submit_label: 'Registrar un movimiento de material en la planta',
      schema: { type: 'object', properties: {
        material: { type: 'string', oneOf: [{ const: '857dd79f06bed055e71a8579', title: 'Arena gruesa' }, { const: '857dd79f06bed055e71a8579', title: 'Arena gruesa' }, { const: '69f0e162bd9a0af2ba5b28e2', title: 'Piedra chancada' }] },
        tanque: { type: 'string', enum: ['a1', 'a1', 'b2'] },
      }, required: ['material'] },
    };
    // Act
    const spec = validateFormSpec(form);
    const [material, tanque] = formFields(spec.ok ? spec.form : form);
    // Assert
    expect(spec.ok && spec.form.submitLabel).toBe('Registrar un movimiento de material en…');
    expect(material).toMatchObject({ kind: 'choice', options: [{ value: '857dd79f06bed055e71a8579', label: 'Arena gruesa' }, { value: '69f0e162bd9a0af2ba5b28e2', label: 'Piedra chancada' }] });
    expect(tanque).toMatchObject({ options: [{ value: 'a1', label: 'A1' }, { value: 'b2', label: 'B2' }] });
    expect(validateFormValues(formFields(form), { material: '69f0e162bd9a0af2ba5b28e2' })).toEqual({ ok: true, values: { material: '69f0e162bd9a0af2ba5b28e2' } });
  });
});

describe('marking attendance by name: the company\'s list and the PIN (agentes, 24/10; design e-35)', () => {
  const people = Array.from({ length: 31 }, (_, index) => ({ const: `e${index}`, title: `Persona ${index}`, description: 'Operador' }));
  people[0] = { const: 'e0', title: 'José Zamora', description: 'Gerente' };
  people[1] = { const: 'e1', title: 'Josefina Ramos', description: 'Asistente administrativa' };
  const form = { id: 'registrar_asistencia', title: 'Marcar asistencia', schema: { type: 'object', properties: {
    empleadoId: { type: 'string', title: '¿Quién eres?', oneOf: people },
    accion: { type: 'string', enum: ['ingreso', 'salida'] },
    pin: { type: 'string', 'x-input': 'pin', default: '1234' },
  }, required: ['empleadoId', 'accion'] } };

  it('more than 8 options is a field with a search; 4 or fewer stay side by side; the role comes as the line under', () => {
    // Act
    const [person, action, pin] = formFields(form);
    // Assert
    expect(person).toMatchObject({ kind: 'choice', searchable: true, segmented: false });
    expect(person!.kind === 'choice' && person.options[0]).toEqual({ value: 'e0', label: 'José Zamora', sub: 'Gerente' });
    expect(action).toMatchObject({ kind: 'choice', searchable: false, segmented: true });
    expect(pin).toEqual({ name: 'pin', label: 'Pin', required: false, kind: 'text', multiline: false, maxLength: 8, secret: true });
  });

  it('a list of records (database ids) is always a dropdown, even with three; fixed choices stay side by side', () => {
    // Arrange: the material reception (José, 24/10: «quién trajo el material y de qué cantera, lista desplegable»)
    const reception = { id: 'registrar_recepcion_material', title: 'Ingreso', schema: { type: 'object', properties: {
      canteraId: { type: 'string', title: 'Cantera', enum: ['69d9f2ad975db728c8790e2b', '69d9f1f2975db728c8790dd4', '69d9f175975db728c8790d7f'], 'x-labels': { '69d9f2ad975db728c8790e2b': 'CARLONCHO', '69d9f1f2975db728c8790dd4': 'CRUSHING', '69d9f175975db728c8790d7f': 'GLOBAL' } },
      sedeId: { type: 'string', oneOf: [{ const: '3fa85f64-5717-4562-b3fc-2c963f66afa6', title: 'Almacén Ate' }, { const: '9b2f7c1e-0d4a-4c8e-8f1a-6e2b3c4d5e6f', title: 'Planta Lurín' }] },
      evento: { type: 'string', enum: ['medida', 'recarga', 'ajuste'] },
    } } };
    // Act
    const [cantera, sede, evento] = formFields(reception);
    // Assert
    expect(cantera).toMatchObject({ kind: 'choice', searchable: true, segmented: false });
    expect(sede).toMatchObject({ kind: 'choice', searchable: true, segmented: false });
    expect(evento).toMatchObject({ kind: 'choice', searchable: false, segmented: true });
  });

  it('fixed choices with long names are a dropdown too: side by side they shrank to unreadable (the mix designs)', () => {
    const order = { id: 'pedido', title: 'Pedido', schema: { type: 'object', properties: {
      diseno: { type: 'string', enum: ['MAC-2 - Mezcla asfáltica en caliente para capa de rodadura', 'MAC-3 - Mezcla asfáltica para vías urbanas', 'Mac 1 - Diseno base para pruebas'] },
      conDespacho: { type: 'string', enum: ['con_despacho', 'solo_pedido'], 'x-labels': { con_despacho: 'Con viaje', solo_pedido: 'Solo el pedido' } },
    } } };
    const [diseno, conDespacho] = formFields(order);
    expect(diseno).toMatchObject({ kind: 'choice', searchable: true, segmented: false });
    expect(conDespacho).toMatchObject({ kind: 'choice', searchable: false, segmented: true });
  });

  it('the search ignores accents and capitals and tells where it falls', () => {
    const [person] = formFields(form);
    const options = person!.kind === 'choice' ? person.options : [];
    expect(filterChoiceOptions(options, 'JOSE').map((option) => option.label)).toEqual(['José Zamora', 'Josefina Ramos']);
    expect(filterChoiceOptions(options, '  ').length).toBe(31);
    expect(filterChoiceOptions(options, 'xyz')).toEqual([]);
    expect(matchSpan('José Zamora', 'jose')).toEqual({ start: 0, end: 4 });
    expect(matchSpan('María José', 'JOSE')).toEqual({ start: 6, end: 10 });
    expect(matchSpan('Ana', 'jose')).toBeNull();
  });

  it('a PIN takes digits only, never starts filled, and may be left out', () => {
    const fields = formFields(form);
    expect(initialValues(fields)).toEqual({});
    expect(validateFormValues(fields, { empleadoId: 'e0', accion: 'ingreso', pin: '12 34' })).toEqual({ ok: true, values: { empleadoId: 'e0', accion: 'ingreso', pin: '1234' } });
    expect(validateFormValues(fields, { empleadoId: 'e0', accion: 'ingreso', pin: '12a4' })).toEqual({ ok: false, errors: { pin: 'Solo números.' } });
    expect(validateFormValues(fields, { empleadoId: 'e0', accion: 'ingreso' })).toEqual({ ok: true, values: { empleadoId: 'e0', accion: 'ingreso' } });
  });
});

describe('several photos, each removable (José, 24/10: the tank tape and the material receipt)', () => {
  const form = { id: 'registrar_medida_tanque', title: 'Registrar una medida de tanque', schema: { type: 'object', properties: {
    fotos: { type: 'array', 'x-input': 'photo', minItems: 2, maxItems: 4, title: 'Fotos de la wincha' },
    ubicacion: { type: 'object', 'x-input': 'location' },
  }, required: [] } };

  it('an array with x-input photo is a list with its bounds; it is never the signature selfie', () => {
    // Act
    const fields = formFields(form);
    // Assert
    expect(fields[0]).toMatchObject({ kind: 'photo', multiple: true, min: 2, max: 4, required: true });
    expect(liveSelfieFieldOf(fields)).toBeNull();
    expect(formFields({ ...form, schema: { ...form.schema, properties: { fotos: { type: 'array', 'x-input': 'photo', maxItems: 50 } } } })[0]).toMatchObject({ multiple: true, max: 10, min: 0, required: false });
  });

  it('takes between min and max photos and says how many are missing', () => {
    const fields = formFields(form).slice(0, 1);
    expect(validateFormValues(fields, { fotos: ['f1', 'f2'] })).toEqual({ ok: true, values: { fotos: ['f1', 'f2'] } });
    expect(validateFormValues(fields, { fotos: ['f1'] })).toEqual({ ok: false, errors: { fotos: 'Faltan fotos: van al menos 2.' } });
    expect(validateFormValues(fields, { fotos: [] })).toEqual({ ok: false, errors: { fotos: 'Falta la foto.' } });
    expect(validateFormValues(fields, { fotos: ['1', '2', '3', '4', '5'] })).toEqual({ ok: false, errors: { fotos: 'Hasta 4 fotos.' } });
  });
});

describe('dates and times with a picker, today by default (José, 24/10: «fecha actual siempre y un selector de fecha, no un input»)', () => {
  const order = { id: 'pedido', title: 'Pedido', schema: { type: 'object', properties: {
    fecha: { type: 'string', format: 'date' },
    hora: { type: 'string', format: 'time' },
    llegada: { type: 'string', format: 'date-time' },
    entrega: { type: 'string', format: 'date', default: '2026-11-02' },
  } } };
  const now = new Date(2026, 9, 24, 8, 5);

  it('a date starts on today, a moment on now, a time stays empty; a default from the app wins', () => {
    // Act
    const fields = formFields(order);
    // Assert
    expect(fields.map((field) => field.kind === 'date' && field.mode)).toEqual(['date', 'time', 'date-time', 'date']);
    expect(initialValues(fields, now)).toEqual({ fecha: '2026-10-24', llegada: '2026-10-24T08:05', entrega: '2026-11-02' });
  });

  it('a default that is not a date of that kind is ignored: the field still starts on today', () => {
    const fields = formFields({ id: 'pedido', title: 'Pedido', schema: { type: 'object', properties: { fecha: { type: 'string', format: 'date', default: 'hoy' }, hora: { type: 'string', format: 'time', default: '7:30' } } } });
    expect(initialValues(fields, now)).toEqual({ fecha: '2026-10-24', hora: '07:30' });
  });

  it('a required date or time says what is missing in its own words', () => {
    const fields = formFields({ id: 'pedido', title: 'Pedido', schema: { type: 'object', required: ['fecha', 'hora'], properties: { fecha: { type: 'string', format: 'date' }, hora: { type: 'string', format: 'time' } } } });
    expect(validateFormValues(fields, {})).toEqual({ ok: false, errors: { fecha: 'Elige una fecha.', hora: 'Elige una hora.' } });
  });

  it('takes a time as HH:MM in 24 h and a date that exists', () => {
    const fields = formFields(order);
    expect(validateFormValues(fields, { fecha: '2026-10-24', hora: '07:30' })).toEqual({ ok: true, values: { fecha: '2026-10-24', hora: '07:30' } });
    expect(validateFormValues(fields, { hora: '25:00' })).toEqual({ ok: false, errors: { hora: 'La hora no es válida.' } });
    expect(validateFormValues(fields, { fecha: 'mañana' })).toEqual({ ok: false, errors: { fecha: 'La fecha no es válida.' } });
  });
});

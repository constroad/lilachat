import { describe, expect, it } from 'vitest';
import { formRows } from './appFormRows.js';
import { formFields, validateFormSpec, type AppForm, type FormField } from './appForms.js';
import { wantsWorkStreets, gpsGroupOf, gpsValuesOf, nearestStreet, placeAutofill, precisionNoteOf, readingOf, streetOptionsOf, workFieldsOf } from './fieldAutofill.js';
import type { WorkMapStreet } from './workMap.js';

/** Portal's CON-CAP «punto» section (8bc64e18), as the field document sends it. */
const pointForm: AppForm = {
  id: 'punto',
  title: 'Punto 2',
  schema: {
    type: 'object',
    required: ['densidadCampo'],
    properties: {
      lat: { type: 'number', title: 'Latitud', 'x-input': 'gps' },
      lng: { type: 'number', title: 'Longitud', 'x-input': 'gps' },
      precisionM: { type: 'number', title: 'Precisión', 'x-input': 'gps', 'x-unit': 'm' },
      calleId: { type: 'string', title: 'Calle', 'x-input': 'work-street' },
      progresiva: { type: 'string', title: 'Progresiva', 'x-input': 'work-station' },
      densidadCampo: { type: 'number', title: 'Densidad de campo', 'x-unit': 'g/cm³' },
    },
  },
};
const fieldsOf = (form: AppForm): FormField[] => formFields(form);

/** Two real-looking streets in Lima, ~110 m long, ids as Portal's WorkStreet `_id`. */
const AVENUE: WorkMapStreet = { id: '6731f0a2c4e8b91d2a7f0011', name: 'Av. Los Héroes', line: [{ lat: -12.1, lng: -77.0 }, { lat: -12.1, lng: -76.999 }], lengthM: 109 };
const SIDE_STREET: WorkMapStreet = { id: '6731f0a2c4e8b91d2a7f0022', name: 'Jr. Puno', line: [{ lat: -12.1, lng: -77.0 }, { lat: -12.101, lng: -77.0 }], lengthM: 111 };
const STREETS = [AVENUE, SIDE_STREET];
/** ~5 m north of Av. Los Héroes, 60 m from its start. */
const ON_HEROES = { lat: -12.09996, lng: -76.99945, precision: 6 };

describe('the CON-CAP point form', () => {
  it('draws: the three gps numbers carry their role, the street and the station are marked', () => {
    // Arrange / Act
    const fields = fieldsOf(pointForm);
    // Assert
    expect(fields.find((field) => field.name === 'lat')).toMatchObject({ kind: 'number', gps: 'lat' });
    expect(fields.find((field) => field.name === 'precisionM')).toMatchObject({ kind: 'number', gps: 'precision' });
    expect(fields.find((field) => field.name === 'calleId')).toMatchObject({ kind: 'text', street: true });
    expect(fields.find((field) => field.name === 'progresiva')).toMatchObject({ kind: 'text', station: true });
  });

  it('refuses a gps on a text or a gps number whose name says no role', () => {
    const onText = validateFormSpec({ ...pointForm, schema: { type: 'object', properties: { lat: { type: 'string', 'x-input': 'gps' } } } });
    const unnamed = validateFormSpec({ ...pointForm, schema: { type: 'object', properties: { altura: { type: 'number', 'x-input': 'gps' } } } });
    expect(onText).toMatchObject({ ok: false, message: expect.stringMatching(/no sabe dibujar/) });
    expect(unnamed).toMatchObject({ ok: false, message: expect.stringMatching(/no sabe dibujar/) });
  });
});

describe('gps group', () => {
  it('finds lat, lng and precision; without lat and lng there is no group', () => {
    const fields = fieldsOf(pointForm);
    expect(gpsGroupOf(fields)).toEqual({ lat: 'lat', lng: 'lng', precision: 'precisionM' });
    expect(gpsGroupOf(fields.filter((field) => field.name !== 'lng'))).toBeNull();
  });

  it('a reading writes the three numbers, rounded (7 decimals, whole meters)', () => {
    const values = gpsValuesOf({ lat: 'lat', lng: 'lng', precision: 'precisionM' }, { lat: -12.099961234567, lng: -76.999451234567, precision: 6.4 });
    expect(values).toEqual({ lat: -12.0999612, lng: -76.9994512, precisionM: 6 });
  });

  it('reads the reading back, also from a refused form that came back as text', () => {
    const group = { lat: 'lat', lng: 'lng', precision: 'precisionM' };
    expect(readingOf(group, { lat: '-12.1', lng: '-77', precisionM: '8' })).toEqual({ lat: -12.1, lng: -77, precision: 8 });
    expect(readingOf(group, { lat: -12.1 })).toBeNull();
    expect(readingOf(group, { lat: 120, lng: -77 })).toBeNull();
  });
});

describe('precision note', () => {
  it('up to 15 m is a good reading; more is approximate (the point is saved anyway)', () => {
    expect(precisionNoteOf(15)).toEqual({ tone: 'ok', text: 'Precisión ± 15 m' });
    expect(precisionNoteOf(32.4)).toEqual({ tone: 'warn', text: 'Ubicación aproximada (± 32 m). Espera unos segundos y vuelve a tomarla.' });
    expect(precisionNoteOf(undefined)).toEqual({ tone: 'warn', text: 'Sin precisión del GPS.' });
  });
});

describe('nearest street', () => {
  it('the street under the engineer, with how far along it the point is', () => {
    const near = nearestStreet(STREETS, ON_HEROES);
    expect(near?.id).toBe(AVENUE.id);
    expect(near?.distanceM).toBeLessThan(10);
    expect(near?.measureM).toBeGreaterThan(55);
    expect(near?.measureM).toBeLessThan(65);
  });

  it('nothing beyond 40 m, nor with no streets', () => {
    expect(nearestStreet(STREETS, { lat: -12.0995, lng: -76.9995, precision: 5 })).toBeNull();
    expect(nearestStreet([], ON_HEROES)).toBeNull();
  });
});

describe('place autofill', () => {
  const fields = fieldsOf(pointForm);

  it('an empty point gets its street and its station from the reading', () => {
    const patch = placeAutofill({ fields, values: {}, streets: STREETS, reading: ON_HEROES, written: {} });
    expect(patch).toEqual({ calleId: AVENUE.id, progresiva: '0+060' });
  });

  it('never writes over what the engineer chose or typed', () => {
    const patch = placeAutofill({ fields, values: { calleId: SIDE_STREET.id, progresiva: '0+200' }, streets: STREETS, reading: ON_HEROES, written: {} });
    expect(patch).toEqual({});
  });

  it('«Volver a tomar» near another street: what Lilachat wrote follows the new reading', () => {
    // Arrange: Lilachat had picked Av. Los Héroes; the engineer walked 50 m down Jr. Puno
    const written = { calleId: AVENUE.id, progresiva: '0+060' };
    // Act
    const patch = placeAutofill({ fields, values: { ...written }, streets: STREETS, reading: { lat: -12.10045, lng: -76.99998, precision: 5 }, written });
    // Assert
    expect(patch).toEqual({ calleId: SIDE_STREET.id, progresiva: '0+050' });
  });

  it('the engineer picks a street far from the reading: Lilachat\'s station is cleared, never left wrong', () => {
    const patch = placeAutofill({ fields, values: { calleId: SIDE_STREET.id, progresiva: '0+060' }, streets: STREETS, reading: ON_HEROES, written: { calleId: AVENUE.id, progresiva: '0+060' } });
    expect(patch).toEqual({ progresiva: '' });
  });

  it('far from every street, nothing is guessed', () => {
    expect(placeAutofill({ fields, values: {}, streets: STREETS, reading: { lat: -12.0995, lng: -76.9995, precision: 5 }, written: {} })).toEqual({});
  });

  it('the general section (a street, no station, no gps) still gets the street', () => {
    const general = fieldsOf({ id: 'general', title: 'General', schema: { properties: { calleTramoId: { type: 'string', title: 'Calle del tramo', 'x-input': 'work-street' } } } });
    expect(workFieldsOf(general)).toEqual({ street: 'calleTramoId' });
    expect(placeAutofill({ fields: general, values: {}, streets: STREETS, reading: ON_HEROES, written: {} })).toEqual({ calleTramoId: AVENUE.id });
  });
});

describe('street options', () => {
  it('the map streets by name; with a reading, the nearest first and how far', () => {
    expect(streetOptionsOf(STREETS, null).map((option) => option.label)).toEqual(['Av. Los Héroes', 'Jr. Puno']);
    const near = streetOptionsOf([SIDE_STREET, AVENUE], ON_HEROES);
    expect(near[0]).toEqual({ value: AVENUE.id, label: 'Av. Los Héroes', sub: 'a 4 m' });
  });

  it('a street with no name still has a label', () => {
    expect(streetOptionsOf([{ ...SIDE_STREET, name: '' }], null)[0]?.label).toBe('Calle sin nombre');
  });
});

describe('drawing', () => {
  it('the gps block and the street picker take the whole row', () => {
    const rows = formRows(fieldsOf(pointForm));
    expect(rows.find((row) => row.some((field) => field.name === 'lat'))).toHaveLength(1);
    expect(rows.find((row) => row.some((field) => field.name === 'calleId'))).toHaveLength(1);
  });

  it('only a form with a street or a station asks for the work map', () => {
    expect(wantsWorkStreets(pointForm)).toBe(true);
    expect(wantsWorkStreets({ id: 'x', title: 'X', schema: { properties: { lat: { type: 'number', 'x-input': 'gps' } } } })).toBe(false);
    expect(wantsWorkStreets(undefined)).toBe(false);
  });
});

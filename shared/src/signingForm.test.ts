import { describe, expect, it } from 'vitest';
import { chipLabelOf, chipsFor, placeKeyOf, signerFieldOf, signingPlaceLine, signingStepOf } from './signingForm.js';
import type { FormField } from './appForms.js';

const ANA = '6ad95d52d225a79c08002e24';
const LUIS = '6ad95d52d225a79c08002e25';
const base = { label: 'Campo', required: true };
const people: FormField = { ...base, kind: 'choice', name: 'empleadoId', segmented: false, searchable: true, options: [{ value: ANA, label: 'Ana Torres' }, { value: LUIS, label: 'Luis Rojas' }] };
const action: FormField = {
  ...base,
  kind: 'choice',
  name: 'accion',
  segmented: false,
  searchable: true,
  options: [{ value: 'ingreso', label: 'Ingreso' }, { value: 'refrigerio', label: 'Salida a refrigerio' }],
};
const photo = { ...base, kind: 'photo', name: 'foto', multiple: false, max: 1, min: 1 } as FormField;
const location: FormField = { ...base, kind: 'location', name: 'ubicacion' };

describe('who signs (José 06/11: the name first, like Portal, and only then the camera)', () => {
  it('finds the list of people of a signing, whatever its place among the fields', () => {
    expect(signerFieldOf([action, people, photo, location])?.name).toBe('empleadoId');
  });

  it('a form that is not a signing has no signer: it stays one sheet', () => {
    expect(signerFieldOf([people, action])).toBeNull();
  });

  it('a signing with fixed choices only is the person signing for themselves', () => {
    expect(signerFieldOf([action, photo, location])).toBeNull();
  });

  it('opens on the cards, and passes to the camera once a name is picked', () => {
    // Arrange
    const fields = [people, action, photo, location];
    // Act and assert
    expect(signingStepOf(fields, {})).toBe('who');
    expect(signingStepOf(fields, { empleadoId: '' })).toBe('who');
    expect(signingStepOf(fields, { empleadoId: ANA })).toBe('sign');
  });

  it('with nobody to pick, the signing goes straight to the camera', () => {
    expect(signingStepOf([action, photo, location], {})).toBe('sign');
  });
});

describe('the chips of a signing (José 06/11: in one line, not a selector)', () => {
  it('a fixed choice of a signing is chips; the people never are', () => {
    // Arrange
    const fields = [people, action, photo, location];
    // Act and assert
    expect(chipsFor(fields, action)).toBe(true);
    expect(chipsFor(fields, people)).toBe(false);
  });

  it('outside a signing, or with too many options for a line, a choice stays as it was', () => {
    // Arrange
    const many: FormField = { ...action, options: Array.from({ length: 7 }, (_, index) => ({ value: `opcion${index}`, label: `Opción ${index}` })) };
    // Act and assert
    expect(chipsFor([people, action], action)).toBe(false);
    expect(chipsFor([many, photo, location], many)).toBe(false);
  });

  it('a long label gives way to the option\'s own word, so the four fit in a line', () => {
    expect(chipLabelOf({ value: 'refrigerio', label: 'Salida a refrigerio' })).toBe('Refrigerio');
    expect(chipLabelOf({ value: 'retorno', label: 'Retorno de refrigerio' })).toBe('Retorno');
    expect(chipLabelOf({ value: 'ingreso', label: 'Ingreso' })).toBe('Ingreso');
  });

  it('keeps a long label when its value is not a word to show', () => {
    expect(chipLabelOf({ value: 'opt_2', label: 'Salida a refrigerio' })).toBe('Salida a refrigerio');
  });
});

describe('placeKeyOf', () => {
  it('the same block reads as the same place, so a GPS that refines does not ask again', () => {
    expect(placeKeyOf({ lat: -12.02177, lng: -76.88174, precision: 12 })).toBe(placeKeyOf({ lat: -12.02181, lng: -76.88169, precision: 5 }));
  });

  it('another block is another place', () => {
    expect(placeKeyOf({ lat: -12.02177, lng: -76.88174, precision: 12 })).not.toBe(placeKeyOf({ lat: -12.0235, lng: -76.88174, precision: 12 }));
  });
});

describe('signingPlaceLine (José 06/11: the camera shows the address, not coordinates)', () => {
  const point = { lat: -12.02177, lng: -76.88174, precision: 12 };

  it('with the address, the address and how sure the reading is', () => {
    expect(signingPlaceLine(point, 'Avenida Lima 123, Lurigancho')).toBe('Avenida Lima 123, Lurigancho · ± 12 m');
  });

  it('while it is asked, it says so', () => {
    expect(signingPlaceLine(point, undefined)).toBe('Buscando la dirección… · ± 12 m');
  });

  it('with no address it never falls back on coordinates here: the reading is good all the same', () => {
    expect(signingPlaceLine(point, null)).toBe('Ubicación lista · ± 12 m');
  });

  it('with no reading yet, it says it is looking', () => {
    expect(signingPlaceLine(null, undefined)).toBe('Buscando tu ubicación…');
  });
});

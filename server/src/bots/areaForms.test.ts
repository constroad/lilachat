import { describe, expect, it, vi } from 'vitest';

vi.mock('@lilachat/shared', async (original) => ({ ...(await original<typeof import('@lilachat/shared')>()), AREAS_OPEN_HERE: true }));

const { areaFormInputOf, areaFormPrepared, isAreaFormKind } = await import('./areaForms.js');

const ENTRY = '3f2a9c1e-8b7d-4c6e-9a5b-1d2e3f4a5b6c';
const SERVICE = '6aed0a1b2c3d4e5f60718293';
const sides = { kind: 'area_create', entry_id: ENTRY, length_m: 3.2, width_m: 1.5, area_m2: 4.8, thickness_cm: 5, method: 'medidas-iphone', lat: -12.05, lng: -77.03, precision_m: 22, source: 'web', report_id: 'r9' };

describe('additional area forms (Portal 12/11, proposed contract)', () => {
  it('knows its kind', () => {
    expect(isAreaFormKind('area_create')).toBe(true);
    expect(isAreaFormKind('observation_register')).toBe(false);
  });

  it('an iPhone area carries its figures, method, place and report as values; the two texts are optional', () => {
    const ready = areaFormPrepared(SERVICE, areaFormInputOf(sides)!);

    expect(ready.form).toMatchObject({ id: 'registrar_area_adicional', submitLabel: 'Guardar área' });
    expect(ready.form.schema.required ?? []).toEqual([]);
    expect(Object.keys(ready.form.schema.properties ?? {})).toEqual(['ubicacion', 'descripcion']);
    expect(ready.context).toEqual({ servicioId: SERVICE, kind: 'crear', entradaId: ENTRY, largoM: 3.2, anchoM: 1.5, areaM2: 4.8, espesorCm: 5, metodo: 'medidas-iphone', lat: -12.05, lng: -77.03, precisionM: 22, fuente: 'web', informeId: 'r9' });
  });

  it('a direct area without GPS goes with only what it has', () => {
    const ready = areaFormPrepared(SERVICE, areaFormInputOf({ kind: 'area_create', entry_id: ENTRY, area_m2: 17.6, method: 'a-mano', source: 'apk' })!);

    expect(ready.context).toEqual({ servicioId: SERVICE, kind: 'crear', entradaId: ENTRY, areaM2: 17.6, metodo: 'a-mano', fuente: 'apk' });
  });

  it.each([
    ['an entry that is not a uuid', { entry_id: 'abc' }],
    ['an area under 0,05 m²', { area_m2: 0.04, length_m: undefined, width_m: undefined }],
    ['an area over 5 000 m²', { area_m2: 5000.5, length_m: undefined, width_m: undefined }],
    ['one side without the other', { width_m: undefined }],
    ['a side over 500 m', { length_m: 600 }],
    ['an area that is not its sides', { area_m2: 9 }],
    ['a thickness over 50 cm', { thickness_cm: 60 }],
    ['the AR method, not built yet', { method: 'ar-app' }],
    ['Portal\'s own photo method', { method: 'foto-medida' }],
    ['half a place', { lng: undefined }],
    ['an unknown source', { source: 'desktop' }],
  ])('refuses %s', (_why, change) => {
    expect(areaFormInputOf({ ...sides, ...change })).toBeNull();
  });

  it('a precision out of range goes as nothing, not as a refusal', () => {
    expect(areaFormPrepared(SERVICE, areaFormInputOf({ ...sides, precision_m: 9000 })!).context).not.toHaveProperty('precisionM');
  });
});

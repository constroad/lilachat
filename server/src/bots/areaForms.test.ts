import { describe, expect, it, vi } from 'vitest';

vi.mock('@lilachat/shared', async (original) => ({ ...(await original<typeof import('@lilachat/shared')>()), AREAS_OPEN_HERE: true }));

const { AREA_FORM_KINDS, areaFormInputOf, areaFormPrepared, isAreaFormKind } = await import('./areaForms.js');

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

  it('an AR figure from the web is refused: only the APK measures with ARCore', () => {
    expect(areaFormInputOf({ kind: 'area_create', entry_id: ENTRY, area_m2: 4.81, method: 'ar-app', source: 'web' })).toBeNull();
  });

  it('every area kind is one the route opens (area_edit fell to «Publicar» on 15/11)', () => {
    expect([...AREA_FORM_KINDS].sort()).toEqual(['area_create', 'area_edit', 'area_remove']);
    for (const kind of AREA_FORM_KINDS) expect(isAreaFormKind(kind)).toBe(true);
    expect(isAreaFormKind('publish')).toBe(false);
  });

  it('an edit (la-06) goes as Portal\'s editar with the whole measure again', () => {
    const ready = areaFormPrepared(SERVICE, areaFormInputOf({ kind: 'area_edit', area_id: 'z-1', area_m2: 0.53, thickness_cm: 5, method: 'ar', lat: -12.01, lng: -76.9, precision_m: 6, source: 'apk', report_id: 'r1' })!);

    expect(ready.form).toMatchObject({ title: 'Editar zona', submitLabel: 'Guardar cambios' });
    expect(ready.context).toEqual({ servicioId: SERVICE, kind: 'editar', areaId: 'z-1', areaM2: 0.53, espesorCm: 5, metodo: 'ar', lat: -12.01, lng: -76.9, precisionM: 6, fuente: 'apk', informeId: 'r1' });
  });

  it.each([
    ['without the area', { area_id: '' }],
    ['an area out of Portal\'s range', { area_m2: 0.01 }],
    ['an AR area edited from the web', { source: 'web' }],
  ])('an edit %s is refused', (_label, change) => {
    expect(areaFormInputOf({ kind: 'area_edit', area_id: 'z-1', area_m2: 0.53, method: 'ar', source: 'apk', ...change })).toBeNull();
  });

  it('the AR with no tape (ar, «AR» in the PDF) is refused from the web too', () => {
    expect(areaFormInputOf({ kind: 'area_create', entry_id: ENTRY, area_m2: 4.81, method: 'ar', source: 'web' })).toBeNull();
  });

  it('the APK\'s AR with no tape goes as ar (José 15/11: the PDF says «AR»)', () => {
    const ready = areaFormPrepared(SERVICE, areaFormInputOf({ kind: 'area_create', entry_id: ENTRY, area_m2: 4.81, method: 'ar', source: 'apk' })!);

    expect(ready.context).toMatchObject({ kind: 'crear', areaM2: 4.81, metodo: 'ar', fuente: 'apk' });
  });

  it('the APK\'s AR with the tape goes as ar-app, area alone (José 15/11)', () => {
    const ready = areaFormPrepared(SERVICE, areaFormInputOf({ kind: 'area_create', entry_id: ENTRY, area_m2: 4.81, thickness_cm: 5.2, method: 'ar-app', source: 'apk' })!);

    expect(ready.context).toMatchObject({ kind: 'crear', areaM2: 4.81, espesorCm: 5.2, metodo: 'ar-app', fuente: 'apk' });
  });

  it.each([
    ['an entry that is not a uuid', { entry_id: 'abc' }],
    ['an area under 0,05 m²', { area_m2: 0.04, length_m: undefined, width_m: undefined }],
    ['an area over 5 000 m²', { area_m2: 5000.5, length_m: undefined, width_m: undefined }],
    ['one side without the other', { width_m: undefined }],
    ['a side over 500 m', { length_m: 600 }],
    ['an area that is not its sides', { area_m2: 9 }],
    ['a thickness over 50 cm', { thickness_cm: 60 }],
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

/** «Quitar área»: Portal's `quitar` takes only the area; its photos go to Portal's trash. */
describe('removing an area', () => {
  it('knows the kind and sends the area as context, nothing to fill', () => {
    expect(isAreaFormKind('area_remove')).toBe(true);
    const ready = areaFormPrepared(SERVICE, areaFormInputOf({ kind: 'area_remove', area_id: 'a-7' })!);
    expect(ready.form).toMatchObject({ id: 'registrar_area_adicional', title: 'Quitar área', submitLabel: 'Quitar' });
    expect(Object.keys(ready.form.schema.properties ?? {})).toEqual([]);
    expect(ready.context).toEqual({ servicioId: SERVICE, kind: 'quitar', areaId: 'a-7' });
  });

  it('without its area, or an id too long, it is a 400 before the door', () => {
    expect(areaFormInputOf({ kind: 'area_remove' })).toBeNull();
    expect(areaFormInputOf({ kind: 'area_remove', area_id: 'x'.repeat(65) })).toBeNull();
  });
});

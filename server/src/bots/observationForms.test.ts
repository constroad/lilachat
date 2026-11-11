import { describe, expect, it, vi } from 'vitest';

vi.mock('@lilachat/shared', async (original) => ({ ...(await original<typeof import('@lilachat/shared')>()), OBSERVATIONS_OPEN_HERE: true }));

const { isObservationFormKind, observationFormInputOf, observationFormPrepared } = await import('./observationForms.js');

const ENTRY = '3f2a9c1e-8b7d-4c6e-9a5b-1d2e3f4a5b6c';
const SERVICE = '6aed0a1b2c3d4e5f60718293';

describe('observation forms (Portal ead85b1a)', () => {
  it('knows its two kinds', () => {
    expect(isObservationFormKind('observation_register')).toBe(true);
    expect(isObservationFormKind('observation_lift')).toBe(true);
    expect(isObservationFormKind('section')).toBe(false);
  });

  it('registering carries the service, the entry and the place as values; the note is optional', () => {
    const input = observationFormInputOf({ kind: 'observation_register', entry_id: ENTRY, lat: -12.05, lng: -77.03, report_id: 'r1' });

    const ready = observationFormPrepared(SERVICE, input!);

    expect(ready.form).toMatchObject({ id: 'registrar_observacion', submitLabel: 'Registrar observación' });
    expect(ready.form.schema.required ?? []).not.toContain('nota');
    expect(ready.form.schema.properties?.nota).toMatchObject({ type: 'string', maxLength: 600 });
    expect(ready.context).toEqual({ servicioId: SERVICE, entradaId: ENTRY, lat: -12.05, lng: -77.03, informeId: 'r1' });
  });

  it('lifting carries the service and the observation; no place nor hour', () => {
    const ready = observationFormPrepared(SERVICE, observationFormInputOf({ kind: 'observation_lift', observation_id: 'o1' })!);

    expect(ready.form).toMatchObject({ id: 'levantar_observacion', submitLabel: 'Marcar como levantada' });
    expect(ready.context).toEqual({ servicioId: SERVICE, observacionId: 'o1' });
  });

  it('refuses an entry that is not a uuid, a place off the map or a missing observation', () => {
    expect(observationFormInputOf({ kind: 'observation_register', entry_id: 'k1', lat: -12, lng: -77 })).toBeNull();
    expect(observationFormInputOf({ kind: 'observation_register', entry_id: ENTRY, lat: 120, lng: -77 })).toBeNull();
    expect(observationFormInputOf({ kind: 'observation_register', entry_id: ENTRY, lat: '-12', lng: -77 })).toBeNull();
    expect(observationFormInputOf({ kind: 'observation_lift' })).toBeNull();
  });
});

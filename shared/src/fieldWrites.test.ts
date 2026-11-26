import { describe, expect, it } from 'vitest';
import { AREA_WRITE } from './additionalArea.js';
import { fieldWriteJobOf, fieldWriteKindOf, fieldWriteLabel } from './fieldWrites.js';
import { OBSERVATION_WRITE } from './observationWrite.js';

describe('fieldWrites', () => {
  it('each write reads Portal\'s answer as its own screen does', () => {
    expect(fieldWriteKindOf('observation')).toBe(OBSERVATION_WRITE);
    expect(fieldWriteKindOf('area')).toBe(AREA_WRITE);
  });

  it('names what waits in the strip', () => {
    expect(fieldWriteLabel({ kind: 'observation_register' })).toBe('Observación nueva');
    expect(fieldWriteLabel({ kind: 'area_create' })).toBe('Área adicional');
    expect(fieldWriteLabel({ kind: 'whatever' })).toBe('Registro de campo');
  });

  it('is an «observation» job of its service', () => {
    const scope = { spaceId: '6650f1a2b3c4d5e6f7a8b9c0', clientId: 'c', serviceId: '66a1b2c3d4e5f6a7b8c9d0e1', chatId: '6651aa00bb11cc22dd33ee44' };
    const job = fieldWriteJobOf({ key: '3f1c2b9a-6d7e-4f80-9a1b-2c3d4e5f6a7b', scope, payload: { write: 'area', request: { kind: 'area_create', entry_id: '3f1c2b9a-6d7e-4f80-9a1b-2c3d4e5f6a7b' }, values: {}, fileFields: {} }, files: [], now: 1 });
    expect(job).toMatchObject({ kind: 'observation', label: 'Área adicional', scope });
  });
});

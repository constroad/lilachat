import { describe, expect, it } from 'vitest';
import { keepConfirmedFields, validateFieldConfirmation } from './prospectFieldConfirm.js';
import type { ProspectField } from './prospectInsight.js';

const FILE = 'a'.repeat(24);
const read: ProspectField = { key: 'cantidad', label: 'Cantidad', value: '1 240 m²', source: 'document', fileId: FILE, confirmed: false };
const byRosa = { id: 'b'.repeat(24), name: 'Rosa Quispe', at: '2026-11-17T20:00:00.000Z' };

describe('validateFieldConfirmation (a seller confirms or corrects what Dali read)', () => {
  it('confirms as it is, or with the right value', () => {
    expect(validateFieldConfirmation({ version: 3, key: 'cantidad' })).toEqual({ ok: true, confirmation: { version: 3, key: 'cantidad' } });
    expect(validateFieldConfirmation({ version: 3, key: 'cantidad', value: '  1 180 m² ' })).toEqual({ ok: true, confirmation: { version: 3, key: 'cantidad', value: '1 180 m²' } });
  });

  it('refuses no version, a bad key, an empty or too long value', () => {
    expect(validateFieldConfirmation({ key: 'cantidad' }).ok).toBe(false);
    expect(validateFieldConfirmation({ version: 1, key: 'Cantidad X' }).ok).toBe(false);
    expect(validateFieldConfirmation({ version: 1, key: 'cantidad', value: '   ' }).ok).toBe(false);
    expect(validateFieldConfirmation({ version: 1, key: 'cantidad', value: 'x'.repeat(201) }).ok).toBe(false);
  });
});

describe('keepConfirmedFields (Dali\'s next PUT does not undo a person\'s confirmation)', () => {
  it('keeps what a person confirmed when Dali sends it again unconfirmed', () => {
    const confirmed = { ...read, value: '1 180 m²', confirmed: true, confirmedBy: byRosa };
    expect(keepConfirmedFields([read, { key: 'lugar', label: 'Lugar', value: 'Ate' }], [confirmed])).toEqual([confirmed, { key: 'lugar', label: 'Lugar', value: 'Ate' }]);
  });

  it('lets Dali win when it sends the field confirmed, and passes everything when nothing was confirmed', () => {
    const confirmed = { ...read, confirmed: true, confirmedBy: byRosa };
    const fromDali = { ...read, value: '1 200 m²', confirmed: true };
    expect(keepConfirmedFields([fromDali], [confirmed])).toEqual([fromDali]);
    expect(keepConfirmedFields([read], undefined)).toEqual([read]);
    expect(keepConfirmedFields([read], [{ ...read, value: 'viejo' }])).toEqual([read]);
  });
});

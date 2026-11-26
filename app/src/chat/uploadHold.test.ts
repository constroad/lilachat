import { describe, expect, it } from 'vitest';
import { uploadHoldStep } from './uploadHold';

describe('uploadHoldStep', () => {
  it('something pending starts the hold (in front, so Android lets the service start)', () => {
    expect(uploadHoldStep({ permanent: false, pending: 3, holding: false })).toBe('hold');
  });

  it('once everything went up, it releases', () => {
    expect(uploadHoldStep({ permanent: false, pending: 0, holding: true })).toBe('release');
  });

  it('nothing pending and no hold: nothing to do', () => {
    expect(uploadHoldStep({ permanent: false, pending: 0, holding: false })).toBe('none');
  });

  it('with «Conexión permanente» its own service keeps the socket', () => {
    expect(uploadHoldStep({ permanent: true, pending: 2, holding: false })).toBe('none');
    expect(uploadHoldStep({ permanent: true, pending: 2, holding: true })).toBe('release');
  });

  it('already holding with work left: nothing changes', () => {
    expect(uploadHoldStep({ permanent: false, pending: 1, holding: true })).toBe('none');
  });
});

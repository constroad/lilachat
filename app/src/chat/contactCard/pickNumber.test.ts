import { describe, expect, it } from 'vitest';
import { pickContactNumber } from './pickNumber';

/** Pending 9: which of a contact's numbers is shared. */
describe('pickContactNumber', () => {
  it('the mobile one first, then the first that has digits', () => {
    expect(pickContactNumber([{ number: '01 555 0000', label: 'home' }, { number: '+51 987 654 321', label: 'mobile' }])).toBe('+51 987 654 321');
    expect(pickContactNumber([{ number: '' }, { number: '912345678', label: 'work' }])).toBe('912345678');
  });

  it('no numbers, nothing to share', () => {
    expect(pickContactNumber([])).toBeNull();
    expect(pickContactNumber(undefined)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { isPipWindow, wantsPip } from './pip';

// José 13/11: «al cambiar de ventana se cuelga la videollamada; debería minimizarse como WhatsApp».
describe('picture in picture of a call', () => {
  it('only an answered video call goes to the small window when the app is left', () => {
    expect(wantsPip({ fase: 'activa', desde: 1, entrante: true, conectadaEn: 2 }, true)).toBe(true);
    expect(wantsPip({ fase: 'activa', desde: 1, entrante: true, conectadaEn: 2 }, false)).toBe(false);
    expect(wantsPip({ fase: 'llamando', desde: 1, entrante: false }, true)).toBe(false);
    expect(wantsPip(null, true)).toBe(false);
  });

  it('the small window is the one far narrower than a phone', () => {
    expect(isPipWindow(411, 914)).toBe(false);
    expect(isPipWindow(914, 411)).toBe(false);
    expect(isPipWindow(180, 320)).toBe(true);
    expect(isPipWindow(0, 0)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { pastedImageName, shouldOfferPaste } from './clipboardImage';

/** José, 21/10: «tomo un screenshot, voy a WhatsApp y me sugiere pegar la imagen; aquí no pasa». */
describe('paste the copied image', () => {
  it('is offered while writing, with an image copied, until dismissed', () => {
    expect(shouldOfferPaste({ focused: true, hasImage: true, dismissed: false, photosAllowed: true })).toBe(true);
    expect(shouldOfferPaste({ focused: false, hasImage: true, dismissed: false, photosAllowed: true })).toBe(false);
    expect(shouldOfferPaste({ focused: true, hasImage: false, dismissed: false, photosAllowed: true })).toBe(false);
    expect(shouldOfferPaste({ focused: true, hasImage: true, dismissed: true, photosAllowed: true })).toBe(false);
  });

  it('is not offered where photos cannot be sent (a secret chat)', () => {
    expect(shouldOfferPaste({ focused: true, hasImage: true, dismissed: false, photosAllowed: false })).toBe(false);
  });

  it('the pasted file gets a readable name', () => {
    expect(pastedImageName(new Date(2026, 9, 21, 9, 5, 7))).toBe('captura-20261021-090507.png');
  });
});

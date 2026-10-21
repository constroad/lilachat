/**
 * Pasting the copied image (José, 21/10: in WhatsApp the keyboard offers to paste
 * a screenshot; here it did not). React Native's text field cannot take an image
 * from the keyboard, so the bar offers it itself while writing.
 */
export function shouldOfferPaste(state: { focused: boolean; hasImage: boolean; dismissed: boolean; photosAllowed: boolean }): boolean {
  return state.focused && state.hasImage && !state.dismissed && state.photosAllowed;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

export function pastedImageName(now: Date): string {
  const day = `${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}`;
  const time = `${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}`;
  return `captura-${day}-${time}.png`;
}

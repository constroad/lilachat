import type { ViewStyle } from 'react-native';

/**
 * The frame a sheet's card sits in: the whole window, with the card on its
 * bottom edge. PURE (a style object), so vitest checks it as is.
 *
 * José 14/11: a frame anchored only by `bottom: 0` (dd315a40) takes its
 * content's height, and a card's `max-h-[70%]` resolved against that on
 * Yoga's second pass: the card was 70 % of itself and the other 30 % was an
 * empty band under it, in every sheet with a percentage. With the window's
 * height the percentage is of the window, and `flex-end` still grows the card
 * upward when its content arrives late («Info», the clip's gallery).
 */
export const SHEET_FRAME = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: 'flex-end',
} as const satisfies ViewStyle;

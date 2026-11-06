/** A card's usual width; narrower phones get less. */
export const CARD_MAX_WIDTH = 320;
const CARD_MIN_WIDTH = 200;
/** The list's padding on both sides (24), the avatar with its gap (52), the card's margin (8) and the air on the right (4). */
const ROW_INSET = 88;

/** The width that leaves a card clear of the right edge: 320 overflowed a 392 dp phone (José 06/11). */
export const cardWidthOf = (windowWidth: number): number => Math.max(CARD_MIN_WIDTH, Math.min(CARD_MAX_WIDTH, windowWidth - ROW_INSET));

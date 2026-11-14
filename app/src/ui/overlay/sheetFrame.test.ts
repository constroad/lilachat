import { describe, expect, it } from 'vitest';
import { SHEET_FRAME } from './sheetFrame';

/**
 * José 14/11: every sheet opened from below showed a big empty band under its
 * last row. The card sat in a frame anchored only by `bottom: 0` (dd315a40),
 * whose height is its content's. A card's `max-h-[70%]` then resolves against
 * that content height on Yoga's second pass: the card is 70 % of itself and
 * the frame's other 30 % stays empty below it. The frame must have the
 * window's height, so a percentage means a percentage of the window.
 */
describe('SHEET_FRAME', () => {
  it('spans the whole window, so a card percentage resolves against it', () => {
    // Arrange
    const frame = SHEET_FRAME;
    // Act
    const definiteHeight = frame.top === 0 && frame.bottom === 0;
    // Assert
    expect(frame.position).toBe('absolute');
    expect(definiteHeight).toBe(true);
    expect(frame).not.toHaveProperty('maxHeight');
  });

  it('keeps the card on the bottom edge, so content that loads later grows it upward', () => {
    expect(SHEET_FRAME.justifyContent).toBe('flex-end');
    expect(SHEET_FRAME.left).toBe(0);
    expect(SHEET_FRAME.right).toBe(0);
  });
});

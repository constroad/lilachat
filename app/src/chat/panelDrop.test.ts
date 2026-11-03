import { describe, expect, it } from 'vitest';
import { offsetWhileDropping } from './panelDrop';

/**
 * Closing the emoji panel at the end of a chat: the content comes down with the
 * panel, frame by frame. The native list did it only at the next React commit,
 * late while the JS thread mounted a wink (330 ms of empty space, 02/11).
 */
describe('offsetWhileDropping', () => {
  it('goes down as much as the room has shrunk', () => {
    expect(offsetWhileDropping(1200, 300, 300)).toBe(1200);
    expect(offsetWhileDropping(1200, 300, 120)).toBe(1020);
    expect(offsetWhileDropping(1200, 300, 0)).toBe(900);
  });

  it('never asks for an offset above the start of the list', () => {
    expect(offsetWhileDropping(100, 300, 0)).toBe(0);
  });
});

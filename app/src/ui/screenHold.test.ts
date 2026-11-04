import { describe, expect, it, vi } from 'vitest';
import { createScreenHold } from './screenHold';

/** The screen stays on under one tag: a voice note, a video call. Neither lets go of the other's. */
describe('createScreenHold', () => {
  const setup = (tag = 'call') => {
    const activate = vi.fn(async (_tag: string) => undefined);
    const deactivate = vi.fn(async (_tag: string) => undefined);
    return { activate, deactivate, hold: createScreenHold(tag, { activate, deactivate }) };
  };

  it('asks once under its own tag and lets go once', () => {
    const { activate, deactivate, hold } = setup();

    hold.hold();
    hold.hold();
    hold.release();
    hold.release();

    expect(activate.mock.calls).toEqual([['call']]);
    expect(deactivate.mock.calls).toEqual([['call']]);
  });

  it('letting go of what it does not hold does nothing', () => {
    const { deactivate, hold } = setup();

    hold.release();

    expect(deactivate).not.toHaveBeenCalled();
  });

  it('a keep-awake that fails never reaches the call', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hold = createScreenHold('call', { activate: async () => Promise.reject(new Error('no activity')), deactivate: async () => Promise.reject(new Error('no activity')) });

    expect(() => hold.hold()).not.toThrow();
    expect(() => hold.release()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

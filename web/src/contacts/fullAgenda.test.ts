import { afterEach, describe, expect, it, vi } from 'vitest';
import { receiveFullAgenda, requestFullAgenda, setFullAgendaAsker } from './fullAgenda';

describe('the phone\'s whole address book (pending 20)', () => {
  afterEach(() => {
    setFullAgendaAsker(null);
    vi.useRealTimers();
  });

  it('asks the phone and resolves with what it sends', async () => {
    // Arrange
    const ask = vi.fn();
    setFullAgendaAsker(ask);
    // Act
    const pending = requestFullAgenda();
    receiveFullAgenda([{ phone: '987654321', name: 'Wilson' }]);
    // Assert
    expect(ask).toHaveBeenCalledTimes(1);
    await expect(pending).resolves.toEqual([{ phone: '987654321', name: 'Wilson' }]);
  });

  it('without a connection there is nothing to ask: null at once', async () => {
    await expect(requestFullAgenda()).resolves.toBeNull();
  });

  it('a phone that never answers gives null after the wait', async () => {
    vi.useFakeTimers();
    setFullAgendaAsker(() => undefined);
    const pending = requestFullAgenda();
    vi.advanceTimersByTime(8_000);
    await expect(pending).resolves.toBeNull();
  });
});

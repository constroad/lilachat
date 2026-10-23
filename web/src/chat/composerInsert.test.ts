import { describe, expect, it, vi } from 'vitest';
import { insertIntoComposer, subscribeComposerInserts } from './composerInsert';

describe('composerInsert', () => {
  it('delivers the text to the open composer and stops after unsubscribing', () => {
    // Arrange
    const listener = vi.fn();
    const unsubscribe = subscribeComposerInserts(listener);
    // Act
    insertIntoComposer('¡Feliz cumpleaños!');
    unsubscribe();
    insertIntoComposer('otra vez');
    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('¡Feliz cumpleaños!');
  });

  it('with no composer open nothing happens', () => {
    // Act / Assert
    expect(() => insertIntoComposer('nadie escucha')).not.toThrow();
  });
});

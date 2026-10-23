import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { limaDayKey } from '@lilachat/shared';
import { BirthdayCardWeb } from './BirthdayCardWeb';

const ME = 'u-me';
const CARLA = 'u-carla';
const notice = (seq: number, senderId: string, at = new Date().toISOString(), valor?: string) => ({ seq, at, senderId, system: { evento: 'cumpleanos', ...(valor ? { valor } : {}) } });
const names = new Map([[CARLA, 'Carla Ruiz']]);

function renderCard(messages: ReturnType<typeof notice>[], handlers = { onReact: vi.fn(), onGreet: vi.fn() }) {
  render(<BirthdayCardWeb chatId="c1" chatName="Obra Norte" isGroup me={ME} messages={messages} names={names} photos={new Map()} {...handlers} />);
  return handlers;
}

describe('BirthdayCardWeb', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows today\'s birthday of someone else with the age and the group', () => {
    // Arrange / Act
    renderCard([notice(5, CARLA, undefined, '31')]);
    // Assert
    expect(screen.getByText('¡Feliz cumpleaños, Carla!')).toBeTruthy();
    expect(screen.getByText('Hoy cumple 31 años · Obra Norte')).toBeTruthy();
  });

  it('does not show my own birthday nor yesterday\'s', () => {
    // Arrange
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    // Act
    renderCard([notice(5, ME), notice(6, CARLA, yesterday)]);
    // Assert
    expect(screen.queryByTestId('tarjeta-cumpleanos-chat')).toBeNull();
    expect(limaDayKey(new Date(yesterday))).not.toBe(limaDayKey(new Date()));
  });

  it('a quick reaction sends the emoji and the card never comes back', () => {
    // Arrange
    const handlers = renderCard([notice(5, CARLA)]);
    // Act
    fireEvent.click(screen.getByTestId('cumple-reaccion-🎂'));
    // Assert
    expect(handlers.onReact).toHaveBeenCalledWith('🎂');
    expect(screen.queryByTestId('tarjeta-cumpleanos-chat')).toBeNull();
    renderCard([notice(5, CARLA)]);
    expect(screen.queryByTestId('tarjeta-cumpleanos-chat')).toBeNull();
  });

  it('«Saludar en el grupo» writes the greeting in the field', () => {
    // Arrange
    const handlers = renderCard([notice(5, CARLA)]);
    // Act
    fireEvent.click(screen.getByTestId('btn-saludar-cumpleanos'));
    // Assert
    expect(handlers.onGreet).toHaveBeenCalledWith('¡Feliz cumpleaños, Carla! 🎉');
    expect(screen.queryByTestId('tarjeta-cumpleanos-chat')).toBeNull();
  });

  it('without a working storage it still shows and closes', () => {
    // Arrange
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderCard([notice(5, CARLA)]);
    // Act
    fireEvent.click(screen.getByTestId('btn-cerrar-cumpleanos'));
    // Assert
    expect(screen.queryByTestId('tarjeta-cumpleanos-chat')).toBeNull();
    getItem.mockRestore();
  });
});

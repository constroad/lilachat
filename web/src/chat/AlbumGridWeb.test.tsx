import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AlbumGridWeb } from './AlbumGridWeb';
import type { MensajeEnPantalla } from './types';

const photo = (seq: number, body?: string): MensajeEnPantalla => ({ chatId: 'c1', seq, senderId: 'ana', clientKey: `k${seq}`, kind: 'image', body, at: '2026-10-22T15:00:00.000Z', media: { url: `https://x/${seq}.jpg`, mime: 'image/jpeg', album: 'album1' } });

describe('AlbumGridWeb (pending 81)', () => {
  it('five photos: a 2×2 with «+1» on the fourth; a click opens the viewer on that photo', () => {
    // Arrange
    const onOpen = vi.fn();
    render(<AlbumGridWeb items={[photo(4, 'Avance'), photo(5), photo(6), photo(7), photo(8)]} onOpen={onOpen} />);
    // Act
    fireEvent.click(screen.getByTestId('album-foto-6'));
    fireEvent.click(screen.getByTestId('album-foto-7'));
    // Assert
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.queryByTestId('album-foto-8')).toBeNull();
    expect(screen.getByTestId('album-mas-4').textContent).toBe('+1');
    expect(onOpen).toHaveBeenNthCalledWith(1, expect.objectContaining({ seq: 6 }));
    expect(onOpen).toHaveBeenNthCalledWith(2, expect.objectContaining({ seq: 7 }));
  });

  it('three photos: one big on top and two small, no «+N»', () => {
    render(<AlbumGridWeb items={[photo(1), photo(2), photo(3)]} onOpen={() => undefined} />);
    expect(screen.getByTestId('album-foto-1').style.width).toBe('100%');
    expect(screen.queryByTestId('album-mas-1')).toBeNull();
  });
});

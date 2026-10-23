import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AlbumCarouselWeb } from './AlbumCarouselWeb';
import type { MensajeEnPantalla } from './types';

const photo = (seq: number, body?: string): MensajeEnPantalla => ({ chatId: 'c1', seq, senderId: 'ana', clientKey: `k${seq}`, kind: 'image', body, at: '2026-10-22T15:00:00.000Z', media: { url: `https://x/${seq}.jpg`, mime: 'image/jpeg', album: 'album1' } });

describe('AlbumCarouselWeb (pending 12)', () => {
  it('shows 1/3, moves to the next one, and a click opens the viewer on the photo on screen', () => {
    // Arrange
    const onOpen = vi.fn();
    render(<AlbumCarouselWeb items={[photo(4, 'Avance'), photo(5, 'Tramo 2'), photo(6)]} onOpen={onOpen} />);
    // Act
    const first = screen.getByTestId('album-contador-4').textContent;
    fireEvent.click(screen.getByTestId('album-siguiente'));
    fireEvent.click(screen.getByTestId('album-foto-5'));
    // Assert
    expect(first).toBe('1/3');
    expect(screen.getByTestId('album-contador-4').textContent).toBe('2/3');
    expect(screen.getByText('Tramo 2')).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ seq: 5 }));
  });
});

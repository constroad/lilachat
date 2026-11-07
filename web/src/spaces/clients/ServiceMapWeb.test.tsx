import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChannelLinks } from '@lilachat/shared';
import { ServiceMapWeb } from './ServiceMapWeb';

/** José 06/11: «si el servicio tiene mapa agrega un tab mapa». */
const target = { kind: 'service' as const, clientId: 'cli-1', serviceId: 'srv-1' };
const linksWith = (map: ChannelLinks['map']): ChannelLinks => ({ can: () => true, open: vi.fn(), map });

describe('ServiceMapWeb', () => {
  it('makes the link when it opens and offers it in another tab', async () => {
    // Arrange
    const map = vi.fn(async () => ({ ok: true as const, url: 'https://constroad.com/public/mapa' }));
    // Act
    render(<ServiceMapWeb links={linksWith(map)} target={target} />);
    // Assert
    const open = await screen.findByTestId('mapa-abrir');
    expect(open).toHaveAttribute('href', 'https://constroad.com/public/mapa');
    expect(open).toHaveAttribute('target', '_blank');
    expect(map).toHaveBeenCalledTimes(1);
    expect(map).toHaveBeenCalledWith(target);
  });

  it('a failure says so and can be tried again', async () => {
    const map = vi.fn().mockResolvedValueOnce({ ok: false, message: 'No se pudo abrir el mapa.' }).mockResolvedValueOnce({ ok: true, url: 'https://constroad.com/public/mapa' });
    render(<ServiceMapWeb links={linksWith(map)} target={target} />);

    expect(await screen.findByTestId('mapa-fallo')).toHaveTextContent('No se pudo abrir el mapa.');
    fireEvent.click(screen.getByTestId('mapa-reintentar'));

    expect(await screen.findByTestId('mapa-abrir')).toBeInTheDocument();
    expect(map).toHaveBeenCalledTimes(2);
  });
});

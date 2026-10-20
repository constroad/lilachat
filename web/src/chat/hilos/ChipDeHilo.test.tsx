import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChipDeHilo } from './ChipDeHilo';

/** E3 (20/10): el chip bajo la raíz. */
describe('ChipDeHilo', () => {
  const nombres = new Map([['b', 'Beto'], ['c', 'Carla']]);

  it('dice cuántas respuestas, marca las nuevas y abre el hilo', async () => {
    const onAbrir = vi.fn();
    render(<ChipDeHilo seq={7} hilo={{ respuestas: 4, ultimaEn: '2026-10-20T15:42:00.000Z', autores: ['b', 'c'] }} nombres={nombres} nuevas onAbrir={onAbrir} />);

    expect(screen.getByText(/^4 respuestas · última /)).toBeInTheDocument();
    expect(screen.getByTestId('hilo-nuevas-7')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('chip-hilo-7'));
    expect(onAbrir).toHaveBeenCalledWith(7);
  });

  it('shows the faces of who replied when they have a photo (backlog 18)', () => {
    const photos = new Map([['b', 'https://storage.test/beto.jpg']]);
    const { container } = render(<ChipDeHilo seq={7} hilo={{ respuestas: 2, autores: ['b', 'c'] }} nombres={nombres} photos={photos} nuevas={false} onAbrir={() => undefined} />);

    const faces = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(faces).toEqual(['https://storage.test/beto.jpg']);
  });

  it('sin respuestas (todas borradas) no se dibuja', () => {
    const { container } = render(<ChipDeHilo seq={7} hilo={{ respuestas: 0 }} nombres={nombres} nuevas={false} onAbrir={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

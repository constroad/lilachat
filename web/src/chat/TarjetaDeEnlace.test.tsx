import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { VistaPreviaDeEnlace } from '@lilachat/shared';
import { TarjetaDeEnlace } from './TarjetaDeEnlace';

const instagram: VistaPreviaDeEnlace = { url: 'https://www.instagram.com/instagram/', titulo: 'Instagram (@instagram)', imagen: 'https://cdn.example/logo.jpg', sitio: 'instagram.com' };
const youtube: VistaPreviaDeEnlace = { url: 'https://youtube.com/shorts/x', titulo: 'Un short', imagen: 'https://i.ytimg.com/x.jpg', sitio: 'YouTube', video: true };

function cargarImagen(ancho: number, alto: number) {
  const imagen = screen.getByTestId('tarjeta-enlace').querySelector('img')!;
  Object.defineProperty(imagen, 'naturalWidth', { value: ancho });
  Object.defineProperty(imagen, 'naturalHeight', { value: alto });
  fireEvent.load(imagen);
}

describe('la tarjeta de un enlace en la web', () => {
  it('un logo cuadrado va chico al costado, no estirado a todo el ancho (como la app)', () => {
    render(<TarjetaDeEnlace vista={instagram} mio={false} />);
    expect(screen.getByTestId('tarjeta-enlace').dataset.compacta).toBeUndefined();
    cargarImagen(100, 100);
    expect(screen.getByTestId('tarjeta-enlace').dataset.compacta).toBe('true');
  });

  it('una foto ancha queda grande arriba', () => {
    render(<TarjetaDeEnlace vista={instagram} mio={false} />);
    cargarImagen(1200, 630);
    expect(screen.getByTestId('tarjeta-enlace').dataset.compacta).toBeUndefined();
  });

  it('un video queda grande con el play, aunque su miniatura sea cuadrada', () => {
    render(<TarjetaDeEnlace vista={youtube} mio={false} />);
    cargarImagen(720, 720);
    expect(screen.getByTestId('tarjeta-enlace').dataset.compacta).toBeUndefined();
    expect(screen.getByTestId('play-tarjeta')).toBeTruthy();
  });

  it('una imagen que no carga no deja hueco', () => {
    render(<TarjetaDeEnlace vista={instagram} mio={false} />);
    fireEvent.error(screen.getByTestId('tarjeta-enlace').querySelector('img')!);
    expect(screen.getByTestId('tarjeta-enlace').querySelector('img')).toBeNull();
  });

  it('a YouTube link plays inside Lilachat, in its own player (pending 6)', () => {
    const video: VistaPreviaDeEnlace = { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', titulo: 'Me at the zoo', sitio: 'YouTube', video: true };
    render(<TarjetaDeEnlace vista={video} mio={false} />);
    fireEvent.click(screen.getByTestId('tarjeta-enlace'));
    const player = screen.getByTestId('reproductor-video');
    expect(player.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?autoplay=1&playsinline=1&rel=0');
    expect(screen.getByTestId('btn-abrir-video-afuera').getAttribute('href')).toBe(video.url);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('reproductor-video')).toBeNull();
  });

  it('any other link still opens in a new tab', () => {
    render(<TarjetaDeEnlace vista={instagram} mio={false} />);
    expect(fireEvent.click(screen.getByTestId('tarjeta-enlace'))).toBe(true);
    expect(screen.queryByTestId('reproductor-video')).toBeNull();
  });
});

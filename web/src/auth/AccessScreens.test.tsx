import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessScreens } from './AccessScreens';

const TOKEN = 'q3VhZ0Jb1xR4mN8pLw2sT6yE9cK0aZfH5dUiOjXgB7v';

function conPantallaAncha(ancha: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: ancha, media: consulta, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

/** El server de vinculación, falso: QR, y la aprobación llega en la espera N (o nunca). */
function servidorDeVinculacion(aprobarEnLaEspera: number | null = 2) {
  let esperas = 0;
  const cuerpos: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const cuerpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      cuerpos.push({ url, ...cuerpo });
      const responder = (datos: unknown) => new Response(JSON.stringify(datos), { status: 200 });
      if (url.endsWith('/auth/vincular/iniciar')) return responder({ id: 'v1', clave: 'clave', token: TOKEN, rotarCadaMs: 20_000 });
      if (url.endsWith('/auth/vincular/esperar')) {
        esperas += 1;
        if (aprobarEnLaEspera === null || esperas < aprobarEnLaEspera) {
          await new Promise((listo) => setTimeout(listo, 10));
          return responder({ estado: 'pendiente' });
        }
        return responder({ estado: 'vinculada', jwt: 'jwt-nuevo', deviceId: 'vinculado-1', user: { id: 'u1', name: 'José', phone: '902049935' } });
      }
      return new Response('{}', { status: 404 });
    })
  );
  return { cuerpos };
}

afterEach(() => vi.unstubAllGlobals());

describe('AccessScreens (W5)', () => {
  it('en pantalla ancha abre con el QR y entra cuando el teléfono aprueba', async () => {
    conPantallaAncha(true);
    const { cuerpos } = servidorDeVinculacion();
    const onReady = vi.fn();
    render(<AccessScreens onReady={onReady} />);

    expect(await screen.findByTestId('codigo-qr')).toHaveAttribute('data-token', TOKEN);
    await waitFor(() => expect(onReady).toHaveBeenCalledWith({ jwt: 'jwt-nuevo', deviceId: 'vinculado-1', userId: 'u1', phone: '902049935', name: 'José' }));
    expect(cuerpos.find((cuerpo) => String(cuerpo.url).endsWith('/esperar'))).toMatchObject({ id: 'v1', clave: 'clave', mantener: true });
  });

  it('en pantalla angosta abre con el número, y se puede pasar al QR y volver', async () => {
    conPantallaAncha(false);
    servidorDeVinculacion();
    render(<AccessScreens onReady={vi.fn()} />);

    expect(screen.getByTestId('input-telefono')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('btn-usar-qr'));
    expect(await screen.findByTestId('cuadro-qr')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('btn-usar-telefono'));
    expect(screen.getByTestId('input-telefono')).toBeInTheDocument();
  });

  it('«Mantener la sesión iniciada» apagado viaja al canjear', async () => {
    conPantallaAncha(true);
    const { cuerpos } = servidorDeVinculacion(null);
    render(<AccessScreens onReady={vi.fn()} />);
    await userEvent.click(await screen.findByTestId('chk-mantener'));
    await waitFor(() => expect(cuerpos.some((cuerpo) => String(cuerpo.url).endsWith('/esperar') && cuerpo.mantener === false)).toBe(true));
  });
});

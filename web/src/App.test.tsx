import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

/**
 * El paso de deslogueado a logueado.
 *
 * Existe por un defecto REAL que solo apareció en el navegador: había un
 * `useMemo` DESPUÉS del `return` de la pantalla de acceso, así que al entrar el
 * componente renderizaba más hooks que en el render anterior y React tiraba
 * «Rendered more hooks than during the previous render» — pantalla en blanco
 * justo al terminar de escribir el código.
 *
 * Ningún test de componente suelto lo veía: la lista y el composer estaban
 * perfectos por separado. Hacía falta montar la app y CRUZAR el login, que es
 * la misma lección que «el E2E debe cruzar el endpoint».
 */
const socketFalso = {
  on: vi.fn(),
  close: vi.fn(),
  emit: vi.fn(),
};

vi.mock('socket.io-client', () => ({ io: () => socketFalso }));

const credencial = {
  jwt: 'jwt-de-prueba',
  userId: 'u1',
  phone: '902049935',
  name: 'José',
  deviceId: 'device-1',
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ chats: [] }), { status: 200 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('App', () => {
  it('sin credencial muestra el acceso', () => {
    render(<App />);

    expect(screen.getByTestId('input-telefono')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-lista')).not.toBeInTheDocument();
  });

  it('con credencial muestra los dos paneles', async () => {
    localStorage.setItem('lilachat.credential', JSON.stringify(credencial));

    render(<App />);

    await waitFor(() => expect(screen.getByTestId('panel-lista')).toBeInTheDocument());
    // Sin conversación abierta, el panel derecho es la bienvenida, nunca un hueco.
    expect(screen.getByTestId('panel-vacio')).toBeInTheDocument();
    expect(screen.getByText(/Hola, José/)).toBeInTheDocument();
  });

  /**
   * ESTE es el que atrapa el defecto, y montar ya logueado NO alcanzaba: con el
   * `useMemo` mal puesto, ese montaje corre la lista completa de hooks desde el
   * primer render y nunca falla. El error necesita la TRANSICIÓN — un render
   * sin credencial (que corta antes del hook) seguido de uno con credencial
   * (que lo ejecuta) — dentro del mismo componente montado.
   */
  it('entrar con el código no deja la pantalla en blanco', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/auth/otp/verify')) {
          return new Response(
            JSON.stringify({ jwt: 'jwt', user: { id: 'u1', name: 'José', phone: '902049935' } }),
            { status: 200 }
          );
        }
        if (String(url).includes('/auth/otp/request')) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ chats: [] }), { status: 200 });
      })
    );

    render(<App />);

    await userEvent.type(screen.getByTestId('input-telefono'), '902049935');
    await userEvent.click(screen.getByTestId('btn-continuar'));
    await waitFor(() => expect(screen.getByTestId('input-codigo')).toBeInTheDocument());

    // Al sexto dígito se envía solo.
    await userEvent.type(screen.getByTestId('input-codigo'), '424242');

    await waitFor(() => expect(screen.getByTestId('panel-lista')).toBeInTheDocument());
    expect(screen.getByTestId('panel-vacio')).toBeInTheDocument();
  });

  /** Un 401 —y SOLO un 401— devuelve al acceso. */
  it('un 401 al listar chats cierra la sesión', async () => {
    localStorage.setItem('lilachat.credential', JSON.stringify(credencial));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'no' }), { status: 401 }))
    );

    render(<App />);

    await waitFor(() => expect(screen.getByTestId('input-telefono')).toBeInTheDocument());
    expect(localStorage.getItem('lilachat.credential')).toBeNull();
  });

  /**
   * Sin red NO se cierra la sesión: `fetch` que revienta es «no hay internet»,
   * no «te revocaron», y confundirlos echa al usuario cada vez que se cae el
   * wifi.
   */
  it('sin conexión conserva la sesión', async () => {
    localStorage.setItem('lilachat.credential', JSON.stringify(credencial));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getByTestId('panel-lista')).toBeInTheDocument());
    expect(localStorage.getItem('lilachat.credential')).not.toBeNull();
  });
});

/**
 * La sesión de la web dura, como WhatsApp Web.
 *
 * José, 26/08/2026: «no sé por qué tengo que ingresar a cada rato con código, no
 * se guarda la sesión». El `jwt` dura 24 h y la web **tiraba el secreto del
 * dispositivo**: guardaba solo el token, así que al día siguiente pedía otro
 * código — mientras el teléfono, que sí lo guardaba, seguía entrando solo.
 */
describe('la sesión se renueva sola', () => {
  const conSecreto = { ...credencial, deviceSecret: 'secreto-del-navegador' };

  /**
   * W0 (19/10): la sesión vieja (secreto en localStorage) se MUDA a la cookie
   * HttpOnly en el primer arranque, y después en localStorage no queda nada que
   * sirva para entrar: ni el secreto ni el JWT.
   */
  it('una sesión vieja se muda a la cookie y no queda ningún secreto en localStorage', async () => {
    localStorage.setItem('lilachat.credential', JSON.stringify(conSecreto));
    const cuerpos: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes('/auth/session')) {
          cuerpos.push(JSON.parse(String(init?.body ?? '{}')));
          return new Response(JSON.stringify({ jwt: 'jwt-nuevo', user: { name: 'José' } }), { status: 200 });
        }
        return new Response(JSON.stringify({ chats: [] }), { status: 200 });
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.queryByTestId('input-telefono')).toBeNull());
    await waitFor(() => expect(localStorage.getItem('lilachat.credential')).toBeNull());
    expect(cuerpos[0]).toEqual({ cliente: 'web', deviceId: 'device-1', deviceSecret: 'secreto-del-navegador' });
    const guardado = localStorage.getItem('lilachat.perfil') ?? '';
    expect(guardado).not.toContain('jwt');
    expect(guardado).not.toContain('secreto');
  });

  it('ante un 401 renueva con la cookie y NO pide código', async () => {
    localStorage.setItem('lilachat.perfil', JSON.stringify({ userId: 'u1', phone: '902049935', name: 'José', deviceId: 'device-1' }));
    let renovaciones = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/auth/session')) {
          renovaciones += 1;
          return new Response(JSON.stringify({ jwt: `jwt-${renovaciones}` }), { status: 200 });
        }
        // El primer token se rechaza una vez; con el segundo entra.
        return renovaciones >= 2
          ? new Response(JSON.stringify({ chats: [] }), { status: 200 })
          : new Response(JSON.stringify({ message: 'no' }), { status: 401 });
      })
    );

    render(<App />);

    await waitFor(() => expect(renovaciones).toBeGreaterThanOrEqual(2));
    expect(screen.queryByTestId('input-telefono')).toBeNull();
  });

  /**
   * Si el refresco devuelve 401, ahí sí se acabó: el dispositivo fue revocado y
   * seguir intentando sería dejar a alguien mirando una lista vacía.
   */
  it('si el propio refresco es rechazado, vuelve al alta', async () => {
    localStorage.setItem('lilachat.credential', JSON.stringify(conSecreto));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'no' }), { status: 401 }))
    );

    render(<App />);

    expect(await screen.findByTestId('input-telefono')).toBeInTheDocument();
  });
});

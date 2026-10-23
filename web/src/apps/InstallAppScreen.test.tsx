import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InstallAppScreen } from './InstallAppScreen';

const QUERY = '?client_id=lca_lila&redirect_uri=https%3A%2F%2Fagentes.example.com%2Fvuelta&state=state-0123456789abcdef&code_challenge=abc&code_challenge_method=S256';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Installing an app in a space (`specs/BOTS-API.spec.md` §a): the consent page. */
describe('install app screen', () => {
  it('shows the app, what it may do and my spaces; installing sends the person back with the code', async () => {
    const calls: { url: string; body?: unknown }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(input).startsWith('/api/oauth/app')) return json(200, { app: { name: 'Lila' }, spaces: [{ id: 's1', name: 'CONSTROAD' }, { id: 's2', name: 'Globofast' }] });
      return json(200, { redirect: 'https://agentes.example.com/vuelta?code=c&state=s' });
    });
    const go = vi.fn();
    render(<InstallAppScreen jwt="jwt" search={QUERY} onRedirect={go} />);
    expect(await screen.findByText('Lila quiere unirse a un espacio')).toBeTruthy();
    expect(screen.getByText(/mencionan o le escriben/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('espacio-s2'));
    fireEvent.click(screen.getByTestId('instalar-app'));
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://agentes.example.com/vuelta?code=c&state=s'));
    expect(calls.at(-1)!.body).toMatchObject({ client_id: 'lca_lila', state: 'state-0123456789abcdef', code_challenge: 'abc', code_challenge_method: 'S256', space_id: 's2', decision: 'approve' });
  });

  it('coming from Integraciones of a space (?space=), that space is already chosen and the button names it (design r156-instalar-consentimiento)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, { app: { name: 'Lila' }, spaces: [{ id: 's1', name: 'Constroad' }, { id: 's2', name: 'Inframaq' }] }));
    render(<InstallAppScreen jwt="jwt" search={`${QUERY}&space=s2`} onRedirect={vi.fn()} />);
    // Like Slack (José, 23/10): installing from a space does not ask for a space; it says where, with «Cambiar».
    expect((await screen.findByTestId('espacio-elegido')).textContent).toContain('Inframaq');
    expect(screen.queryByTestId('espacio-s1')).toBeNull();
    expect(screen.getByTestId('instalar-app').textContent).toBe('Instalar en Inframaq');
    fireEvent.click(screen.getByTestId('cambiar-espacio'));
    expect(screen.getByTestId('espacio-s2').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Lila no podrá')).toBeTruthy();
    expect(screen.getByText(/Integraciones/)).toBeTruthy();
  });

  it('cancelling also goes back, saying it was denied', async () => {
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (init?.body) bodies.push(JSON.parse(String(init.body)));
      if (String(input).startsWith('/api/oauth/app')) return json(200, { app: { name: 'Lila' }, spaces: [{ id: 's1', name: 'CONSTROAD' }] });
      return json(200, { redirect: 'https://agentes.example.com/vuelta?error=access_denied&state=s' });
    });
    const go = vi.fn();
    render(<InstallAppScreen jwt="jwt" search={QUERY} onRedirect={go} />);
    fireEvent.click(await screen.findByTestId('cancelar-instalacion'));
    await waitFor(() => expect(go).toHaveBeenCalled());
    expect(bodies[0]).toMatchObject({ decision: 'deny' });
  });

  it('a link with an address the app did not register never sends anyone anywhere', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(400, { error: 'invalid_request', error_description: 'La dirección de vuelta no es la que registró la app.' }));
    const go = vi.fn();
    render(<InstallAppScreen jwt="jwt" search={QUERY} onRedirect={go} />);
    expect(await screen.findByText('La dirección de vuelta no es la que registró la app.')).toBeTruthy();
    expect(screen.queryByTestId('instalar-app')).toBeNull();
    expect(go).not.toHaveBeenCalled();
  });

  it('without a space I manage, it says so and only offers to go back', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { app: { name: 'Lila' }, spaces: [] }));
    render(<InstallAppScreen jwt="jwt" search={QUERY} onRedirect={vi.fn()} />);
    expect(await screen.findByText(/dueño o admin de un espacio/)).toBeTruthy();
    expect(screen.queryByTestId('instalar-app')).toBeNull();
  });
});

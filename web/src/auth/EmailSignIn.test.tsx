import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentSpaceId } from '../spaces/currentSpace';
import { AccessScreens } from './AccessScreens';

/** The way in like Slack (spec INGRESO-POR-ESPACIO): email, code, spaces and, the first time, the name. */
const EMAIL = 'ana.torres@constroad.com';
const openSpaceId = () => localStorage.getItem('lilachat.espacio');
const SPACE = { id: 's1', name: 'CONSTROAD', status: 'active', role: 'member', joinPolicy: 'open', members: 12, unreadChats: 0 };
const INVITATION = { id: 'i1', workspace: { id: 's2', name: 'Lab Vial' }, invitedBy: 'Darío Paredes' };

type Server = { calls: string[]; name: string | null };

function fakeServer(account: { name: string | null; phone?: string }, lists: { workspaces?: unknown[]; invitations?: unknown[] } = {}): Server {
  const server: Server = { calls: [], name: account.name };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url).replace('/api', '');
      server.calls.push(`${init?.method ?? 'GET'} ${path}`);
      const answer = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200 });
      if (path === '/auth/email/request' || path === '/auth/otp/request') return answer({ message: 'ok' });
      if (path === '/auth/email/verify' || path === '/auth/otp/verify') return answer({ jwt: 'jwt-1', user: { id: 'u1', name: account.name, phone: account.phone ?? 'mail:abc' } });
      if (path === '/workspaces') return answer({ workspaces: lists.workspaces ?? [] });
      if (path === '/workspaces/invitations') return answer({ invitations: lists.invitations ?? [] });
      if (path === '/workspaces/invitations/i1/accept') return answer({ workspaceId: 's2' });
      if (path === '/me/profile') return answer({ profile: { name: JSON.parse(String(init?.body)).name, phone: 'mail:abc', avatarUrl: null, email: EMAIL, emailVerified: true, birthday: null, birthdayVisible: true, missing: [] } });
      return new Response('{}', { status: 404 });
    })
  );
  return server;
}

async function signInByEmail() {
  await userEvent.type(screen.getByTestId('input-correo'), EMAIL);
  await userEvent.click(screen.getByTestId('btn-continuar-correo'));
  await userEvent.type(await screen.findByTestId('input-codigo'), '424242');
  await screen.findByTestId('pantalla-tus-espacios');
}

beforeEach(() => {
  localStorage.clear();
  setCurrentSpaceId(null);
});

afterEach(() => vi.unstubAllGlobals());

describe('sign-in by workspace on the web', () => {
  it('opens by the email, with the phone and the personal use as options', () => {
    fakeServer({ name: null });
    render(<AccessScreens onReady={vi.fn()} />);
    expect(screen.getByText('Entra a tu espacio de trabajo')).toBeInTheDocument();
    expect(screen.getByTestId('btn-entrar-telefono')).toBeInTheDocument();
    expect(screen.getByTestId('btn-sin-espacio')).toBeInTheDocument();
  });

  it('an email that does not look like one asks for nothing', async () => {
    const server = fakeServer({ name: null });
    render(<AccessScreens onReady={vi.fn()} />);
    await userEvent.type(screen.getByTestId('input-correo'), 'ana');
    await userEvent.click(screen.getByTestId('btn-continuar-correo'));
    expect(screen.getByTestId('error-acceso')).toHaveTextContent('Escribe un correo válido.');
    expect(server.calls).toEqual([]);
  });

  it('after the code it lists the spaces, and «Abrir» enters that one', async () => {
    fakeServer({ name: 'Ana Torres' }, { workspaces: [SPACE, { ...SPACE, id: 's9', name: 'Pendiente', status: 'pending' }] });
    const onReady = vi.fn();
    render(<AccessScreens onReady={onReady} />);
    await signInByEmail();
    expect(await screen.findByText('12 miembros')).toBeInTheDocument();
    expect(screen.queryByText('Pendiente')).toBeNull();
    await userEvent.click(screen.getByTestId('abrir-espacio-s1'));
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ jwt: 'jwt-1', phone: 'mail:abc' }));
    expect(openSpaceId()).toBe('s1');
  });

  it('a new account writes its name BEFORE accepting, so the space hears who arrived', async () => {
    const server = fakeServer({ name: null }, { invitations: [INVITATION] });
    const onReady = vi.fn();
    render(<AccessScreens onReady={onReady} />);
    await signInByEmail();
    expect(await screen.findByText('Te invitó Darío Paredes')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('unirme-espacio-i1'));
    expect(screen.getByText('Así te verán en Lab Vial.')).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByTestId('btn-entrar-espacio')).toBeDisabled();
    await userEvent.type(screen.getByTestId('input-nombre-completo'), 'Ana Torres');
    await userEvent.click(screen.getByTestId('btn-entrar-espacio'));
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(server.calls.indexOf('PUT /me/profile')).toBeLessThan(server.calls.indexOf('POST /workspaces/invitations/i1/accept'));
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Torres' }));
    expect(localStorage.getItem('lilachat.novedades.vista')).toBeTruthy();
    expect(openSpaceId()).toBe('s2');
  });

  it('an account with a name joins with one click', async () => {
    const server = fakeServer({ name: 'Ana Torres' }, { invitations: [INVITATION] });
    const onReady = vi.fn();
    render(<AccessScreens onReady={onReady} />);
    await signInByEmail();
    await userEvent.click(await screen.findByTestId('unirme-espacio-i1'));
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(server.calls).not.toContain('PUT /me/profile');
  });

  it('«Usar sin espacio de trabajo» goes through the phone straight to the chats', async () => {
    const server = fakeServer({ name: 'José', phone: '902049935' });
    const onReady = vi.fn();
    render(<AccessScreens onReady={onReady} />);
    await userEvent.click(screen.getByTestId('btn-sin-espacio'));
    await userEvent.type(screen.getByTestId('input-telefono'), '902049935');
    await userEvent.click(screen.getByTestId('btn-continuar'));
    await userEvent.type(await screen.findByTestId('input-codigo'), '424242');
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(server.calls).not.toContain('GET /workspaces');
  });

  it('the phone as an option also ends in the spaces', async () => {
    fakeServer({ name: 'José', phone: '902049935' }, { workspaces: [SPACE] });
    render(<AccessScreens onReady={vi.fn()} />);
    await userEvent.click(screen.getByTestId('btn-entrar-telefono'));
    await userEvent.type(screen.getByTestId('input-telefono'), '902049935');
    await userEvent.click(screen.getByTestId('btn-continuar'));
    await userEvent.type(await screen.findByTestId('input-codigo'), '424242');
    expect(await screen.findByTestId('pantalla-tus-espacios')).toBeInTheDocument();
    expect(screen.getByText('902 049 935')).toBeInTheDocument();
  });

  it('when the lists fail it says so and a click tries again', async () => {
    fakeServer({ name: 'Ana Torres' }, { workspaces: [SPACE] });
    const working = globalThis.fetch;
    render(<AccessScreens onReady={vi.fn()} />);
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => (String(url).includes('/workspaces') ? new Response('{}', { status: 500 }) : working(url, init))));
    await signInByEmail();
    const error = await screen.findByTestId('error-espacios');
    vi.stubGlobal('fetch', working);
    await userEvent.click(error);
    expect(await screen.findByText('12 miembros')).toBeInTheDocument();
  });
});

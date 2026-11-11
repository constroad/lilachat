import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientWorkspace } from '@lilachat/shared';
import { ShareChannelRow, ShareInvitesCard } from './SharedChannelsWeb';
import { setCurrentSpaceId } from './currentSpace';

/** José 11/11: share a channel with other spaces (design `sc-01`) and accept one (design `sc-04`). */
const space = (id: string, name: string, role: ClientWorkspace['role']) => ({ id, name, role, status: 'active', members: 5 }) as ClientWorkspace;
const spaces = [space('im', 'Inframaq', 'owner'), space('cr', 'Constroad', 'owner'), space('gl', 'Globofast', 'member')];

function answer(routes: Record<string, unknown>) {
  const calls: { url: string; method: string; body?: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
    const key = Object.keys(routes).find((one) => url.includes(one));
    return new Response(JSON.stringify(key ? routes[key] : {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setCurrentSpaceId(null);
});

describe('ShareChannelRow', () => {
  it('only an admin of the owner space sees it, and never on #general or when looking from another space', () => {
    const { rerender } = render(<ShareChannelRow jwt="t" chatId="c1" channelName="administracion" ownerSpaceId="gl" spaces={spaces} isGeneral={false} />);
    expect(screen.queryByTestId('compartir-canal')).toBeNull();
    rerender(<ShareChannelRow jwt="t" chatId="c1" channelName="general" ownerSpaceId="im" spaces={spaces} isGeneral />);
    expect(screen.queryByTestId('compartir-canal')).toBeNull();
    rerender(<ShareChannelRow jwt="t" chatId="c1" channelName="administracion" ownerSpaceId="im" spaces={spaces} isGeneral={false} />);
    expect(screen.getByTestId('compartir-canal')).toBeTruthy();
    act(() => setCurrentSpaceId('cr'));
    expect(screen.queryByTestId('compartir-canal')).toBeNull();
    expect(screen.getByTestId('dejar-canal-compartido')).toBeTruthy();
  });

  it('lists my other spaces with their state and shares with one', async () => {
    const calls = answer({ '/shares': { shares: [{ workspaceId: 'cr', name: 'Constroad', status: 'active' }] } });
    render(<ShareChannelRow jwt="t" chatId="c1" channelName="administracion" ownerSpaceId="im" spaces={spaces} isGeneral={false} />);

    await userEvent.click(screen.getByTestId('compartir-canal'));
    await waitFor(() => expect(screen.getByTestId('dejar-de-compartir-cr').textContent).toBe('Dejar de compartir'));
    expect(screen.queryByTestId('compartir-con-im')).toBeNull();
    await userEvent.click(screen.getByTestId('compartir-gl'));

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url.includes('/workspaces/im/channels/c1/shares') && call.body?.includes('"gl"'))).toBe(true));
  });

  it('counts one member in singular', async () => {
    answer({ '/shares': { shares: [] } });
    render(<ShareChannelRow jwt="t" chatId="c1" channelName="administracion" ownerSpaceId="im" spaces={[...spaces, { ...space('t2', 'Test 2', 'owner'), members: 1 }]} isGeneral={false} />);

    await userEvent.click(screen.getByTestId('compartir-canal'));

    await waitFor(() => expect(screen.getByTestId('compartir-con-t2').textContent).toContain('1 miembro'));
    expect(screen.getByTestId('compartir-con-t2').textContent).not.toContain('1 miembros');
  });

  it('seen from the space that receives it, its admin stops receiving it, after confirming', async () => {
    const calls = answer({});
    setCurrentSpaceId('cr');
    render(<ShareChannelRow jwt="t" chatId="c1" channelName="administracion" ownerSpaceId="im" spaces={spaces} isGeneral={false} />);

    expect(screen.queryByTestId('compartir-canal')).toBeNull();
    await userEvent.click(screen.getByTestId('dejar-canal-compartido'));
    expect(screen.getByRole('heading', { name: /Dejar de ver # administracion en Constroad/ })).toBeTruthy();
    await userEvent.click(screen.getByTestId('confirmar-dejar-canal'));

    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.url.includes('/workspaces/cr/channels/c1/shares/cr'))).toBe(true));
  });

  it('a plain member of the receiving space does not see it', () => {
    setCurrentSpaceId('gl');
    render(<ShareChannelRow jwt="t" chatId="c1" channelName="administracion" ownerSpaceId="im" spaces={spaces} isGeneral={false} />);
    expect(screen.queryByTestId('dejar-canal-compartido')).toBeNull();
  });
});

describe('ShareInvitesCard', () => {
  it('shows an invitation to an admin and accepts it', async () => {
    const calls = answer({ '/share-invites': { invites: [{ chatId: 'c1', channelName: 'administracion', from: { workspaceId: 'im', name: 'Inframaq' }, invitedBy: 'José Zamora' }] } });
    const answered = vi.fn();
    render(<ShareInvitesCard jwt="t" space={space('gl', 'Globofast', 'owner')} onAnswered={answered} />);

    await waitFor(() => expect(screen.getByTestId('invitacion-canal-c1').textContent).toContain('José Zamora quiere compartir este canal con Globofast'));
    expect(screen.getByTestId('invitacion-canal-c1').textContent).toContain('Pendiente');
    expect(screen.getByTestId('invitacion-canal-c1').textContent).toContain('Los mensajes siguen siendo de Inframaq; Globofast puede dejar de verlo cuando quiera.');
    await userEvent.click(screen.getByTestId('aceptar-canal-c1'));

    await waitFor(() => expect(answered).toHaveBeenCalled());
    expect(calls.find((call) => call.method === 'POST')?.body).toBe(JSON.stringify({ accept: true }));
  });

  it('a plain member never asks for invitations', () => {
    const calls = answer({});
    render(<ShareInvitesCard jwt="t" space={space('gl', 'Globofast', 'member')} onAnswered={vi.fn()} />);
    expect(calls).toHaveLength(0);
  });
});

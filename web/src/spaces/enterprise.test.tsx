import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientWorkspace, ClientWorkspaceMember } from '@lilachat/shared';
import { DirectoryDialog } from './DirectoryDialog';
import { MembersDialog } from './MembersDialog';
import { SpaceSettingsDialog } from './SpaceSettingsDialog';
import { AddedToSpaceDialog } from './AddedToSpaceDialog';
import { AccessRemovedDialog } from './AccessRemovedDialog';
import { NewSpaceGroupDialog } from './NewSpaceGroupDialog';

/** The enterprise screens on the web (designs `e1-08`…`e1-14`): what reaches the server, and what the screen does with it. */
let calls: { url: string; method: string; body: unknown }[] = [];
let answers: { match: (url: string, method: string) => boolean; status: number; body: unknown }[] = [];
const answer = (part: string, body: unknown, status = 200, method?: string) => answers.push({ match: (url, m) => url.includes(part) && (!method || m === method), status, body });

beforeEach(() => {
  calls = [];
  answers = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const found = answers.find((one) => one.match(url, method));
    return new Response(found?.status === 204 ? null : JSON.stringify(found?.body ?? { message: 'No existe.' }), { status: found?.status ?? 404 });
  }));
});

const space = (extra: Partial<ClientWorkspace> = {}): ClientWorkspace => ({ id: 'w1', name: 'QA Obra', rubro: 'Construcción', joinPolicy: 'approval', role: 'owner', status: 'active', joinCode: 'QAOB-7K3P', members: 3, unreadChats: 0, ...extra });
const member = (id: string, extra: Partial<ClientWorkspaceMember> = {}): ClientWorkspaceMember => ({ id, userId: `u-${id}`, phone: '987654321', role: 'member', status: 'active', ...extra });
const people = [
  member('me', { userId: 'u-me', name: 'José Zamora', phone: '902049935', role: 'owner', area: 'Dirección' }),
  member('ana', { name: 'Ana Torres', title: 'Residente de obra', area: 'Obra', phone: '987654321' }),
  member('beto', { name: 'Beto Ramos', title: 'Operador de planta', area: 'Planta', phone: '976543210' }),
];

describe('DirectoryDialog (e1-08)', () => {
  it('searches by title and area chips, and «escribir» asks for the 1:1 inside the space', async () => {
    answer('/workspaces/w1/members?status=active', { members: people });
    const onMessage = vi.fn();
    render(<DirectoryDialog space={space()} jwt="t" myUserId="u-me" online={new Set(['u-ana'])} onOpenMember={() => undefined} onMessage={onMessage} onClose={() => undefined} />);
    expect(await screen.findByTestId('miembro-987654321')).toHaveTextContent('EN LÍNEA');
    await userEvent.type(screen.getByTestId('buscar-directorio'), 'operador');
    expect(screen.queryByTestId('miembro-987654321')).toBeNull();
    await userEvent.clear(screen.getByTestId('buscar-directorio'));
    await userEvent.click(screen.getByTestId('area-Obra'));
    expect(screen.queryByTestId('miembro-976543210')).toBeNull();
    await userEvent.click(screen.getByTestId('escribir-987654321'));
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'ana' }));
  });
});

describe('the space screens paint what they already saw (José, 22/10)', () => {
  it('reopening the directory shows the people at once, with no skeleton, while it refreshes behind', async () => {
    answer('/workspaces/w1/members?status=active', { members: people });
    const first = render(<DirectoryDialog space={space()} jwt="t" myUserId="u-me" online={new Set()} onOpenMember={() => undefined} onMessage={() => undefined} onClose={() => undefined} />);
    expect(await screen.findByTestId('miembro-987654321')).toBeTruthy();
    first.unmount();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(<DirectoryDialog space={space()} jwt="t" myUserId="u-me" online={new Set()} onOpenMember={() => undefined} onMessage={() => undefined} onClose={() => undefined} />);
    expect(screen.getByTestId('miembro-987654321')).toBeTruthy();
  });
});

describe('MembersDialog (e1-10, e1-11)', () => {
  it('counts per tab; the ⋮ offers what the owner may do and sends the change', async () => {
    answer('status=active', { members: people });
    answer('status=pending', { members: [member('luis', { name: 'Luis Huamán', status: 'pending', phone: '954321098', requestedAt: new Date().toISOString() })] });
    answer('status=invited', { members: [] });
    answer('status=deactivated', { members: [] });
    answer('/members/beto', { member: { ...people[2], role: 'admin' } }, 200, 'PATCH');
    render(<MembersDialog space={space()} jwt="t" myUserId="u-me" online={new Set()} initialTab="active" onInvite={() => undefined} onChanged={() => undefined} onClose={() => undefined} />);
    expect(await screen.findByTestId('tab-activos')).toHaveTextContent('3');
    expect(screen.getByTestId('tab-pendientes')).toHaveTextContent('1');
    expect(screen.queryByTestId('acciones-902049935')).toBeNull();
    await userEvent.click(screen.getByTestId('acciones-976543210'));
    const menu = screen.getByTestId('menu-acciones-miembro');
    expect(within(menu).getByText('Hacer admin')).toBeInTheDocument();
    await userEvent.click(within(menu).getByText('Hacer admin'));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ role: 'admin' }));
  });

  it('a request is approved with its area and title, or rejected', async () => {
    answer('status=active', { members: people });
    answer('status=pending', { members: [member('luis', { name: 'Luis Huamán', status: 'pending', phone: '954321098', requestedAt: new Date(Date.now() - 5 * 60_000).toISOString() })] });
    answer('status=invited', { members: [] });
    answer('status=deactivated', { members: [] });
    answer('/members/luis', { member: { ...people[1], id: 'luis', status: 'active' } }, 200, 'PATCH');
    answer('/members/luis', {}, 204, 'DELETE');
    render(<MembersDialog space={space()} jwt="t" myUserId="u-me" online={new Set()} initialTab="pending" onInvite={() => undefined} onChanged={() => undefined} onClose={() => undefined} />);
    const card = await screen.findByTestId('solicitud-954321098');
    expect(card).toHaveTextContent('Entró con el código QAOB-7K3P hace 5 min');
    await userEvent.click(within(card).getByTestId('solicitud-area-Flota'));
    await userEvent.type(within(card).getByTestId('solicitud-cargo'), 'Chofer de volquete');
    await userEvent.click(within(card).getByTestId('solicitud-aprobar'));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ status: 'active', area: 'Flota', title: 'Chofer de volquete' }));
    await userEvent.click(within(await screen.findByTestId('solicitud-954321098')).getByTestId('solicitud-rechazar'));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.url.includes('/members/luis'))).toBe(true));
  });

  it('«Invitados» lists the emails waiting (22/10): they show as invited by email and can only be withdrawn', async () => {
    answer('status=active', { members: people });
    answer('status=pending', { members: [] });
    answer('status=invited', { members: [{ id: 'inv1', email: 'luis@empresa.pe', role: 'member', status: 'invited' }] });
    answer('status=deactivated', { members: [] });
    answer('/invites/inv1', null, 204, 'DELETE');
    render(<MembersDialog space={space()} jwt="t" myUserId="u-me" online={new Set()} initialTab="active" onInvite={() => undefined} onChanged={() => undefined} onClose={() => undefined} />);
    await userEvent.click(await screen.findByTestId('tab-invitados'));
    expect(screen.getByTestId('fila-miembro-luis@empresa.pe')).toHaveTextContent('Invitado por correo');
    expect(screen.queryByTestId('acciones-undefined')).toBeNull();
    await userEvent.click(screen.getByTestId('retirar-luis@empresa.pe'));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.url.includes('/invites/inv1'))).toBe(true));
  });
});

describe('SpaceSettingsDialog (e1-12)', () => {
  it('saves the name, trade and approval; «Cambiar código» asks for a new one', async () => {
    answer('/workspaces/w1', { workspace: space({ name: 'QA Obra Norte', joinCode: 'QAOB-NEW1' }) }, 200, 'PATCH');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SpaceSettingsDialog space={space()} jwt="t" onSaved={() => undefined} onClose={() => undefined} />);
    await userEvent.clear(screen.getByTestId('input-nombre-ajustes'));
    await userEvent.type(screen.getByTestId('input-nombre-ajustes'), 'QA Obra Norte');
    await userEvent.selectOptions(screen.getByTestId('select-rubro-ajustes'), 'Maquinaria');
    await userEvent.click(screen.getByTestId('ajustes-aprobar'));
    await userEvent.click(screen.getByTestId('ajustes-espacio-guardar'));
    // Integraciones also asks for the space's apps when it opens: the saves are found by method, not by position.
    const patches = () => calls.filter((call) => call.method === 'PATCH');
    await waitFor(() => expect(patches()[0]?.body).toEqual({ name: 'QA Obra Norte', rubro: 'Maquinaria', joinPolicy: 'open' }));
    await userEvent.click(screen.getByTestId('ajustes-cambiar-codigo'));
    await waitFor(() => expect(patches()[1]?.body).toEqual({ newCode: true }));
    expect(await screen.findByTestId('codigo-ajustes')).toHaveTextContent('QAOB-NEW1');
  });
});

describe('«te agregaron» and «ya no tienes acceso» (e1-13, e1-14)', () => {
  it('says who added me and lets me in or leave it for later', async () => {
    answer('/channels', { channels: [{ id: 'c1', name: 'general', visibility: 'public', members: 3, joined: true }] });
    const onEnter = vi.fn();
    render(<AddedToSpaceDialog space={space({ role: 'member', joinCode: undefined, addedBy: { name: 'José Zamora', phone: '902049935' } })} jwt="t" onEnter={onEnter} onDirectory={() => undefined} onLater={() => undefined} />);
    expect(screen.getByText('José Zamora te agregó a QA Obra')).toBeInTheDocument();
    expect(await screen.findByText('general')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('te-agregaron-entrar'));
    expect(onEnter).toHaveBeenCalled();
  });

  it('without access: my personal chats stay, and I can talk to an admin', async () => {
    const onTalkTo = vi.fn();
    render(<AccessRemovedDialog space={space({ status: 'deactivated', role: 'member', joinCode: undefined, admins: [{ userId: 'u-me', name: 'José Zamora', phone: '902049935' }] })} onPersonal={() => undefined} onTalkTo={onTalkTo} />);
    expect(screen.getByText('Ya no tienes acceso a este espacio')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('sin-acceso-hablar'));
    expect(onTalkTo).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-me' }));
  });
});

describe('NewSpaceGroupDialog', () => {
  it('a group inside the space with its name and the chosen people', async () => {
    answer('/workspaces/w1/members?status=active', { members: people });
    answer('/chats', { chatId: 'g1' }, 201, 'POST');
    const onCreated = vi.fn();
    render(<NewSpaceGroupDialog space={space()} jwt="t" myUserId="u-me" onCreated={onCreated} onClose={() => undefined} />);
    await userEvent.type(screen.getByTestId('input-nombre-grupo-espacio'), 'Compras de obra');
    await userEvent.click(await screen.findByTestId('elegir-987654321'));
    await userEvent.click(screen.getByTestId('crear-grupo-espacio'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'g1', name: 'Compras de obra', memberIds: ['u-me', 'u-ana'] }));
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ kind: 'group', name: 'Compras de obra', memberIds: ['u-ana'], workspaceId: 'w1' });
  });
});

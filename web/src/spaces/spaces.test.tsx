import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientWorkspace } from '@lilachat/shared';
import type { ChatSummary } from '../chat/types';
import { JoinSpaceDialog } from './JoinSpaceDialog';
import { CreateSpaceDialog } from './CreateSpaceDialog';
import { SpacesRail } from './SpacesRail';
import { SpaceChatList } from './SpaceChatList';
import { ChannelsDialog } from './ChannelsDialog';
import { InviteToSpaceDialog } from './InviteToSpaceDialog';
import { spaceChats } from './spacesApi';

/**
 * The company spaces on the web (E1/E2; designs `e1-02`…`e1-06`, `e2-15`,
 * `e2-16`, `s-03`). What is checked is the REQUEST the server gets and what
 * the screen does with its answer — the same endpoints the phone uses.
 */
let calls: { url: string; method: string; body: unknown }[] = [];
let answers: Record<string, { status: number; body: unknown }> = {};

beforeEach(() => {
  calls = [];
  answers = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const key = Object.keys(answers).find((part) => url.includes(part));
      const answer = key ? answers[key]! : { status: 404, body: { message: 'No existe.' } };
      return new Response(answer.status === 204 ? null : JSON.stringify(answer.body), { status: answer.status });
    })
  );
});

const space = (extra: Partial<ClientWorkspace> = {}): ClientWorkspace => ({
  id: 'w1',
  name: 'QA Obra',
  rubro: 'Construcción',
  joinPolicy: 'approval',
  role: 'owner',
  status: 'active',
  joinCode: 'QAOB-7K3P',
  members: 3,
  unreadChats: 0,
  ...extra,
});

describe('JoinSpaceDialog', () => {
  it('the code shows the space before joining, and an approval space leaves the request waiting', async () => {
    answers['/workspaces/preview/QAOB-7K3P'] = { status: 200, body: { id: 'w1', name: 'QA Obra', rubro: 'Construcción', members: 3, joinPolicy: 'approval' } };
    answers['/workspaces/join'] = { status: 200, body: { workspaceId: 'w1', status: 'pending' } };
    const onJoined = vi.fn();
    render(<JoinSpaceDialog jwt="t" onJoined={onJoined} onClose={() => undefined} />);
    await userEvent.type(screen.getByTestId('input-codigo-espacio'), 'qaob-7k3p');
    expect(await screen.findByTestId('vista-previa-espacio')).toHaveTextContent('Construcción · 3 miembros');
    expect(screen.getByTestId('vista-previa-espacio')).toHaveTextContent('UN ADMIN APRUEBA TU INGRESO');
    await userEvent.click(screen.getByTestId('btn-unirse'));
    expect(await screen.findByTestId('solicitud-enviada')).toHaveTextContent('Pediste unirte a QA Obra');
    expect(calls.find((call) => call.url.includes('/join'))?.body).toEqual({ code: 'QAOB-7K3P' });
    expect(onJoined).not.toHaveBeenCalled();
  });

  it('an open space lets in at once; a wrong code says so in the field', async () => {
    answers['/workspaces/preview/QAOB-7K3P'] = { status: 200, body: { id: 'w1', name: 'QA Obra', members: 3, joinPolicy: 'open' } };
    answers['/workspaces/join'] = { status: 200, body: { workspaceId: 'w1', status: 'active' } };
    const onJoined = vi.fn();
    render(<JoinSpaceDialog jwt="t" onJoined={onJoined} onClose={() => undefined} />);
    await userEvent.type(screen.getByTestId('input-codigo-espacio'), 'NADA-0000');
    expect(await screen.findByTestId('error-codigo')).toHaveTextContent('No encontramos un espacio con ese código.');
    await userEvent.clear(screen.getByTestId('input-codigo-espacio'));
    await userEvent.type(screen.getByTestId('input-codigo-espacio'), 'https://lilachat.constroad.com/e/QAOB-7K3P');
    await screen.findByTestId('vista-previa-espacio');
    await userEvent.click(screen.getByTestId('btn-unirse'));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('w1'));
  });

  it('withdrawing a request leaves the space (design e1-03 «Cancelar solicitud»)', async () => {
    answers['/workspaces/preview/QAOB-7K3P'] = { status: 200, body: { id: 'w1', name: 'QA Obra', members: 3, joinPolicy: 'approval' } };
    answers['/workspaces/join'] = { status: 200, body: { workspaceId: 'w1', status: 'pending' } };
    answers['/workspaces/w1/leave'] = { status: 204, body: {} };
    const onClose = vi.fn();
    render(<JoinSpaceDialog jwt="t" onJoined={() => undefined} onClose={onClose} />);
    await userEvent.type(screen.getByTestId('input-codigo-espacio'), 'QAOB-7K3P');
    await screen.findByTestId('vista-previa-espacio');
    await userEvent.click(screen.getByTestId('btn-unirse'));
    await userEvent.click(await screen.findByTestId('solicitud-cancelar'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls.some((call) => call.url.includes('/workspaces/w1/leave') && call.method === 'POST')).toBe(true);
  });
});

describe('CreateSpaceDialog', () => {
  it('sends the name, the trade and whether an admin approves; the server error shows in the form', async () => {
    answers['/workspaces'] = { status: 409, body: { message: 'Ya tienes un espacio con ese nombre.' } };
    const onCreated = vi.fn();
    render(<CreateSpaceDialog jwt="t" onCreated={onCreated} onJoinInstead={() => undefined} onClose={() => undefined} />);
    expect(screen.getByTestId('btn-crear-espacio')).toBeDisabled();
    await userEvent.type(screen.getByTestId('input-nombre-espacio'), '  QA Obra ');
    await userEvent.selectOptions(screen.getByTestId('select-rubro'), 'Maquinaria');
    await userEvent.click(screen.getByTestId('toggle-aprobar'));
    await userEvent.click(screen.getByTestId('btn-crear-espacio'));
    expect(await screen.findByTestId('error-formulario')).toHaveTextContent('Ya tienes un espacio con ese nombre.');
    expect(calls[0]?.body).toEqual({ name: 'QA Obra', rubro: 'Maquinaria', joinPolicy: 'open' });
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe('SpacesRail', () => {
  it('personal first with its unread count, then each space with its own; a pending one says so', async () => {
    const onPick = vi.fn();
    render(
      <SpacesRail
        spaces={[space({ unreadChats: 4 }), space({ id: 'w2', name: 'Inframaq', status: 'pending' }), space({ id: 'w3', name: 'Fuera', status: 'deactivated' })]}
        currentId="w1"
        me={{ name: 'José Zamora', phone: '902049935' }}
        personalUnread={2}
        onPick={onPick}
        onAdd={() => undefined}
      />
    );
    expect(screen.getByTestId('riel-personal')).toHaveAccessibleName('Personal, 2 sin leer');
    expect(screen.getByTestId('riel-espacio-w1')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('riel-espacio-w1')).toHaveAccessibleName('QA Obra, 4 sin leer');
    expect(screen.getByTestId('riel-espacio-w2')).toHaveAccessibleName('Inframaq, pendiente de aprobación');
    expect(screen.queryByTestId('riel-espacio-w3')).toBeNull();
    await userEvent.click(screen.getByTestId('riel-personal'));
    expect(onPick).toHaveBeenCalledWith(null);
  });
});

describe('SpaceChatList', () => {
  const chat = (id: string, extra: Partial<ChatSummary>): ChatSummary => ({ id, kind: 'group', memberIds: [], lastSeq: 1, unread: 0, othersReadSeq: 0, othersDeliveredSeq: 0, lastMessage: null, ...extra }) as ChatSummary;

  const list = (chats: ChatSummary[] | null, extra: Partial<Parameters<typeof SpaceChatList>[0]> = {}) => (
    <SpaceChatList space={space()} chats={chats} failed={false} onRetry={() => undefined} yo="u1" me={{ name: 'José', phone: '902049935' }} selectedChatId={null} onOpenChat={() => undefined} onAccion={() => undefined} onSwitch={() => undefined} onChannels={() => undefined} onInvite={() => undefined} onWorkspace={() => undefined} onNewDirect={() => undefined} onNewGroup={() => undefined} onSettings={() => undefined} {...extra} />
  );

  it('channels, groups and direct messages in sections, folded with the arrow, with the code to copy at the foot', async () => {
    const onOpenChat = vi.fn();
    render(list([chat('c1', { name: 'planta', channel: { visibility: 'public' }, unread: 3 }), chat('c2', { name: 'general', channel: { visibility: 'public' } }), chat('g1', { name: 'Compras de obra' }), chat('d1', { kind: 'direct', name: 'Ana Torres' })], { onOpenChat }));
    expect(screen.getByTestId('seccion-channels')).toHaveTextContent(/general.*planta/);
    expect(screen.getByTestId('seccion-groups')).toHaveTextContent('Compras de obra');
    expect(screen.getByTestId('seccion-directs')).toHaveTextContent('Ana Torres');
    expect(screen.getByTestId('titulo-espacio')).toHaveTextContent('3 miembros · Construcción');
    expect(screen.getByTestId('codigo-del-espacio')).toHaveTextContent('QAOB-7K3P');
    await userEvent.click(screen.getByTestId('plegar-channels'));
    expect(screen.queryByTestId('canal-fila-c1')).toBeNull();
    await userEvent.click(screen.getByTestId('plegar-channels'));
    await userEvent.click(screen.getByTestId('canal-fila-c1'));
    expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });

  it('an empty space invites to the channels and to the team; a failed load offers to retry', async () => {
    const onChannels = vi.fn();
    const { unmount } = render(list([], { onChannels }));
    expect(screen.getByTestId('espacio-vacio')).toHaveTextContent('Bienvenido a QA Obra');
    await userEvent.click(screen.getByTestId('espacio-ver-canales'));
    expect(onChannels).toHaveBeenCalled();
    unmount();
    const onRetry = vi.fn();
    render(list(null, { failed: true, onRetry }));
    await userEvent.click(screen.getByText('No se pudo cargar el espacio. Toca para reintentar.'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('a chat of a space carries its space, so it opens in the Slack format', async () => {
    answers['/chats?workspace=w1'] = { status: 200, body: { chats: [chat('c1', { name: 'general', channel: { visibility: 'public' } })] } };
    const response = await spaceChats('t', 'w1');
    expect(response.ok && response.data.chats[0]).toEqual(expect.objectContaining({ id: 'c1', workspaceId: 'w1' }));
  });
});

describe('ChannelsDialog', () => {
  it('lists the channels by tab, joins a public one and opens it', async () => {
    answers['/channels/c3/join'] = { status: 200, body: { channel: { id: 'c3', name: 'compras', visibility: 'public', members: 2, joined: true } } };
    answers['/workspaces/w1/channels'] = {
      status: 200,
      body: {
        channels: [
          { id: 'c1', name: 'general', visibility: 'public', members: 3, joined: true },
          { id: 'c3', name: 'compras', descripcion: 'Órdenes de compra', visibility: 'public', members: 1, joined: false },
          { id: 'c4', name: 'gerencia', visibility: 'private', members: 2, joined: true },
        ],
      },
    };
    const onOpen = vi.fn();
    render(<ChannelsDialog space={space()} jwt="t" onOpenChannel={onOpen} onClose={() => undefined} />);
    expect(await screen.findByTestId('canales-all')).toHaveTextContent('Todos (3)');
    expect(screen.getByTestId('canales-private')).toHaveTextContent('Privados (1)');
    await userEvent.click(screen.getByTestId('unirme-compras'));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'c3', joined: true })));
  });
});

describe('InviteToSpaceDialog', () => {
  it('email is the first way to send the code (a company invites by email), then WhatsApp', () => {
    render(<InviteToSpaceDialog space={space()} jwt="t" inviterName="José Zamora" onClose={() => undefined} />);
    const email = screen.getByTestId('btn-correo-codigo');
    const whatsapp = screen.getByTestId('btn-whatsapp-codigo');
    expect(email.compareDocumentPosition(whatsapp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const link = email.getAttribute('href') ?? '';
    expect(link.startsWith('mailto:?subject=')).toBe(true);
    const params = new URLSearchParams(link.slice('mailto:?'.length));
    expect(params.get('subject')).toBe('Invitación al espacio de QA Obra en Lilachat');
    expect(params.get('body')).toContain('José Zamora te invita');
    expect(params.get('body')).toContain('QAOB-7K3P');
  });
  it('without the code (only admins have it), neither email nor WhatsApp shows', () => {
    render(<InviteToSpaceDialog space={space({ joinCode: undefined, role: 'member' })} jwt="t" onClose={() => undefined} />);
    expect(screen.queryByTestId('btn-correo-codigo')).toBeNull();
    expect(screen.queryByTestId('btn-whatsapp-codigo')).toBeNull();
  });
});

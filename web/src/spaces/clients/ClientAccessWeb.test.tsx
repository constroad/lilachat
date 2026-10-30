import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientAccessSection, JoinClientChannelDialog } from './ClientAccessWeb';

/** José 30/10 night: topographers and engineers see only some tabs and stages; money only for admins. */
afterEach(() => vi.unstubAllGlobals());

const STAGE = 'a'.repeat(24);
const target = { jwt: 'jwt', spaceId: 'w1', clientId: 'cli-1' };
const people = [{ id: 'u1', name: 'José' }, { id: 'u2', name: 'Topógrafo' }];
const stages = [{ id: STAGE, title: 'Topografía' }];
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('ClientAccessSection', () => {
  it('lists what each one sees and saves a restricted access with the stage picked', async () => {
    // Arrange
    const list = { viewers: [], restricted: [], admins: ['u1'] };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => reply(init?.method === 'PUT' ? { ...list, restricted: [{ user_id: 'u2', tabs: ['checklist'], stages: [STAGE] }] } : list));
    vi.stubGlobal('fetch', fetchMock);
    render(<ClientAccessSection target={target} people={people} stages={stages} />);
    // Act
    fireEvent.click(await screen.findByTestId('accesos-del-canal'));
    expect(screen.getByText('Admin del espacio · ve todo')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('acceso-de-u2'));
    fireEvent.click(screen.getByTestId('acceso-some'));
    fireEvent.click(screen.getByTestId(`acceso-etapa-${STAGE}`));
    fireEvent.click(screen.getByTestId('guardar-acceso'));
    // Assert
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/workspaces/w1/clients/cli-1/access/u2', expect.objectContaining({ method: 'PUT' })));
    const sent = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')?.[1]?.body));
    expect(sent).toEqual({ money: false, restricted: { tabs: ['checklist'], stages: [STAGE] } });
  });

  it('a member who is not an admin of the space does not see the row (403)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({ message: 'Solo los admins' }, 403)));
    render(<ClientAccessSection target={target} people={people} stages={stages} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId('accesos-del-canal')).not.toBeInTheDocument();
  });

  it('a refusal stays in the dialog', async () => {
    const list = { viewers: [], restricted: [], admins: [] };
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'PUT' ? reply({ message: 'Un admin del espacio ve todo el canal.' }, 400) : reply(list))));
    render(<ClientAccessSection target={target} people={people} stages={stages} />);
    fireEvent.click(await screen.findByTestId('accesos-del-canal'));
    fireEvent.click(screen.getByTestId('acceso-de-u1'));
    fireEvent.click(screen.getByTestId('acceso-some'));
    fireEvent.click(screen.getByTestId('guardar-acceso'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Un admin del espacio ve todo el canal.');
  });
});

describe('JoinClientChannelDialog', () => {
  it('adds with the history choice and the access picked', () => {
    // Arrange
    const onConfirm = vi.fn();
    render(<JoinClientChannelDialog name="Topógrafo" askHistory stages={stages} onConfirm={onConfirm} onClose={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('historial-desde-ahora'));
    fireEvent.click(screen.getByTestId('acceso-some'));
    fireEvent.click(screen.getByTestId('acceso-pestana-services'));
    fireEvent.click(screen.getByTestId('confirmar-agregar'));
    // Assert
    expect(onConfirm).toHaveBeenCalledWith(false, { tabs: ['services', 'checklist'], stages: [] });
  });

  it('the whole channel is the default; without history there is no question about it', () => {
    const onConfirm = vi.fn();
    render(<JoinClientChannelDialog name="Ana" askHistory={false} stages={[]} onConfirm={onConfirm} onClose={vi.fn()} />);
    expect(screen.queryByTestId('historial-todo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirmar-agregar'));
    expect(onConfirm).toHaveBeenCalledWith(undefined, null);
  });
});

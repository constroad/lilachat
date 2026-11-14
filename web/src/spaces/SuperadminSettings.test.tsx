import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SuperadminSettings } from './SuperadminSettings';

/**
 * José 13/11 (corrected): «Ver incógnitos» lives in Ajustes → Superadmin, not in the space switcher.
 * It lists the spaces where he is hidden, and «Entrar» opens one (he only reads there).
 */
const globofast = { id: 'g1', name: 'Globofast', status: 'active', role: 'owner', members: 2, unreadChats: 0, incognito: true };

const answer = (workspaces: unknown[]) => vi.fn(() => Promise.resolve(new Response(JSON.stringify({ workspaces }), { status: 200 })));
const open = () => fireEvent.click(screen.getByTestId('btn-incognitos'));

describe('SuperadminSettings', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the users link and «Ver incógnitos» under «Superadmin», with the list closed', () => {
    vi.stubGlobal('fetch', answer([]));

    render(<SuperadminSettings jwt="t" onEnter={vi.fn()} />);

    expect(screen.getByText('Superadmin')).toBeTruthy();
    expect(screen.getByTestId('btn-usuarios-lilachat').getAttribute('href')).toBe('/admin');
    expect(screen.getByTestId('btn-incognitos').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('lista-incognitos')).toBeNull();
  });

  it('does not ask the server until the row is opened', () => {
    const fetchSpy = answer([globofast]);
    vi.stubGlobal('fetch', fetchSpy);

    render(<SuperadminSettings jwt="t" onEnter={vi.fn()} />);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lists the spaces where he is hidden, with how many people they have', async () => {
    const fetchSpy = answer([globofast]);
    vi.stubGlobal('fetch', fetchSpy);
    render(<SuperadminSettings jwt="t" onEnter={vi.fn()} />);

    open();

    expect(await screen.findByText('Globofast')).toBeTruthy();
    expect(screen.getByTestId('btn-incognitos').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/2 miembros/)).toBeTruthy();
    expect(String((fetchSpy.mock.calls[0] as unknown[])[0])).toContain('/admin/incognito');
  });

  it('brings the list into view when it opens: in the settings panel it lands below the fold', async () => {
    const original = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal('fetch', answer([globofast]));
    render(<SuperadminSettings jwt="t" onEnter={vi.fn()} />);

    open();

    await screen.findByText('Globofast');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    Element.prototype.scrollIntoView = original;
  });

  it('opens the space he picks', async () => {
    const onEnter = vi.fn();
    vi.stubGlobal('fetch', answer([globofast]));
    render(<SuperadminSettings jwt="t" onEnter={onEnter} />);
    open();

    fireEvent.click(await screen.findByTestId('entrar-incognito-g1'));

    expect(onEnter).toHaveBeenCalledWith('g1');
  });

  it('says so when he is hidden nowhere', async () => {
    vi.stubGlobal('fetch', answer([]));
    render(<SuperadminSettings jwt="t" onEnter={vi.fn()} />);

    open();

    expect(await screen.findByTestId('incognitos-vacio')).toBeTruthy();
  });

  it('closes the list on a second tap', async () => {
    vi.stubGlobal('fetch', answer([globofast]));
    render(<SuperadminSettings jwt="t" onEnter={vi.fn()} />);
    open();
    await screen.findByText('Globofast');

    open();

    expect(screen.queryByTestId('lista-incognitos')).toBeNull();
  });

  it('shows an error, and tries again when asked', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify({ workspaces: [globofast] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    render(<SuperadminSettings jwt="t" onEnter={vi.fn()} />);
    open();

    fireEvent.click(await screen.findByTestId('incognitos-reintentar'));

    await waitFor(() => expect(screen.getByText('Globofast')).toBeTruthy());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

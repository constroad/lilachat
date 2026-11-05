import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENLACE_DE_DESCARGA } from '@lilachat/shared';
import { InstallStrip } from './InstallStrip';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 6) Chrome/130.0 Mobile Safari/537.36';

function browsingOn(userAgent: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

function serverSays(body: unknown, status = 200) {
  const server = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', server);
  return server;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('InstallStrip', () => {
  it('shows an iPhone the steps, and warns that the installed app signs in again', async () => {
    browsingOn(IPHONE);
    const server = serverSays({});
    render(<InstallStrip jwt="jwt" />);

    expect(screen.getByTestId('franja-instalar')).toHaveTextContent('entras de nuevo');
    await userEvent.click(screen.getByTestId('btn-franja-instalar'));
    expect(screen.getByTestId('paso-iphone-2')).toHaveTextContent('Añadir a pantalla de inicio');
    expect(server).not.toHaveBeenCalled();
  });

  it('tells someone in Chrome on an iPhone to open Safari first', async () => {
    browsingOn('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1');
    serverSays({});
    render(<InstallStrip jwt="jwt" />);

    await userEvent.click(screen.getByTestId('btn-franja-instalar'));
    expect(screen.getByTestId('aviso-abrir-en-safari')).toHaveTextContent('Safari');
  });

  it('adds nothing in Safari itself', async () => {
    browsingOn(IPHONE);
    serverSays({});
    render(<InstallStrip jwt="jwt" />);

    await userEvent.click(screen.getByTestId('btn-franja-instalar'));
    expect(screen.queryByTestId('aviso-abrir-en-safari')).not.toBeInTheDocument();
  });

  it('closing it keeps it away after a reload', async () => {
    browsingOn(IPHONE);
    serverSays({});
    const { unmount } = render(<InstallStrip jwt="jwt" />);

    await userEvent.click(screen.getByTestId('btn-cerrar-franja'));
    expect(screen.queryByTestId('franja-instalar')).not.toBeInTheDocument();
    unmount();
    render(<InstallStrip jwt="jwt" />);
    expect(screen.queryByTestId('franja-instalar')).not.toBeInTheDocument();
  });

  it('sends an Android account without the app to LilaStore, and counts that as answered', async () => {
    browsingOn(ANDROID);
    serverSays({ hasAndroidApp: false });
    render(<InstallStrip jwt="jwt" />);

    const link = await screen.findByTestId('btn-franja-instalar');
    expect(link).toHaveAttribute('href', ENLACE_DE_DESCARGA);
    await userEvent.click(link);
    expect(screen.queryByTestId('franja-instalar')).not.toBeInTheDocument();
  });

  it('says nothing to an Android account that already has the app', async () => {
    browsingOn(ANDROID);
    const server = serverSays({ hasAndroidApp: true });
    render(<InstallStrip jwt="jwt" />);

    await waitFor(() => expect(server).toHaveBeenCalled());
    expect(screen.queryByTestId('franja-instalar')).not.toBeInTheDocument();
  });

  it('says nothing on Android when the server fails', async () => {
    browsingOn(ANDROID);
    const server = serverSays({ message: 'no' }, 500);
    render(<InstallStrip jwt="jwt" />);

    await waitFor(() => expect(server).toHaveBeenCalled());
    expect(screen.queryByTestId('franja-instalar')).not.toBeInTheDocument();
  });

  it('says nothing on a computer and asks the server nothing', () => {
    const server = serverSays({});
    render(<InstallStrip jwt="jwt" />);

    expect(screen.queryByTestId('franja-instalar')).not.toBeInTheDocument();
    expect(server).not.toHaveBeenCalled();
  });
});

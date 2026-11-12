import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortalEmbedWeb } from './PortalEmbedWeb';

/**
 * Portal's canvas editor framed over the whole window (Portal 11/11): the link
 * asked per member, messages v1 only from Portal's origin and frame, Volver and
 * Escape ask Portal to close, an expired link is asked again.
 */
const target = { jwt: 't', spaceId: 'w1', clientId: 'c1' };
const report = { id: 'r1', title: 'Control de pista 11/11', status: { label: 'Borrador', tone: 'warn' as const }, editor: 'v2' as const };
const PORTAL = 'https://www.constroad.com';
const linkOf = (token: string) => ({ url: `${PORTAL}/embed/report/r1#t=${token}`, expiresAt: '2026-11-12T08:00:00.000Z' });

function portal(replies: unknown[]) {
  const asked: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    asked.push(String(url));
    const reply = replies[Math.min(asked.length - 1, replies.length - 1)];
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return asked;
}

const frame = () => screen.getByTestId('editor-portal-marco') as HTMLIFrameElement;
function fromPortal(data: unknown, origin = PORTAL, source: MessageEventSource | null = frame().contentWindow) {
  act(() => { window.dispatchEvent(new MessageEvent('message', { data, origin, source })); });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

describe('PortalEmbedWeb', () => {
  it('asks the link and frames it over the window with Volver, the service and the report', async () => {
    const asked = portal([{ embed: linkOf('a1') }]);
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={vi.fn()} />);

    await waitFor(() => expect(frame().src).toBe(`${PORTAL}/embed/report/r1#t=a1`));
    expect(asked[0]).toContain('/workspaces/w1/clients/c1/services/sv1/reports/r1/embed');
    expect(screen.getByTestId('editor-portal')).toHaveTextContent('Av. Los Incas');
    expect(screen.getByTestId('editor-portal')).toHaveTextContent('Control de pista 11/11');
  });

  it('on ready it tells Portal the theme, only to Portal\'s origin; another sender is ignored', async () => {
    portal([{ embed: linkOf('a1') }]);
    document.documentElement.classList.add('dark');
    const onClose = vi.fn();
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={onClose} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));
    const post = vi.spyOn(frame().contentWindow!, 'postMessage');

    fromPortal({ type: 'portal-embed:closed', version: 1 }, 'https://evil.example.com');
    fromPortal({ type: 'portal-embed:closed', version: 1 }, PORTAL, window);
    expect(onClose).not.toHaveBeenCalled();
    fromPortal({ type: 'portal-embed:ready', version: 1 });
    expect(post).toHaveBeenCalledWith({ type: 'portal-embed:theme', version: 1, mode: 'dark' }, PORTAL);
  });

  it('once Portal is ready only its bar shows (José 12/11); Escape asks Portal to close, and after a save its «closed» says something changed', async () => {
    portal([{ embed: linkOf('a1') }]);
    const onClose = vi.fn();
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={onClose} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));
    const post = vi.spyOn(frame().contentWindow!, 'postMessage');
    fromPortal({ type: 'portal-embed:ready', version: 1 });
    fromPortal({ type: 'portal-embed:saved', version: 1, reportId: 'r1', savedAt: '2026-11-11T20:00:00.000Z' });
    expect(screen.queryByTestId('editor-portal-volver')).toBeNull();

    await userEvent.keyboard('{Escape}');
    expect(post).toHaveBeenCalledWith({ type: 'portal-embed:close-request', version: 1 }, PORTAL);
    expect(onClose).not.toHaveBeenCalled();
    fromPortal({ type: 'portal-embed:closed', version: 1 });
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('closes once: what Portal posts after «closed» (the same save\'s dirty or saved) is ignored', async () => {
    portal([{ embed: linkOf('a1') }]);
    const onClose = vi.fn();
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={onClose} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));
    fromPortal({ type: 'portal-embed:ready', version: 1 });
    const source = frame().contentWindow;

    fromPortal({ type: 'portal-embed:closed', version: 1 });
    fromPortal({ type: 'portal-embed:saved', version: 1, reportId: 'r1', savedAt: '2026-11-11T20:00:00.000Z' }, PORTAL, source);
    fromPortal({ type: 'portal-embed:closed', version: 1 }, PORTAL, source);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('before Portal is ready its own bar has Volver, which closes at once; so does Escape', async () => {
    portal([{ embed: linkOf('a1') }]);
    const onClose = vi.fn();
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={onClose} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));
    await userEvent.click(screen.getByTestId('editor-portal-volver'));
    expect(onClose).toHaveBeenCalledWith(false);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('a Portal error brings Lilachat\'s bar back, so the person can leave', async () => {
    portal([{ embed: linkOf('a1') }]);
    const onClose = vi.fn();
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={onClose} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));
    fromPortal({ type: 'portal-embed:ready', version: 1 });
    expect(screen.queryByTestId('editor-portal-volver')).toBeNull();
    fromPortal({ type: 'portal-embed:error', version: 1, code: 'not_found' });
    await userEvent.click(await screen.findByTestId('editor-portal-volver'));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('an expired link is asked again and the frame reloads with the new one', async () => {
    const asked = portal([{ embed: linkOf('a1') }, { embed: linkOf('b2') }]);
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={vi.fn()} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));

    fromPortal({ type: 'portal-embed:error', version: 1, code: 'expired' });
    await waitFor(() => expect(frame().src).toContain('#t=b2'));
    expect(asked).toHaveLength(2);
  });

  it('says why when the editor does not open, and asks again on Reintentar', async () => {
    const asked = portal([{ error: 'report_embed_failed', message: 'Este informe ya no está en el Portal.' }, { embed: linkOf('a1') }]);
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={vi.fn()} />);

    expect(await screen.findByTestId('editor-portal-fallo')).toHaveTextContent('Este informe ya no está en el Portal.');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(frame().src).toContain('#t=a1'));
    expect(asked).toHaveLength(2);
  });

  it('a Portal error in words, never its code', async () => {
    portal([{ embed: linkOf('a1') }]);
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={vi.fn()} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));
    fromPortal({ type: 'portal-embed:error', version: 1, code: 'forbidden' });
    expect(await screen.findByTestId('editor-portal-fallo')).toHaveTextContent('No tienes permiso para editar este informe.');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  vi.useRealTimers();
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

  it('a save that hangs does not trap the person (E2E 12/11: «Guardando…» for a minute, no «closed»): after 45 s unsaved Lilachat\'s bar comes back with «Salir igual»', async () => {
    portal([{ embed: linkOf('a1') }]);
    const onClose = vi.fn();
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={onClose} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));
    vi.useFakeTimers();
    fromPortal({ type: 'portal-embed:ready', version: 1 });
    fromPortal({ type: 'portal-embed:dirty', version: 1, dirty: true });

    act(() => { vi.advanceTimersByTime(44_000); });
    expect(screen.queryByTestId('editor-portal-atascado')).toBeNull();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByTestId('editor-portal-atascado')).toHaveTextContent('Los cambios aún no se guardan en el Portal');
    fireEvent.click(screen.getByTestId('editor-portal-salir'));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('a save on time keeps Portal\'s bar alone: each «saved» starts the count again, and a clean editor never warns', async () => {
    portal([{ embed: linkOf('a1') }]);
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={vi.fn()} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));
    vi.useFakeTimers();
    fromPortal({ type: 'portal-embed:ready', version: 1 });
    fromPortal({ type: 'portal-embed:dirty', version: 1, dirty: true });

    act(() => { vi.advanceTimersByTime(30_000); });
    fromPortal({ type: 'portal-embed:saved', version: 1, reportId: 'r1', savedAt: '2026-11-12T12:00:00.000Z' });
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.queryByTestId('editor-portal-atascado')).toBeNull();
    fromPortal({ type: 'portal-embed:dirty', version: 1, dirty: false });
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(screen.queryByTestId('editor-portal-atascado')).toBeNull();
    expect(screen.queryByTestId('editor-portal-volver')).toBeNull();
  });

  it('an expired link is asked again and the frame reloads with the new one', async () => {
    const asked = portal([{ embed: linkOf('a1') }, { embed: linkOf('b2') }]);
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={report} onClose={vi.fn()} />);
    await waitFor(() => expect(frame().src).toContain('#t=a1'));

    fromPortal({ type: 'portal-embed:error', version: 1, code: 'expired' });
    await waitFor(() => expect(frame().src).toContain('#t=b2'));
    expect(asked).toHaveLength(2);
  });

  it('a new report is created in the editor with its type and responsible; an expired link asks for that report, never creates another', async () => {
    const created = 'https://www.constroad.com/embed/report/6af0000000000000000000a1';
    const calls: { url: string; body: string }[] = [];
    const replies = [{ embed: { url: `${created}#t=n1`, expiresAt: '2026-11-13T08:00:00.000Z' } }, { embed: { url: `${created}#t=n2`, expiresAt: '2026-11-13T09:00:00.000Z' } }];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: typeof init?.body === 'string' ? init.body : '' });
      return new Response(JSON.stringify(replies[Math.min(calls.length - 1, 1)]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    render(<PortalEmbedWeb target={target} serviceId="sv1" serviceName="Av. Los Incas" report={{ title: 'Control de imprimación', create: { type: 'CTL-IMP', responsible: 'Ana Torres' } }} onClose={vi.fn()} />);

    await waitFor(() => expect(frame().src).toBe(`${created}#t=n1`));
    expect(calls[0]!.url).toContain('/workspaces/w1/clients/c1/services/sv1/reports/embed');
    expect(JSON.parse(calls[0]!.body)).toEqual({ type: 'CTL-IMP', responsible: 'Ana Torres' });
    fromPortal({ type: 'portal-embed:error', version: 1, code: 'expired' });
    await waitFor(() => expect(frame().src).toContain('#t=n2'));
    expect(calls[1]!.url).toContain('/reports/6af0000000000000000000a1/embed');
    expect(calls[1]!.body).toBe('');
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

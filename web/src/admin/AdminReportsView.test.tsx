import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AdminReport, AdminReportsPage } from '@lilachat/shared';
import { AdminReportsView } from './AdminReportsView';

/** Google Play (José 19/11): the superadmin's queue, child abuse first, with the evidence and resolve/dismiss. */
const base: AdminReport = {
  id: 'r-spam',
  target: 'user',
  reason: 'spam',
  note: '',
  priority: 'normal',
  status: 'open',
  createdAt: '2026-11-19T15:00:00.000Z',
  reporter: { id: 'u1', name: 'Ana', phone: '911111111' },
  reported: { id: 'u2', name: 'Beto', phone: '922222222' },
  chat: null,
  space: null,
  evidence: null,
  alsoBlocked: false,
  closedAt: null,
  closedNote: '',
};
const abuse: AdminReport = {
  ...base,
  id: 'r-abuse',
  target: 'message',
  reason: 'child_abuse',
  priority: 'high',
  note: 'es grave',
  createdAt: '2026-11-18T10:00:00.000Z',
  chat: { id: 'c1', name: 'obra', kind: 'group' },
  space: { id: 's1', name: 'Inframaq' },
  evidence: { seq: 4, senderId: 'u2', kind: 'text', body: 'Te voy a buscar', mediaIds: [], sentAt: '2026-11-18T09:59:00.000Z', encrypted: false },
  alsoBlocked: true,
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const pageOf = (reports: AdminReport[]): AdminReportsPage => ({ reports, total: reports.length, open: reports.length, page: 1, pageSize: 30 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdminReportsView', () => {
  it('urgent first, with who, where, the note and the copy of the message', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => json(200, pageOf([base, abuse]))));
    // Act
    render(<AdminReportsView jwt="jwt" />);
    // Assert
    const rows = await screen.findAllByTestId(/^denuncia-r-/);
    expect(rows.map((row) => row.dataset.testid)).toEqual(['denuncia-r-abuse', 'denuncia-r-spam']);
    const first = within(rows[0] as HTMLElement);
    expect(first.getByText('Urgente')).toBeInTheDocument();
    expect(first.getByText('Abuso infantil')).toBeInTheDocument();
    expect(first.getByTestId('denuncia-evidencia')).toHaveTextContent('Te voy a buscar');
    expect(first.getByText(/Inframaq/)).toBeInTheDocument();
    expect(first.getByText('es grave')).toBeInTheDocument();
  });

  it('«Resolver» closes it with the note and reads the queue again', async () => {
    // Arrange
    const fetchMock = vi.fn(async (url: string) => (url.includes('/close') ? json(200, { ok: true }) : json(200, pageOf([base]))));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminReportsView jwt="jwt" />);
    const row = within(await screen.findByTestId('denuncia-r-spam'));
    // Act
    fireEvent.change(row.getByTestId('denuncia-nota-cierre'), { target: { value: 'Avisé al admin' } });
    fireEvent.click(row.getByTestId('denuncia-resolver'));
    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/reports/r-spam/close', expect.objectContaining({ method: 'POST', body: JSON.stringify({ outcome: 'resolved', note: 'Avisé al admin' }) })));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/admin/reports?')).length).toBe(2));
  });

  it('«Cerradas» asks for the closed ones; an empty queue says so', async () => {
    const fetchMock = vi.fn(async () => json(200, pageOf([])));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminReportsView jwt="jwt" />);
    expect(await screen.findByTestId('admin-vacio')).toHaveTextContent('No hay denuncias abiertas.');
    fireEvent.click(screen.getByTestId('denuncias-cerradas'));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/reports?estado=cerradas&page=1', expect.anything()));
  });
});

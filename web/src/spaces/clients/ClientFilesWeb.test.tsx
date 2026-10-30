import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpaceClient, WorkStage } from '@lilachat/shared';
import { ClientFilesWeb } from './ClientFilesWeb';

/** José 30/10: «una sola pestaña Archivos» — the checklist's files and Portal's Drive per service. */
afterEach(() => vi.unstubAllGlobals());
const client: SpaceClient = { id: 'cli-cvs', chat_id: 'c9', name: 'Constructora Vía Sur', live: true, archived_since: null, last_activity_at: null, last_order_at: null, orders_total: 2, archived_group: null, services: [{ id: 'srv-318', name: 'Pavimentación Av. Los Álamos', status: 'in_progress', stage_label: '' }], drive_url: 'https://portal.constroad.com/drive/c1' } as unknown as SpaceClient;
const photo = { seq: 12, kind: 'image' as const, url: 'https://x/media/12.jpg', name: 'probeta.jpg', sizeBytes: 2048, by: 'yo', at: '2026-10-23T15:14:00Z' };
const stages: WorkStage[] = [{ _id: 's3', title: 'Ejecución', stage: 3, items: [{ id: 'b', text: 'Control de densidad', doneBy: null, doneAt: null, evidence: [photo] }] }];
const target = { jwt: 'j', spaceId: 'w1', clientId: 'cli-cvs' };

describe('ClientFilesWeb', () => {
  it('opens on «Del canal» when the checklist has files, with its count', () => {
    render(<ClientFilesWeb client={client} target={target} stages={stages} onOpenMessage={() => undefined} />);
    expect(screen.getByTestId('archivos-channel')).toHaveTextContent('Del canal · 1');
    expect(screen.getByTestId('archivos-channel')).toHaveAttribute('aria-selected', 'true');
  });

  it('«Drive del Portal» shows the client Drive and each service; one opens its Drive', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ files: [{ name: 'densidades.pdf', mime: 'application/pdf', url: 'https://x/d', folder: 'Informes' }], drive_url: null }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ClientFilesWeb client={client} target={target} stages={[]} onOpenMessage={() => undefined} />);
    // Act
    fireEvent.click(screen.getByTestId('drive-de-srv-318'));
    // Assert
    expect(await screen.findByTestId('carpeta-Informes')).toHaveTextContent('1');
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('/services/srv-318/files');
    fireEvent.click(screen.getByTestId('volver-a-drive'));
    expect(screen.getByTestId('drive-cliente')).toHaveAttribute('href', 'https://portal.constroad.com/drive/c1');
  });
});

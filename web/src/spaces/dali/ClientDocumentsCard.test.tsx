import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ClientDocumentsCard } from './ClientDocumentsCard';
import { UnderstoodCard } from './prospectSheetBlocks';
import { prospectOf } from './daliTestData';
import { fetchProspectDocuments } from './prospectsApi';

vi.mock('./prospectsApi', () => ({ fetchProspectDocuments: vi.fn() }));
const fetching = vi.mocked(fetchProspectDocuments);
const KML = { seq: 7, kind: 'file' as const, name: 'METRADOS 161126.kml', mime: 'application/octet-stream', url: '/media/bot/st-1', at: '2026-11-17T14:02:00.000Z' };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ClientDocumentsCard (José 17/11: a KML, a photo or a PDF with metrados)', () => {
  it('lists what the client sent, and a tap downloads it with its own name', async () => {
    fetching.mockResolvedValue({ ok: true, data: { documents: [KML] } });
    render(<ClientDocumentsCard jwt="jwt" spaceId="space" prospect={prospectOf()} />);
    const link = await screen.findByTestId('documento-7');
    expect(link.textContent).toContain('METRADOS 161126.kml');
    expect(link.getAttribute('href')).toBe('/media/bot/st-1?download=METRADOS%20161126.kml');
    expect(link.getAttribute('download')).toBe('METRADOS 161126.kml');
  });

  it('shows nothing when the client sent no file, and says so when it could not load', async () => {
    fetching.mockResolvedValueOnce({ ok: true, data: { documents: [] } });
    const { rerender } = render(<ClientDocumentsCard jwt="jwt" spaceId="space" prospect={prospectOf()} />);
    await vi.waitFor(() => expect(fetching).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('ficha-documentos')).toBeNull();
    fetching.mockResolvedValueOnce({ ok: false, status: 0, message: 'Sin conexión' });
    rerender(<ClientDocumentsCard jwt="jwt" spaceId="space" prospect={prospectOf({ lastActivityAt: '2026-11-17T19:00:00.000Z' })} />);
    expect((await screen.findByTestId('ficha-documentos')).textContent).toContain('No pudimos cargar los documentos');
  });
});

describe('UnderstoodCard with a field read from a document', () => {
  it('marks it «por confirmar» until someone confirms it', () => {
    const fields = [{ key: 'area_m2', label: 'Área', value: '1 240 m²', source: 'document' as const, fileId: 'a'.repeat(24), confirmed: false }, { key: 'district', label: 'Distrito', value: 'Ate' }];
    render(<UnderstoodCard prospect={prospectOf({ fields })} />);
    expect(screen.getByTestId('por-confirmar-area_m2').textContent).toBe('Leído del documento · por confirmar');
    expect(screen.queryByTestId('por-confirmar-district')).toBeNull();
  });
});

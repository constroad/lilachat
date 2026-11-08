import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { workMapOf, type MapEditSend, type TraceUpload, type WorkMap, type WorkMapFilter } from '@lilachat/shared';
import { ShareProgress } from './ShareProgress';
import { WorkMapExport } from './WorkMapExport';

/** Designs o-08 («Compartir avance») and o-12 («Exportar»): the cut, what it shows, and what leaves. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const mapOf = (progress: Array<Record<string, unknown>>): WorkMap => workMapOf({
  workStreets: {
    streets: [{ _id: 's1', name: 'Jr. Los Pinos', geometry: line, lengthM: 320 }],
    scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 320, tagIds: ['base'], partidaIds: [], stageId: 'e1' }],
    progress,
    tags: [{ _id: 'base', name: 'Base', color: '#d97706', order: 1 }],
    stages: [{ _id: 'e1', name: 'Etapa 1', order: 1 }],
  },
})!;
const done = [{ streetId: 's1', tagId: 'base', fromM: 0, toM: 120, date: '2026-11-01' }, { streetId: 's1', tagId: 'base', fromM: 120, toM: 200, date: '2026-11-04' }];

describe('ShareProgress (o-08)', () => {
  it('shows the front summary for the cut; changing the stage or the day moves the map\'s filter', () => {
    // Arrange
    const onFilter = vi.fn<(filter: WorkMapFilter) => void>();
    render(<ShareProgress map={mapOf(done)} filter={{ untilDay: '2026-11-01' }} onFilter={onFilter} onClose={vi.fn()} />);
    // Act
    fireEvent.change(screen.getByTestId('corte-etapa'), { target: { value: 'e1' } });
    fireEvent.change(screen.getByTestId('corte-dia'), { target: { value: '2026-11-04' } });
    // Assert
    expect(screen.getByTestId('mapa-parcial-base')).toHaveTextContent('Base: Jr. Los Pinos hasta 0+120');
    expect(screen.getByTestId('mapa-parcial-vias')).toHaveTextContent('1 de 1 vía');
    expect(screen.getByTestId('mapa-parcial-metrado')).toHaveTextContent('+120 m lineales');
    expect(screen.getByRole('option', { name: 'Etapa 1 (Jr. Los Pinos)' })).toBeTruthy();
    expect(onFilter).toHaveBeenNthCalledWith(1, { stageId: 'e1', untilDay: '2026-11-01' });
    expect(onFilter).toHaveBeenNthCalledWith(2, { untilDay: '2026-11-04' });
  });

  it('says when the cut has no approved progress yet', () => {
    render(<ShareProgress map={mapOf([])} filter={{}} onFilter={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId('compartir-crear-enlace')).toBeNull();
    expect(screen.getByText('Todavía no hay avance aprobado en este corte.')).toBeTruthy();
  });
});

describe('ShareProgress · Crear enlace de avance', () => {
  it('asks Portal for the link at this cut with the photos switch, and shows it to copy', async () => {
    // Arrange
    const link = 'https://constroad.com/public/test/service-report/tok/service/s1?section=map';
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: '', data: { url: link, dias: 7 } }));
    render(<ShareProgress map={mapOf(done)} filter={{ stageId: 'e1', untilDay: '2026-11-01' }} onFilter={vi.fn()} send={send} onClose={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('compartir-fotos'));
    fireEvent.click(screen.getByTestId('compartir-crear-enlace'));
    // Assert
    await waitFor(() => expect(screen.getByTestId('mapa-enlace-cliente')).toHaveTextContent(link));
    expect(screen.getByText('Vence en 7 días')).toBeTruthy();
    expect(send.mock.calls[0]![0]).toMatchObject({ kind: 'work_progress_link', stage_id: 'e1', until: '2026-11-01', photos: true });
  });

  it('shows what Portal refused', async () => {
    render(<ShareProgress map={mapOf(done)} filter={{}} onFilter={vi.fn()} send={async () => ({ ok: false, message: 'Esa etapa no es de este servicio.' })} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('compartir-crear-enlace'));
    expect(await screen.findByTestId('compartir-error')).toHaveTextContent('Esa etapa no es de este servicio.');
  });
});

describe('WorkMapExport (o-12)', () => {
  it('names the file, lists the KMZ folders with their metres, and picks a work', () => {
    const onFilter = vi.fn<(filter: WorkMapFilter) => void>();
    render(<WorkMapExport map={mapOf(done)} filter={{}} onFilter={onFilter} title="Pavimentación Los Olivos" pageUrl="https://portal.example/x" onClose={vi.fn()} />);
    expect(screen.getByTestId('exportar-archivo')).toHaveTextContent(/^pavimentacion-los-olivos-\d{4}-\d{2}-\d{2}\.kmz$/);
    expect(screen.getByTestId('exportar-capas')).toHaveTextContent('Base (200 m)');
    expect(screen.getByTestId('exportar-capas')).toHaveTextContent('Pendiente (120 m)');
    expect(screen.getByTestId('exportar-que-e1')).toHaveTextContent('Etapa 1 (320 m)');
    fireEvent.click(screen.getByTestId('exportar-trabajo-base'));
    expect(onFilter).toHaveBeenCalledWith({ workId: 'base' });
  });
});

describe('WorkMapExport · Importar KMZ o KML (o-12)', () => {
  const MEDIA = '6aef8d455e4b25190f7c3177';
  it('uploads the file, shows what Portal read, and creates the streets with one entry', async () => {
    // Arrange
    const upload = vi.fn<TraceUpload<File>>(async () => ({ ok: true, mediaId: MEDIA }));
    const send = vi.fn<MapEditSend>(async (request) => (request.kind === 'work_import' && request.confirm
      ? { ok: true, message: '', data: { creadas: [{ nombre: 'Jr. A', largoM: 120 }, { nombre: 'Jr. B', largoM: 80 }] } }
      : { ok: true, message: '', data: { calles: [{ nombre: 'Jr. A', largoM: 120 }, { nombre: 'Jr. B', largoM: 80 }], omitidas: [{ nombre: 'Parque', motivo: 'Es un polígono' }] } }));
    render(<WorkMapExport map={mapOf(done)} filter={{}} onFilter={vi.fn()} title="Obra" pageUrl="https://portal.example/x" send={send} uploadTrace={upload} onClose={vi.fn()} />);
    // Act
    fireEvent.change(screen.getByTestId('importar-archivo'), { target: { files: [new File(['<kml/>'], 'obra.kmz')] } });
    expect(await screen.findByTestId('importar-lineas')).toHaveTextContent('Jr. A');
    expect(screen.getByText(/Parque \(Es un polígono\)/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('importar-crear'));
    // Assert
    expect(await screen.findByTestId('importar-listo')).toHaveTextContent('Se crearon 2 calles.');
    expect(send.mock.calls[1]![0]).toMatchObject({ kind: 'work_import', media_id: MEDIA, confirm: true, entry_id: expect.any(String) });
  });

  it('shows a refused upload, and without the tools there is no import', async () => {
    const { unmount } = render(<WorkMapExport map={mapOf(done)} filter={{}} onFilter={vi.fn()} title="Obra" pageUrl="https://portal.example/x" send={vi.fn<MapEditSend>()} uploadTrace={async () => ({ ok: false, message: 'Elige un archivo .kmz o .kml.' })} onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('importar-archivo'), { target: { files: [new File(['x'], 'foto.jpg')] } });
    expect(await screen.findByTestId('importar-error')).toHaveTextContent('Elige un archivo .kmz o .kml.');
    unmount();
    render(<WorkMapExport map={mapOf(done)} filter={{}} onFilter={vi.fn()} title="Obra" pageUrl="https://portal.example/x" onClose={vi.fn()} />);
    expect(screen.queryByTestId('importar-trazado')).toBeNull();
  });
});

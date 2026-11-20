import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { NO_HIDDEN_LAYERS, type WorkMap, type WorkMapView, type WorkStage } from '@lilachat/shared';
import { ClientServices } from './ClientChannelParts';
import { DriveFileMenu } from './DriveFileMenu';
import { useDrivePaste } from './useDrivePaste';
import { MapLayersPanel } from './workMap/MapLayersPanel';

/** José 19/11 (designs cc-01, cc-04, cc-05): the parts of the one grammar of a service. */
afterEach(() => vi.unstubAllGlobals());

describe('the Drive file menu (design cc-05)', () => {
  const photo = { id: 'f1', name: 'parche-12-antes.jpg', mime: 'image/jpeg', url: 'https://drive.example/f1' };

  it('«Copiar enlace» puts the file\'s link on the clipboard and says so', async () => {
    // Arrange
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const onNotice = vi.fn();
    render(<DriveFileMenu file={photo} onOpen={vi.fn()} onNotice={onNotice} />);
    // Act
    fireEvent.click(screen.getByTestId('archivo-drive-mas'));
    fireEvent.click(screen.getByTestId('archivo-drive-copy_link'));
    // Assert
    await vi.waitFor(() => expect(onNotice).toHaveBeenCalledWith('Enlace copiado'));
    expect(writeText).toHaveBeenCalledWith('https://drive.example/f1');
  });

  it('«Marcar como antes / después» opens the viewer, where that bar lives; a document has no «Copiar archivo»', () => {
    // Arrange
    const onOpen = vi.fn();
    const { rerender } = render(<DriveFileMenu file={photo} onOpen={onOpen} onNotice={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('archivo-drive-mas'));
    fireEvent.click(screen.getByTestId('archivo-drive-phase'));
    rerender(<DriveFileMenu file={{ ...photo, id: 'f2', name: 'plano.pdf', mime: 'application/pdf' }} onOpen={onOpen} onNotice={vi.fn()} />);
    fireEvent.click(screen.getByTestId('archivo-drive-mas'));
    // Assert
    expect(onOpen).toHaveBeenCalledWith(photo);
    expect(screen.queryByTestId('archivo-drive-copy_file')).toBeNull();
    expect(screen.queryByTestId('archivo-drive-phase')).toBeNull();
  });
});

describe('Ctrl+V in the Drive (design cc-05)', () => {
  it('uploads the pasted image with a name of its time; typing in a field is left alone', () => {
    // Arrange
    const onFile = vi.fn();
    renderHook(() => useDrivePaste(onFile, vi.fn()));
    const pasted = new File(['x'], 'image.png', { type: 'image/png' });
    const pasteOn = (target: EventTarget) => {
      const event = new Event('paste', { bubbles: true }) as ClipboardEvent;
      Object.defineProperty(event, 'clipboardData', { value: { files: [pasted] } });
      act(() => { target.dispatchEvent(event); });
    };
    const input = document.body.appendChild(document.createElement('input'));
    // Act
    pasteOn(input);
    pasteOn(document.body);
    // Assert
    expect(onFile).toHaveBeenCalledTimes(1);
    expect((onFile.mock.calls[0]?.[0] as File).name).toMatch(/^pegado-\d{8}-\d{6}\.png$/);
  });

  it('«Pegar» with nothing copied says so', async () => {
    // Arrange
    vi.stubGlobal('navigator', { ...navigator, clipboard: { read: vi.fn(async () => []) } });
    const onEmpty = vi.fn();
    const { result } = renderHook(() => useDrivePaste(vi.fn(), onEmpty));
    // Act
    await act(async () => { await result.current(); });
    // Assert
    expect(onEmpty).toHaveBeenCalledWith('No hay una imagen copiada para pegar.');
  });
});

describe('«Capas y leyenda» (design cc-04)', () => {
  const map = { streets: [], scopes: [], stages: [{ id: 'e1', name: 'Etapa 1' }], works: [], marks: [{ id: 'm1', type: 'giba', shape: { kind: 'point', point: { lat: -12, lng: -77 } } }], observations: [{ id: 'o1', text: 'Bache', status: 'open', photos: [] }] } as unknown as WorkMap;
  const view = { works: [{ id: 'w1', name: 'Imprimación', color: '#3b82f6', percent: 0 }] } as unknown as WorkMapView;

  it('a switch per work, drawing type and observation state; a stage chip filters', () => {
    // Arrange
    const onToggle = vi.fn();
    const onFilter = vi.fn();
    render(<MapLayersPanel map={map} view={view} filter={{}} onFilter={onFilter} layers={NO_HIDDEN_LAYERS} onToggle={onToggle} />);
    // Act
    fireEvent.click(screen.getByTestId('capa-trabajo-w1'));
    fireEvent.click(screen.getByTestId('capa-dibujo-giba'));
    fireEvent.click(screen.getByTestId('capa-observacion-open'));
    fireEvent.click(screen.getByTestId('capas-etapa-e1'));
    // Assert
    expect(onToggle.mock.calls).toEqual([['works', 'w1'], ['marks', 'giba'], ['observations', 'open']]);
    expect(onFilter).toHaveBeenCalledWith(expect.objectContaining({ stageId: 'e1' }));
    expect(screen.getByTestId('capa-trabajo-w1')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('«Servicios» on a phone (design cc-01 mobile)', () => {
  const stages: WorkStage[] = [{ _id: 's1', title: 'Inicio', stage: 1, items: [{ id: 'a', text: 'Firmar acta de inicio', doneBy: null, doneAt: null }] }];
  const client = { id: 'x', chat_id: 'c', name: 'CONSORCIO', live: true, archived_since: null, last_activity_at: null, last_order_at: null, orders_total: 0, archived_group: '2-6' as const, services: [] };

  it('shows the open tasks first and «Ver en Checklist» takes there', () => {
    // Arrange
    const onOpen = vi.fn();
    render(<ClientServices client={client} records={[]} target={null} pending={{ stages, label: 'Ver en Checklist', onOpen }} />);
    // Act
    fireEvent.click(screen.getByTestId('ver-en-checklist'));
    // Assert
    expect(screen.getByTestId('servicios-pendientes')).toHaveTextContent('Pendientes · 1');
    expect(screen.getByTestId('servicios-pendientes')).toHaveTextContent('Firmar acta de inicio');
    expect(onOpen).toHaveBeenCalled();
  });
});

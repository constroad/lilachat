import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { workMapOf, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { StreetScopes } from './StreetScopes';

/** Design o-03 on the web (step 3, José 07/11): a street, its stretches, and adding, editing and deleting them. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const mapOf = (): WorkMap => workMapOf({
  workStreets: {
    streets: [{ _id: 's1', name: 'Jr. Los Pinos', geometry: line, lengthM: 320, widthM: 6 }],
    scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 160, tagIds: ['base'], partidaIds: [], stageId: 'e1' }],
    progress: [{ streetId: 's1', tagId: 'base', fromM: 0, toM: 80, date: '2026-11-01' }],
    tags: [{ _id: 'base', name: 'Base', color: '#c08a1e', order: 1 }, { _id: 'asfalto', name: 'Asfalto', color: '#111111', order: 2 }],
    stages: [{ _id: 'e1', name: 'Etapa 1', order: 1 }],
  },
})!;

const sender = (answer = { ok: true as const, message: 'Tramo guardado.' }) => vi.fn<MapEditSend>(async () => answer);

describe('StreetScopes', () => {
  it('shows the street, its work bar and its stretch with stage and percent', () => {
    // Act
    render(<StreetScopes map={mapOf()} streetId="s1" send={sender()} onBack={vi.fn()} />);
    // Assert
    expect(screen.getByText('Jr. Los Pinos')).toBeTruthy();
    expect(screen.getByText('320 m · 6,0 m')).toBeTruthy();
    expect(screen.getByTestId('calle-capa-base')).toHaveTextContent('80 m');
    expect(screen.getByTestId('tramo-c1')).toHaveTextContent('Tramo 1: 0+000 a 0+160');
    expect(screen.getByTestId('tramo-c1')).toHaveTextContent('Etapa 1');
    expect(screen.getByTestId('tramo-c1')).toHaveTextContent('Base 50 %');
  });

  it('adds a stretch: the whole street by default, the works tapped and the stage picked', async () => {
    // Arrange
    const send = sender();
    render(<StreetScopes map={mapOf()} streetId="s1" send={send} onBack={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('tramo-agregar'));
    fireEvent.change(screen.getByTestId('tramo-desde'), { target: { value: '160' } });
    fireEvent.click(screen.getByTestId('tramo-trabajo-asfalto'));
    fireEvent.click(screen.getByTestId('tramo-etapa-e1'));
    fireEvent.click(screen.getByTestId('tramo-guardar'));
    // Assert
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]![0]).toMatchObject({ kind: 'work_scope', street_id: 's1', from_m: 160, to_m: 320, tag_ids: ['asfalto'], stage_id: 'e1', entry_id: expect.any(String) });
    await waitFor(() => expect(screen.queryByTestId('tramo-formulario')).toBeNull());
  });

  it('says what is wrong before sending, and shows Portal\'s refusal', async () => {
    const send = sender({ ok: false, message: 'El tramo deja sin cubrir un avance aprobado.' } as never);
    render(<StreetScopes map={mapOf()} streetId="s1" send={send} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('editar-tramo-c1'));
    fireEvent.change(screen.getByTestId('tramo-hasta'), { target: { value: '400' } });
    fireEvent.click(screen.getByTestId('tramo-guardar'));
    expect(screen.getByTestId('tramo-error')).toHaveTextContent('El tramo pasa el largo de la calle (320 m).');
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('tramo-hasta'), { target: { value: '60' } });
    fireEvent.click(screen.getByTestId('tramo-guardar'));
    await waitFor(() => expect(screen.getByTestId('tramo-error')).toHaveTextContent('El tramo deja sin cubrir un avance aprobado.'));
    expect(send.mock.calls[0]![0]).toMatchObject({ scope_id: 'c1', to_m: 60 });
    expect(send.mock.calls[0]![0]).not.toHaveProperty('entry_id');
  });

  it('creates a work and a stage right where they are picked', async () => {
    const send = sender({ ok: true, message: 'Creado.' });
    render(<StreetScopes map={mapOf()} streetId="s1" send={send} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tramo-agregar'));
    fireEvent.click(screen.getByTestId('trabajo-nueva'));
    fireEvent.change(screen.getByTestId('trabajo-nombre'), { target: { value: 'Bacheo' } });
    fireEvent.click(screen.getByTestId('trabajo-color-0d9488'));
    fireEvent.click(screen.getByTestId('trabajo-crear'));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]![0]).toEqual({ kind: 'work_tag', name: 'Bacheo', color: '#0d9488', forms: expect.any(Number) });
    fireEvent.click(screen.getByTestId('etapa-nueva'));
    fireEvent.click(screen.getByTestId('etapa-crear'));
    expect(screen.getByRole('alert')).toHaveTextContent('Ponle nombre.');
  });

  it('deletes a stretch after asking, naming it', async () => {
    const send = sender({ ok: true, message: 'Tramo borrado.' });
    render(<StreetScopes map={mapOf()} streetId="s1" send={send} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('borrar-tramo-c1'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('¿Borrar Tramo 1 (0+000 a 0+160)?');
    fireEvent.click(screen.getByTestId('borrar-tramo-si-c1'));
    await waitFor(() => expect(send).toHaveBeenCalledWith({ kind: 'work_scope_delete', scope_id: 'c1', forms: expect.any(Number) }, expect.any(Function)));
  });

  it('read-only without a sender, and a street gone from the map says so', () => {
    const { rerender } = render(<StreetScopes map={mapOf()} streetId="s1" onBack={vi.fn()} />);
    expect(screen.queryByTestId('tramo-agregar')).toBeNull();
    expect(screen.queryByTestId('borrar-tramo-c1')).toBeNull();
    rerender(<StreetScopes map={mapOf()} streetId="gone" onBack={vi.fn()} />);
    expect(screen.getByText('Esta calle ya no está en el mapa.')).toBeTruthy();
  });
});

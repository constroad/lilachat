import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fieldDocumentOf, type AlbumSend, type RepeatItem, type RepeatSection } from '@lilachat/shared';
import { UnitAlbumDialog } from './UnitAlbumDialog';

/** «Terminar unidad» (José 19/11): the person reviews the unit's photos before they go to the client's group. */
const photoEntry = (kind: string) => ({ id: `foto-${kind}`, title: `Foto de ${kind}`, required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: kind });
const shot = (name: string) => ({ id: name, url: `https://x/${name}.jpg`, hora: '08:10' });

function unitOf(photos: Record<string, string[]>): RepeatItem {
  const sections = Object.entries(photos).map(([kind, names]) => ({ id: `foto-${kind}`, state: names.length ? 'done' : 'empty', values: { fotos: names.map(shot) } }));
  const body = {
    id: 'r1', type: 'CTL-PIS', title: 'Control de pista', status: 'draft',
    forms: { fotos: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' } } } },
    sections: [{ id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'partial', summary: [], results: [], itemTitle: 'Unidad', addLabel: '', min: 1, template: ['ingreso', 'temperatura', 'vacia'].map(photoEntry), items: [{ id: 'd1', title: 'Unidad 2 · QAP-102', summary: [], results: [], sections }] }],
    publish: { label: 'Publicar informe', missing: [] },
  };
  return (fieldDocumentOf(body)!.sections[0] as RepeatSection).items[0]!;
}

const open = unitOf({ ingreso: ['i'], temperatura: ['t'] });

function renderDialog(item = open, onSend = vi.fn(async (_urls: string[]): Promise<AlbumSend> => ({ ok: true, message: 'Se enviaron 2 fotos al grupo.' }))) {
  const handlers = { onSend, onSent: vi.fn(), onClose: vi.fn(), onView: vi.fn() };
  render(<UnitAlbumDialog item={item} {...handlers} />);
  return handlers;
}

describe('UnitAlbumDialog', () => {
  it('names the unit, checks every photo and says the open unit will close', () => {
    // Act
    renderDialog();
    // Assert
    expect(screen.getByRole('dialog', { name: 'Revisa las fotos de la Unidad 2' })).toBeInTheDocument();
    expect(screen.getByTestId('album-conteo')).toHaveTextContent('Se enviarán 2 fotos');
    expect(screen.getByTestId('album-cierra')).toHaveTextContent('La unidad se dará por terminada.');
    expect(screen.getByTestId('album-enviar')).toHaveTextContent('Enviar 2 fotos al grupo');
  });

  it('a closed unit does not warn that it closes', () => {
    renderDialog(unitOf({ ingreso: ['i'], temperatura: ['t'], vacia: ['v'] }));
    expect(screen.queryByTestId('album-cierra')).toBeNull();
  });

  it('a tap unchecks a photo; with none left the button is off', () => {
    // Arrange
    renderDialog();
    // Act
    fireEvent.click(screen.getByTestId('album-foto-0'));
    // Assert
    expect(screen.getByTestId('album-foto-0')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('album-conteo')).toHaveTextContent('Se enviará 1 foto');
    fireEvent.click(screen.getByTestId('album-foto-1'));
    expect(screen.getByTestId('album-enviar')).toBeDisabled();
  });

  it('a thumbnail that does not load is shown broken and left out', () => {
    // Arrange
    renderDialog();
    // Act
    fireEvent.error(screen.getByTestId('album-miniatura-0'));
    // Assert
    expect(screen.getByTestId('album-rota-0')).toHaveTextContent('No se pudo abrir');
    expect(screen.getByTestId('album-foto-0')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('album-conteo')).toHaveTextContent('Se enviará 1 foto');
  });

  it('the magnifier opens the photo full size without unchecking it', () => {
    // Arrange
    const handlers = renderDialog();
    // Act
    fireEvent.click(screen.getByTestId('album-ver-1'));
    // Assert
    expect(handlers.onView).toHaveBeenCalledWith('https://x/t.jpg');
    expect(screen.getByTestId('album-foto-1')).toHaveAttribute('aria-pressed', 'true');
  });

  it('sends the checked urls in order and hands Portal’s text on', async () => {
    // Arrange
    const handlers = renderDialog();
    // Act
    fireEvent.click(screen.getByTestId('album-enviar'));
    // Assert
    await waitFor(() => expect(handlers.onSent).toHaveBeenCalledWith('Se enviaron 2 fotos al grupo.'));
    expect(handlers.onSend).toHaveBeenCalledWith(['https://x/i.jpg', 'https://x/t.jpg']);
  });

  it('a refusal stays on the dialog so the person can try again', async () => {
    // Arrange
    const handlers = renderDialog(open, vi.fn(async (_urls: string[]): Promise<AlbumSend> => ({ ok: false, message: 'Sin señal.' })));
    // Act
    fireEvent.click(screen.getByTestId('album-enviar'));
    // Assert
    expect(await screen.findByTestId('album-error')).toHaveTextContent('Sin señal.');
    expect(handlers.onSent).not.toHaveBeenCalled();
    expect(screen.getByTestId('album-enviar')).not.toBeDisabled();
  });

  it('«Cancelar» closes without sending', () => {
    const handlers = renderDialog();
    fireEvent.click(screen.getByTestId('album-cancelar'));
    expect(handlers.onClose).toHaveBeenCalled();
    expect(handlers.onSend).not.toHaveBeenCalled();
  });
});

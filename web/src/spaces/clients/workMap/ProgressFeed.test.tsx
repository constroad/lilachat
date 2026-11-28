import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { byApproveOf, PHOTO_ADD_FAILED, PHOTO_ADDED, workMapOf, type ByApproveList, type WorkMap } from '@lilachat/shared';
import { ProgressFeed } from './ProgressFeed';

/** Design ma05 on the web: every record by Hoy / Semana / Todo; none waits for approval (José 28/11). */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const TODAY = '2026-11-28';
const map: WorkMap = workMapOf({
  workStreets: {
    streets: [{ _id: 's1', name: 'Jr. Progreso', geometry: line, lengthM: 284, widthM: 6 }],
    scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 284, tagIds: ['imp'], partidaIds: [] }],
    progress: [{ _id: 'p1', streetId: 's1', tagId: 'imp', fromM: 0, toM: 60, date: '2026-11-27' }],
    tags: [{ _id: 'imp', name: 'Imprimación', color: '#d97706', order: 1 }],
    stages: [],
  },
})!;
const list: ByApproveList = {
  total: 2,
  items: [
    { id: 'a2', state: 'pendiente', date: TODAY, streetId: 's1', fromM: 120, toM: 166, workId: 'imp', quantity: 46, author: 'Juan Quispe', own: true, rejectNote: null },
    { id: 'r1', state: 'rechazado', date: '2026-11-20', streetId: 's1', fromM: 60, toM: 100, workId: 'imp', quantity: 40, author: 'Rosa Huamán', own: false, rejectNote: 'La foto no muestra el tramo' },
  ],
};

describe('ProgressFeed (ma05)', () => {
  it('«Hoy» shows today\'s with its summary; «Semana» and «Todo» add the rest; only an undone one has a pill', () => {
    // Arrange
    render(<ProgressFeed map={map} list={list} admin={false} onUndo={vi.fn()} today={TODAY} />);
    // Assert
    expect(screen.getByTestId('avances-rango-hoy')).toHaveTextContent('Hoy1');
    expect(screen.getByTestId('avance-a2')).toHaveTextContent('Imprimación · Jr. Progreso');
    expect(screen.getByTestId('avance-a2')).toHaveTextContent('0+120 → 0+166 · 46 m · 276 m²');
    expect(screen.getByTestId('avance-a2')).toHaveTextContent('Hoy · Juan Quispe');
    expect(screen.queryByTestId('avance-estado-a2')).toBeNull();
    expect(screen.getByTestId('avance-a2')).not.toHaveTextContent(/aprobar/i);
    expect(screen.getByTestId('avances-resumen')).toHaveTextContent('46 m lineales');
    // Act
    fireEvent.click(screen.getByTestId('avances-rango-semana'));
    expect(screen.getByTestId('avance-p1')).toBeInTheDocument();
    expect(screen.queryByTestId('avance-estado-p1')).toBeNull();
    expect(screen.queryByTestId('avance-r1')).toBeNull();
    fireEvent.click(screen.getByTestId('avances-rango-todo'));
    expect(screen.getByTestId('avance-r1')).toHaveTextContent('Nota: La foto no muestra el tramo');
    expect(screen.getByTestId('avance-estado-r1')).toHaveTextContent('DESHECHO');
    expect(screen.queryByTestId('aprobar-avance-a2')).toBeNull();
  });

  it('«Deshacer» on the caller\'s own pending one', async () => {
    const onUndo = vi.fn(async () => null);
    render(<ProgressFeed map={map} list={list} admin={false} onUndo={onUndo} today={TODAY} />);
    fireEvent.click(screen.getByTestId('deshacer-avance-a2'));
    fireEvent.click(screen.getByTestId('deshacer-si-a2'));
    await waitFor(() => expect(onUndo).toHaveBeenCalledWith('a2'));
  });

  it('a member undoes only their own; an admin also any other record that counts', () => {
    // Arrange
    const { unmount } = render(<ProgressFeed map={map} list={list} admin={false} onUndo={vi.fn()} today={TODAY} />);
    fireEvent.click(screen.getByTestId('avances-rango-todo'));
    // Assert
    expect(screen.queryByTestId('deshacer-avance-p1')).toBeNull();
    unmount();
    // Act
    render(<ProgressFeed map={map} list={list} admin onUndo={vi.fn()} today={TODAY} />);
    fireEvent.click(screen.getByTestId('avances-rango-todo'));
    // Assert
    expect(screen.getByTestId('deshacer-avance-p1')).toBeInTheDocument();
    expect(screen.getByTestId('deshacer-avance-a2')).toBeInTheDocument();
    expect(screen.queryByTestId('deshacer-avance-r1')).toBeNull();
  });

  it('an empty period says so', () => {
    // Only yesterday's record: «Hoy» is an empty period, the work is not.
    render(<ProgressFeed map={map} list={{ total: 0, items: [] }} admin={false} onUndo={vi.fn()} today={TODAY} />);
    expect(screen.getByText('No hay avances en este periodo.')).toBeTruthy();
  });

  it('«Agregar foto» on a record uploads the photo and shows its count; a failure says try again', async () => {
    // Arrange
    const onAddPhoto = vi.fn().mockResolvedValueOnce({ ok: false, message: PHOTO_ADD_FAILED }).mockResolvedValueOnce({ ok: true, progressId: 'a2', photos: 1, message: PHOTO_ADDED });
    render(<ProgressFeed map={map} list={list} admin={false} onUndo={vi.fn()} onAddPhoto={onAddPhoto} today={TODAY} />);
    const file = new File(['x'], 'avance.jpg', { type: 'image/jpeg' });
    expect(screen.queryByTestId('avance-fotos-a2')).toBeNull();
    // Act: the first try fails
    fireEvent.change(screen.getByTestId('agregar-foto-archivo-a2'), { target: { files: [file] } });
    // Assert
    expect(await screen.findByTestId('agregar-foto-error-a2')).toHaveTextContent(PHOTO_ADD_FAILED);
    // Act: again
    fireEvent.change(screen.getByTestId('agregar-foto-archivo-a2'), { target: { files: [file] } });
    // Assert
    expect(await screen.findByTestId('avance-fotos-a2')).toHaveTextContent('1 foto');
    expect(onAddPhoto).toHaveBeenLastCalledWith('a2', file);
    expect(screen.queryByTestId('agregar-foto-error-a2')).toBeNull();
  });

  it('an undone record or one without a page offers no «Agregar foto»; a record with photos shows them', () => {
    render(<ProgressFeed map={map} list={{ total: 2, items: [{ ...list.items[0]!, photos: 2 }, list.items[1]!] }} admin={false} onUndo={vi.fn()} onAddPhoto={vi.fn()} today={TODAY} />);
    fireEvent.click(screen.getByTestId('avances-rango-todo'));
    expect(screen.getByTestId('avance-fotos-a2')).toHaveTextContent('2 fotos');
    expect(screen.getByTestId('agregar-foto-a2')).toHaveTextContent('Agregar foto');
    expect(screen.queryByTestId('agregar-foto-r1')).toBeNull();
  });
});

/** 28/11: the history comes from `historial_de_avances_de_obra` and never disappears without a word. */
describe('ProgressFeed history states', () => {
  const noUndo = vi.fn(async () => null);
  const bare: WorkMap = { ...map, progress: [] };

  it('says the history could not load and retries', () => {
    // Arrange
    const onRetry = vi.fn();
    render(<ProgressFeed map={bare} list={null} failed onRetry={onRetry} admin={false} onUndo={noUndo} today={TODAY} />);
    // Act
    fireEvent.click(screen.getByTestId('avances-reintentar'));
    // Assert
    expect(screen.getByTestId('avances-error')).toHaveTextContent('No se pudo cargar el historial');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('says there is nothing yet for a real empty history', () => {
    render(<ProgressFeed map={bare} list={{ total: 0, items: [] }} admin={false} onUndo={noUndo} today={TODAY} />);
    expect(screen.getByTestId('avances-vacio')).toHaveTextContent('Sin avances todavía');
    expect(screen.queryByTestId('avances-error')).toBeNull();
  });

  it('shows the author\'s approved record with «Deshacer» from puedeDeshacer', () => {
    // Arrange
    const history = byApproveOf({ avances: [{ avanceId: 'h1', estado: 'aprobado', fecha: TODAY, calleId: 's1', desdeM: 0, hastaM: 52, tagId: 'imp', metrado: 52, autor: 'J zamora', propio: true, fotos: 2, puedeDeshacer: true }] });
    // Act
    render(<ProgressFeed map={bare} list={history} admin={false} onUndo={noUndo} today={TODAY} />);
    // Assert
    expect(screen.getByTestId('avance-h1')).toHaveTextContent('J zamora');
    expect(screen.getByTestId('deshacer-avance-h1')).toBeInTheDocument();
  });
});

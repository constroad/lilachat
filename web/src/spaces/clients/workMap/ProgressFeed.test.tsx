import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { workMapOf, type ByApproveList, type WorkMap } from '@lilachat/shared';
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
    render(<ProgressFeed map={{ ...map, progress: [] }} list={{ total: 0, items: [] }} admin={false} onUndo={vi.fn()} today={TODAY} />);
    expect(screen.getByText('No hay avances en este periodo.')).toBeTruthy();
  });
});

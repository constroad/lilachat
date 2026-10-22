import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FiltrosDeLaLista } from './FiltrosDeLaLista';

const lista = { visibles: [], cuentas: { 'no-leidos': 0, grupos: 0, borradores: 0 }, archivados: { total: 0, sinLeer: 0 } };
const family = { id: 'l1', name: 'Familia', chatIds: ['c1'] };

describe('FiltrosDeLaLista with lists of my own (pending 45)', () => {
  it('each list is a chip after the fixed ones; tapping it filters by it', () => {
    // Arrange
    const onFiltro = vi.fn();
    render(<FiltrosDeLaLista lista={lista} filtro="todos" onFiltro={onFiltro} verArchivados={false} onArchivados={() => undefined} listas={[family]} onNuevaLista={() => undefined} onEditarLista={() => undefined} />);
    // Act
    fireEvent.click(screen.getByText('Familia'));
    // Assert
    expect(onFiltro).toHaveBeenCalledWith('lista:l1');
    expect(screen.getByTestId('filtro-nueva-lista')).toBeInTheDocument();
  });

  it('the pencil appears with a list open and edits that one; right click too', () => {
    const onEditarLista = vi.fn();
    render(<FiltrosDeLaLista lista={lista} filtro="lista:l1" onFiltro={() => undefined} verArchivados={false} onArchivados={() => undefined} listas={[family]} onEditarLista={onEditarLista} />);
    fireEvent.click(screen.getByTestId('btn-editar-lista'));
    fireEvent.contextMenu(screen.getByText('Familia'));
    expect(onEditarLista).toHaveBeenNthCalledWith(1, 'l1');
    expect(onEditarLista).toHaveBeenNthCalledWith(2, 'l1');
  });

  it('with a fixed chip open there is no pencil', () => {
    render(<FiltrosDeLaLista lista={lista} filtro="grupos" onFiltro={() => undefined} verArchivados={false} onArchivados={() => undefined} listas={[family]} onEditarLista={() => undefined} />);
    expect(screen.queryByTestId('btn-editar-lista')).toBeNull();
  });
});

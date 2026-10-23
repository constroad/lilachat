import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FiltrosDeLaLista } from './FiltrosDeLaLista';

const built = { visibles: [], cuentas: { 'no-leidos': 0, grupos: 0, borradores: 0 }, archivados: { total: 0, sinLeer: 0 } };

describe('FiltrosDeLaLista with sections like Slack (pending 62)', () => {
  it('only the four fixed chips; the lists are sections of the list, not chips', () => {
    // Arrange
    const onFiltro = vi.fn();
    render(<FiltrosDeLaLista lista={built} filtro="todos" onFiltro={onFiltro} verArchivados={false} onArchivados={() => undefined} onNuevaLista={() => undefined} />);
    // Act
    fireEvent.click(screen.getByText('Grupos'));
    // Assert
    expect(onFiltro).toHaveBeenCalledWith('grupos');
    expect(screen.getAllByRole('button', { pressed: false }).map((chip) => chip.textContent)).toEqual(['No leídos', 'Grupos', 'Borradores']);
  });

  it('the plus starts a new section', () => {
    const onNew = vi.fn();
    render(<FiltrosDeLaLista lista={built} filtro="todos" onFiltro={() => undefined} verArchivados={false} onArchivados={() => undefined} onNuevaLista={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sección' }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

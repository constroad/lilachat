import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DialogoEliminar } from './DialogosDelMensaje';
import type { MensajeEnPantalla } from './types';

/** José 13/11: an app cannot delete its own card, so a channel admin deletes it for everyone. */
const card: MensajeEnPantalla = { chatId: 'c1', seq: 81, senderId: 'bot-inframaq', clientKey: 'bot:inframaq:cub-1', kind: 'text', body: 'Cubicaje CUB-2026-0001', at: new Date().toISOString() };
const draw = (appMessageByAdmin?: boolean) => {
  const deleteForAll = vi.fn().mockResolvedValue({ ok: true });
  render(<DialogoEliminar mensaje={card} yo="ana" appMessageByAdmin={appMessageByAdmin} onParaTodos={deleteForAll} onParaMi={vi.fn()} onCerrar={vi.fn()} onAviso={vi.fn()} />);
  return { deleteForAll };
};

describe('deleting an app card on the web', () => {
  it('a channel admin gets «Eliminar para todos» and it deletes the card', async () => {
    // Arrange
    const { deleteForAll } = draw(true);
    // Act
    fireEvent.click(screen.getByTestId('btn-eliminar-para-todos'));
    // Assert
    await waitFor(() => expect(deleteForAll).toHaveBeenCalledTimes(1));
  });
  it('a member who is not admin only gets «para mí»', () => {
    draw(false);
    expect(screen.queryByTestId('btn-eliminar-para-todos')).toBeNull();
    expect(screen.getByTestId('btn-eliminar-para-mi')).toBeInTheDocument();
  });
});

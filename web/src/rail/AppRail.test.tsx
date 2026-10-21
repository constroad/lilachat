import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientWorkspace } from '@lilachat/shared';
import { AppRail } from './AppRail';

/** The rail of the web, like WhatsApp Web's (pending 38, José 21/10). */
const handlers = () => ({ onChats: vi.fn(), onAgenda: vi.fn(), onStarred: vi.fn(), onMedia: vi.fn(), onSettings: vi.fn(), onPickSpace: vi.fn(), onAddSpace: vi.fn() });
const space: ClientWorkspace = { id: 'w1', name: 'QA Obra', joinPolicy: 'approval', role: 'owner', status: 'active', members: 3, unreadChats: 2 };

describe('AppRail', () => {
  it('Chats, Pendientes and Destacados on top; Medios, Ajustes and me at the bottom', async () => {
    const on = handlers();
    render(<AppRail spaces={[]} currentSpaceId={null} me={{ name: 'José', phone: '902049935' }} personalUnread={0} {...on} />);
    for (const [testId, handler] of [['riel-chats', on.onChats], ['riel-pendientes', on.onAgenda], ['riel-destacados', on.onStarred], ['riel-medios', on.onMedia], ['btn-ajustes', on.onSettings]] as const) {
      await userEvent.click(screen.getByTestId(testId));
      expect(handler).toHaveBeenCalled();
    }
    expect(screen.getByTestId('riel-medios')).toHaveAccessibleName('Medios');
  });

  it('without spaces only «+» to join or create one; with spaces, personal and each space', async () => {
    const on = handlers();
    const { rerender } = render(<AppRail spaces={[]} currentSpaceId={null} me={{ name: 'José', phone: '902049935' }} personalUnread={0} {...on} />);
    expect(screen.queryByTestId('riel-personal')).toBeNull();
    await userEvent.click(screen.getByTestId('riel-agregar-espacio'));
    expect(on.onAddSpace).toHaveBeenCalled();
    rerender(<AppRail spaces={[space]} currentSpaceId="w1" me={{ name: 'José', phone: '902049935' }} personalUnread={1} {...on} />);
    expect(screen.getByTestId('riel-espacio-w1')).toHaveAccessibleName('QA Obra, 2 sin leer');
    await userEvent.click(screen.getByTestId('riel-personal'));
    expect(on.onPickSpace).toHaveBeenCalledWith(null);
  });
});

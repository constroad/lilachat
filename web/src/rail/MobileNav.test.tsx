import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileNav } from './MobileNav';

describe('MobileNav (the APK\'s bottom bar on the phone\'s web, José 06/11)', () => {
  it('draws the four personal tabs, lights the active one and says which was tapped', () => {
    const onPick = vi.fn();
    render(<MobileNav inSpace={false} active="agenda" counts={{ agenda: 3 }} onPick={onPick} />);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Chats', '3Pendientes', 'Encuestas', 'Ajustes']);
    expect(screen.getByTestId('tab-agenda')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('tab-chats')).not.toHaveAttribute('aria-current');
    fireEvent.click(screen.getByTestId('tab-ajustes'));
    expect(onPick).toHaveBeenCalledWith('ajustes');
  });

  it('in a space: Chats, Directorio, Menciones and Ajustes, with the mentions count capped', () => {
    render(<MobileNav inSpace active="chats" counts={{ mentions: 120 }} onPick={() => undefined} />);
    expect(screen.getByTestId('tab-directory')).toHaveTextContent('Directorio');
    expect(screen.getByTestId('contador-mentions')).toHaveTextContent('99+');
    expect(screen.queryByTestId('tab-encuestas')).toBeNull();
  });
});

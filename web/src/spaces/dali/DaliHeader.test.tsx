import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ClientWorkspace } from '@lilachat/shared';
import { DaliHeader } from './DaliSpace';

afterEach(cleanup);

const SPACE: ClientWorkspace = { id: 'w-dali', name: 'Dali', joinPolicy: 'approval', role: 'owner', status: 'active', members: 3, unreadChats: 0, prospects: true };

function renderHeader(phone: boolean) {
  const onTab = vi.fn();
  render(<DaliHeader space={SPACE} phone={phone} tab="inbox" onTab={onTab} onKnowledge={vi.fn()} onSwitch={vi.fn()} onWorkspace={vi.fn()} />);
  return { onTab };
}

describe('DaliHeader', () => {
  it('on a computer keeps the title, the tabs and «Lo que Dali sabe» in ONE row (José 17/11: two rows left an empty band)', () => {
    renderHeader(false);
    const row = screen.getByTestId('fila-cabecera-dali');
    expect(within(row).getByTestId('titulo-espacio')).toBeTruthy();
    expect(within(row).getByRole('tablist')).toBeTruthy();
    expect(within(row).getByTestId('lo-que-dali-sabe').textContent).toContain('Lo que Dali sabe');
  });

  it('on a phone puts the tabs under the title, across the width', () => {
    renderHeader(true);
    const row = screen.getByTestId('fila-cabecera-dali');
    expect(within(row).queryByRole('tablist')).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('a tab says which one is open and changes it', () => {
    const { onTab } = renderHeader(false);
    expect(screen.getByTestId('pestana-inbox').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('pestana-funnel'));
    expect(onTab).toHaveBeenCalledWith('funnel');
  });
});

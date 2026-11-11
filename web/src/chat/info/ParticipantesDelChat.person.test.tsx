import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { aDetalle } from '../useDetalleDelChat';
import type { ChatSummary } from '../types';
import { PanelDeInfo } from './PanelDeInfo';

/** José, 25/10/2026: in the member list, a row opens the card of that person. */
const group: ChatSummary = { id: 'c1', kind: 'group', name: 'Obra', workspaceId: 'w1', memberIds: ['u-jc', 'u-max'], lastSeq: 1, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const detail = aDetalle({
  members: [
    { id: 'u-jc', name: 'Juan Carlos', phone: '900000001', role: 'admin', esYo: true },
    { id: 'u-max', name: 'Max', phone: '987000111', role: 'member' },
  ],
});

function open(onViewPerson?: (userId: string) => void) {
  render(<PanelDeInfo chat={group} detalle={detail} yo="u-jc" jwt="jwt" base={null} onCerrar={vi.fn()} onAviso={vi.fn()} onCambio={vi.fn()} onAccionDeChat={vi.fn()} onLevel={vi.fn()} onVerFoto={vi.fn()} onViewPerson={onViewPerson} />);
}

describe('member rows', () => {
  it('a row opens the card of that member', async () => {
    // Arrange
    const onViewPerson = vi.fn();
    open(onViewPerson);
    // Act
    await userEvent.click(screen.getByTestId('ver-participante-u-max'));
    // Assert
    expect(onViewPerson).toHaveBeenCalledWith('u-max');
  });

  it('my own row opens nothing', () => {
    open(vi.fn());
    expect(screen.queryByTestId('ver-participante-u-jc')).toBeNull();
    expect(screen.getByTestId('participante-u-jc')).toBeInTheDocument();
  });

  it('without a card (nobody to show it) the row stays as it was', () => {
    open();
    expect(screen.queryByTestId('ver-participante-u-max')).toBeNull();
    expect(screen.getByTestId('participante-u-max')).toBeInTheDocument();
  });
});

describe('a shared channel (local E2E 11/11)', () => {
  it('someone from another space carries that space as a pill; someone from mine does not', () => {
    const shared = aDetalle({
      members: [
        { id: 'u-jc', name: 'Juan Carlos', phone: '900000001', role: 'admin', esYo: true, spaceRole: 'owner', space: { id: 'gl', name: 'Globofast' } },
        { id: 'u-max', name: 'Max', phone: '987000111', role: 'member', space: { id: 'im', name: 'Inframaq' } },
        { id: 'u-ana', name: 'Ana', phone: '987000222', role: 'member', spaceRole: 'member', space: { id: 'gl', name: 'Globofast' } },
      ],
    });
    render(<PanelDeInfo chat={{ ...group, memberIds: ['u-jc', 'u-max', 'u-ana'] }} detalle={shared} yo="u-jc" jwt="jwt" base={null} onCerrar={vi.fn()} onAviso={vi.fn()} onCambio={vi.fn()} onAccionDeChat={vi.fn()} onLevel={vi.fn()} onVerFoto={vi.fn()} />);

    expect(screen.getByTestId('participante-u-max').textContent).toContain('Inframaq');
    expect(screen.getByTestId('participante-u-ana').textContent).not.toContain('Globofast');
  });
});


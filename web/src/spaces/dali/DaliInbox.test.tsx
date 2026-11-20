import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ChatSummary } from '../../chat/types';
import { DaliInbox } from './DaliInbox';
import { chatOf, listOf, ME, minutesAgo, NOW, prospectOf } from './daliTestData';
import type { ProspectList } from './prospectsApi';

afterEach(cleanup);

const SERVICES = { mix: { key: 'venta_mezcla', name: 'Venta de mezcla' }, paving: { key: 'asfaltado', name: 'Asfaltado' } };
const DAY_MINUTES = 24 * 60;
const BOARD = [
  prospectOf({ id: 'p-hot', chatId: 'c-hot', name: 'Ricardo Huamán', score: 81, stage: 'to_quote', readyAt: minutesAgo(20), service: SERVICES.mix, summary: 'Mezcla 18 m³' }),
  prospectOf({ id: 'p-mine', chatId: 'c-mine', name: 'Elena Rojas', score: 64, stage: 'missing_info', assignee: { id: ME, name: 'José' }, service: SERVICES.paving, lastActivityAt: minutesAgo(3 * DAY_MINUTES) }),
  prospectOf({ id: 'p-asked', chatId: 'c-asked', score: 22, intent: 'information', stage: 'missing_info' }),
];

function renderInbox(overrides: { list?: ProspectList | null; chats?: ChatSummary[]; phone?: boolean; failed?: boolean } = {}) {
  const handlers = { onService: vi.fn(), onOpenProspect: vi.fn(), onRetry: vi.fn(), onFollowUps: vi.fn() };
  render(
    <DaliInbox
      list={overrides.list === undefined ? listOf(BOARD) : overrides.list}
      failed={overrides.failed ?? false}
      chats={overrides.chats ?? [chatOf(), chatOf({ id: 'c-hot', name: 'Ricardo Huamán', prospect: true, unread: 2 })]}
      yo={ME}
      selectedChatId={null}
      now={NOW}
      phone={overrides.phone}
      onOpenChat={vi.fn()}
      onChatAction={vi.fn()}
      {...handlers}
    />,
  );
  return handlers;
}

describe('DaliInbox (dl-01 v3)', () => {
  it('opens on «Míos» when something is mine, and «Todos» shows the rest', () => {
    renderInbox();
    expect(screen.getByTestId('vista-bandeja-mine').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Elena Rojas')).toBeTruthy();
    expect(screen.queryByText('Ricardo Huamán')).toBeNull();
    fireEvent.click(screen.getByTestId('vista-bandeja-all'));
    expect(screen.getByText('Ricardo Huamán')).toBeTruthy();
  });

  it('marks the prospect chats with something unread (the team chats live in the Chats tab)', () => {
    renderInbox();
    fireEvent.click(screen.getByTestId('vista-bandeja-all'));
    expect(screen.getByTestId('sin-leer-prospecto').textContent).toBe('2');
    expect(screen.queryByTestId('chats-del-equipo')).toBeNull();
  });

  it('keeps the only-asked folded, and a prospect without a name shows a phone, not «·»', () => {
    renderInbox({ phone: true });
    fireEvent.click(screen.getByTestId('vista-bandeja-all'));
    expect(screen.queryByText('+51 949 123 824')).toBeNull();
    fireEvent.click(screen.getByTestId('solo-consultas'));
    const row = screen.getByTestId('fila-prospecto-p-asked');
    expect(row.textContent).toContain('+51 949 123 824');
    expect(row.textContent).not.toContain('·+51');
    expect(row.querySelector('svg')).toBeTruthy();
  });

  it('says on a phone how many arrived this month (the header has no subtitle there)', () => {
    renderInbox({ phone: true });
    expect(screen.getByTestId('llegados-mes').textContent).toBe('3 este mes · Dali contesta primero y te pasa los listos');
  });

  it('has no month line on a computer', () => {
    renderInbox();
    expect(screen.queryByTestId('llegados-mes')).toBeNull();
  });

  it('filters by service once the space has two', () => {
    const { onService } = renderInbox();
    fireEvent.change(screen.getByTestId('filtro-servicio'), { target: { value: 'asfaltado' } });
    expect(onService).toHaveBeenCalledWith('asfaltado');
  });

  it('offers to retry when the first reading failed', () => {
    const { onRetry } = renderInbox({ list: null, failed: true });
    fireEvent.click(screen.getByTestId('reintentar-bandeja'));
    expect(onRetry).toHaveBeenCalled();
  });
});

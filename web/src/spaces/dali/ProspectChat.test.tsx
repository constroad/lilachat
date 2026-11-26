import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProspectView } from '@lilachat/shared';
import { SheetInColumn } from './daliParts';
import { ProspectChat } from './ProspectChat';
import { prospectOf } from './daliTestData';
import { sendChange, sendHandBack, useProspectOfChat } from './sellerDesk';

vi.mock('./sellerDesk', () => ({ useProspectOfChat: vi.fn(), sendChange: vi.fn(), sendHandBack: vi.fn() }));

const reading = vi.mocked(useProspectOfChat);
const CARMEN = prospectOf({ name: 'Carmen Villanueva', source: { kind: 'ctwa', adTitle: 'Asfalto para condominios' }, assignee: { id: 'u-rosa', name: 'Rosa Quispe' }, attendedBy: 'human' });

function show(prospect: ProspectView | null, options: { phone?: boolean; inColumn?: boolean } = {}) {
  reading.mockReturnValue({ prospect, setProspect: vi.fn(), reload: vi.fn() });
  render(
    <SheetInColumn.Provider value={options.inColumn ?? false}>
      <ProspectChat jwt="jwt" spaceId="space" chatId="chat-1" chatName="Carmen Villanueva" me="u-me" phone={options.phone} onNotice={vi.fn()}>
        {(parts) => (
          <div>
            <header data-testid="cabecera">{parts.ownHeader.avatar}<div data-testid="linea">{parts.ownHeader.subtitle}</div>{parts.ownHeader.actions}</header>
            {parts.strip}
          </div>
        )}
      </ProspectChat>
    </SheetInColumn.Provider>,
  );
}

beforeEach(() => vi.mocked(sendHandBack).mockResolvedValue({ ok: true, prospect: { ...CARMEN, attendedBy: 'dali', version: 2 } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProspectChat (dl-02 header and strip)', () => {
  it('puts the phone and the origin under the name, and calls with the dialer, never a Lilachat call', () => {
    show(CARMEN);
    expect(screen.getByTestId('linea').textContent).toBe('+51 949 123 824Meta');
    expect(screen.getByTestId('cabecera-llamar').getAttribute('href')).toBe('tel:+51949123824');
    expect(screen.getByTestId('cabecera').textContent).toContain('CV');
  });

  it('on a computer offers the ficha and «Marcar resultado»; the third column already shows the ficha', () => {
    show(CARMEN);
    expect(screen.getByTestId('cabecera-ficha')).toBeTruthy();
    expect(screen.getByTestId('cabecera-marcar-resultado')).toBeTruthy();
    cleanup();
    show(CARMEN, { inColumn: true });
    expect(screen.queryByTestId('cabecera-ficha')).toBeNull();
    // dl-01 v4: the call stays in the header; the ficha beside it does not repeat it.
    expect(screen.getByTestId('cabecera-llamar')).toBeTruthy();
  });

  it('on a phone leaves the result to the ficha', () => {
    show(CARMEN, { phone: true });
    expect(screen.getByTestId('cabecera-ficha')).toBeTruthy();
    expect(screen.queryByTestId('cabecera-marcar-resultado')).toBeNull();
    expect(screen.getByTestId('franja-prospecto').textContent).toContain('Dali en pausa');
  });

  it('says who attends it, that Dali is paused, and hands it back to Dali', async () => {
    show(CARMEN);
    expect(screen.getByTestId('franja-prospecto').textContent).toContain('Atiende Rosa Quispe');
    expect(screen.queryByTestId('franja-tomar')).toBeNull();
    fireEvent.click(screen.getByTestId('franja-devolver-a-dali'));
    await vi.waitFor(() => expect(sendHandBack).toHaveBeenCalledWith('jwt', 'space', CARMEN));
  });

  it('offers «Tomar» while nobody attends it', () => {
    vi.mocked(sendChange).mockResolvedValue({ ok: true, prospect: CARMEN });
    show({ ...CARMEN, assignee: undefined, attendedBy: 'dali' });
    expect(screen.getByTestId('franja-prospecto').textContent).toContain('Sin asignar');
    fireEvent.click(screen.getByTestId('franja-tomar'));
    expect(sendChange).toHaveBeenCalledWith('jwt', 'space', expect.objectContaining({ id: CARMEN.id }), { assignee: 'me' });
  });

  it('with a result shows it and nothing to take, hand back or mark', () => {
    show({ ...CARMEN, result: { outcome: 'lost', reason: 'price', at: '2026-11-17T15:00:00.000Z' } });
    expect(screen.getByTestId('franja-prospecto').textContent).toBe('Perdido · Precio');
    expect(screen.queryByTestId('franja-devolver-a-dali')).toBeNull();
    expect(screen.queryByTestId('cabecera-marcar-resultado')).toBeNull();
  });

  it('while it loads keeps the initials and the line, without actions or strip', () => {
    show(null);
    expect(screen.getByTestId('cabecera').textContent).toContain('CV');
    expect(screen.queryByTestId('cabecera-llamar')).toBeNull();
    expect(screen.queryByTestId('franja-prospecto')).toBeNull();
  });
});

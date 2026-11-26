import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProspectView } from '@lilachat/shared';
import { ProspectSheet } from './ProspectSheet';
import { minutesAgo, NOW, prospectOf } from './daliTestData';
import { sendChange } from './sellerDesk';

vi.mock('./sellerDesk', () => ({ sendChange: vi.fn(), sendHandBack: vi.fn(), sendFieldConfirmation: vi.fn() }));
vi.mock('./ClientDocumentsCard', () => ({ ClientDocumentsCard: () => null }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const CARMEN = prospectOf({
  name: 'Carmen Villanueva', score: 86, stage: 'visit', scoreReasons: ['450 m²', 'Ate dentro de zona', 'Antes de fin de mes', 'Pidió visita técnica'],
  source: { kind: 'ctwa', adTitle: 'Asfalto para condominios' }, nextAction: { kind: 'visit', at: minutesAgo(-60), assigneeId: 'u-me' },
});

function show(prospect: ProspectView, options: { fromFunnel?: boolean } = {}) {
  render(<ProspectSheet jwt="jwt" spaceId="space" me="u-me" prospect={prospect} now={NOW} onChanged={vi.fn()} onStale={vi.fn()} onNotice={vi.fn()} resultInHeader onOpenConversation={options.fromFunnel ? vi.fn() : undefined} />);
}

describe('ProspectSheet (dl-01 v4, compact)', () => {
  it('opens with who, the three pills and the next action before anything else', () => {
    show(CARMEN);
    const sheet = screen.getByTestId('ficha-prospecto').textContent ?? '';
    const pills = screen.getByTestId('ficha-pastillas');
    expect(pills.querySelector('[data-testid="pastilla-puntaje"]')?.textContent).toMatch(/^86 · /);
    expect(pills.querySelector('[data-testid="pastilla-etapa"]')?.textContent).toBe('Visita');
    expect(pills.children).toHaveLength(3);
    expect(sheet.indexOf('Próxima acción')).toBeLessThan(sheet.indexOf('Lo que entendió Dali') === -1 ? Infinity : sheet.indexOf('Lo que entendió Dali'));
    expect(sheet.indexOf('Próxima acción')).toBeLessThan(sheet.indexOf('Etapa'));
  });

  it('«Hecho» clears the next action', () => {
    vi.mocked(sendChange).mockResolvedValue({ ok: true, prospect: { ...CARMEN, nextAction: undefined } });
    show(CARMEN);
    fireEvent.click(screen.getByTestId('proxima-hecha'));
    expect(sendChange).toHaveBeenCalledWith('jwt', 'space', CARMEN, { next_action: null });
  });

  it('without a next action offers to schedule one and has no «Hecho»', () => {
    show({ ...CARMEN, nextAction: undefined });
    expect(screen.getByTestId('agendar-proxima').textContent).toBe('Agendar próxima acción');
    expect(screen.queryByTestId('proxima-hecha')).toBeNull();
  });

  it('the stage is one row with the current one named; the reasons and the origin come folded', () => {
    show(CARMEN);
    expect(screen.getByTestId('etapa-actual').textContent).toBe('Visita');
    expect(screen.getByTestId('ficha-calificacion').tagName).toBe('DETAILS');
    expect(screen.getByTestId('ficha-calificacion').hasAttribute('open')).toBe(false);
    expect(screen.getByTestId('ficha-calificacion').textContent).toContain('4 razones');
    expect(screen.getByTestId('ficha-origen').tagName).toBe('DETAILS');
  });

  it('calls only when no conversation header is beside it (opened from the funnel)', () => {
    show(CARMEN);
    expect(screen.queryByTestId('llamar-prospecto')).toBeNull();
    cleanup();
    show(CARMEN, { fromFunnel: true });
    expect(screen.getByTestId('llamar-prospecto').getAttribute('href')).toBe(`tel:+${CARMEN.phone}`);
  });
});

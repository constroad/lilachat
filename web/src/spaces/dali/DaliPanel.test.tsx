import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DaliPanel } from './DaliPanel';
import { listOf, minutesAgo, NOW, prospectOf } from './daliTestData';

afterEach(cleanup);

const BOARD = [
  prospectOf({ id: 'p-won', name: 'Luis Mendoza', source: { kind: 'ctwa', adTitle: 'Patios de maniobra' }, score: 78, stage: 'quoted', quote: { code: 'COT-1', amount: 96000, currency: 'PEN', sentAt: minutesAgo(30) }, result: { outcome: 'won', at: minutesAgo(10) } }),
  prospectOf({ id: 'p-open', name: 'Elena Rojas', score: 64, stage: 'missing_info' }),
];

const headOf = (title: string): string[] => [...screen.getByText(title).closest('section')!.querySelectorAll('th')].map((cell) => cell.textContent ?? '');

describe('DaliPanel (dl-04 v3, v5 on a phone)', () => {
  it('keeps the columns that fit on a phone', () => {
    render(<DaliPanel list={listOf(BOARD)} now={NOW} phone />);
    expect(headOf('Por origen')).toEqual(['Origen', 'Prosp.', 'Ganados', 'Conv.']);
    expect(headOf('Por anuncio')).toEqual(['Anuncio', 'Prosp.', 'Ganados']);
  });

  it('shows every column on a computer', () => {
    render(<DaliPanel list={listOf(BOARD)} now={NOW} />);
    expect(headOf('Por origen')).toEqual(['Origen', 'Prosp.', 'Calif.', 'Cotiz.', 'Ganados', 'Conv.']);
  });

  it('shows the amount won only to the space admins', () => {
    render(<DaliPanel list={listOf(BOARD, true)} now={NOW} />);
    expect(screen.getByTestId('panel-monto').textContent).toContain('96,000.00');
    cleanup();
    render(<DaliPanel list={listOf(BOARD, false)} now={NOW} />);
    expect(screen.queryByTestId('panel-monto')).toBeNull();
  });
});

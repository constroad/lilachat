import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Recurrence, RepeatRule } from '@lilachat/shared';
import { useState } from 'react';
import { RepeatPickerWeb } from './RepeatPickerWeb';

/** Tue 20 Oct 2026, 9:00 in Lima. */
const STARTS = new Date(Date.UTC(2026, 9, 20, 14, 0));

function Harness({ onSave }: { onSave: (value: { recurrence: Recurrence; rule?: RepeatRule }) => void }) {
  const [state, setState] = useState<{ recurrence: Recurrence; rule?: RepeatRule }>({ recurrence: 'once' });
  return (
    <>
      <RepeatPickerWeb recurrence={state.recurrence} rule={state.rule} startsAt={STARTS} onChange={(recurrence, rule) => { setState({ recurrence, rule }); onSave({ recurrence, rule }); }} />
    </>
  );
}

describe('RepeatPickerWeb (pending 65)', () => {
  it('weekly starts on the start day, adds Thursday and says it', () => {
    // Arrange
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    // Act
    fireEvent.click(screen.getByTestId('repetir-weekly'));
    fireEvent.click(screen.getByTestId('dia-4'));
    // Assert
    expect(onSave).toHaveBeenLastCalledWith({ recurrence: 'weekly', rule: { weekdays: [2, 4] } });
    expect(screen.getByTestId('resumen-repetir').textContent).toMatch(/^Se repite los martes y jueves a las/);
  });

  it('never leaves a week without days', () => {
    // Arrange
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.click(screen.getByTestId('repetir-weekly'));
    // Act: unselect the only day
    fireEvent.click(screen.getByTestId('dia-2'));
    // Assert
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('dia-2').getAttribute('aria-pressed')).toBe('true');
  });

  it('monthly on the last day, every 2 months', () => {
    // Arrange
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    // Act
    fireEvent.click(screen.getByTestId('repetir-monthly'));
    fireEvent.click(screen.getByTestId('mensual-last'));
    fireEvent.click(screen.getByTestId('cada-mas'));
    // Assert
    expect(onSave).toHaveBeenLastCalledWith({ recurrence: 'monthly', rule: { monthDay: 'last', day: 20, every: 2 } });
    expect(screen.getByTestId('resumen-repetir').textContent).toMatch(/^Se repite el último día cada 2 meses a las/);
  });
});

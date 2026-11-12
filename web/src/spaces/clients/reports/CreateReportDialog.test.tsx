import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateReportDialog } from './CreateReportDialog';

// The observation types open here only while the switch is on: the test turns it on for itself.
vi.mock('@lilachat/shared', async (original) => {
  const shared = await original<typeof import('@lilachat/shared')>();
  return { ...shared, REPORT_TYPE_OPTIONS: shared.REPORT_TYPE_OPTIONS.map((option) => (shared.isObservationType(option.code) ? { ...option, opensHere: true } : option)) };
});

describe('CreateReportDialog', () => {
  it('an observation opens at once: no one types a responsible in the field (stitch-design §5-ter rule 1)', async () => {
    const pick = vi.fn();
    render(<CreateReportDialog people={['Ana']} onPick={pick} onClose={vi.fn()} />);

    await userEvent.click(screen.getByTestId('tipo-informe-REG-OBS'));

    expect(pick).toHaveBeenCalledWith('REG-OBS', '');
    expect(screen.queryByTestId('responsable-de-informe')).toBeNull();
  });

  it('a field report still asks who is responsible first (José 06/11)', async () => {
    const pick = vi.fn();
    render(<CreateReportDialog people={['Ana']} onPick={pick} onClose={vi.fn()} />);

    await userEvent.click(screen.getByTestId('tipo-informe-CTL-PIS'));

    expect(pick).not.toHaveBeenCalled();
    expect(screen.getByTestId('responsable-de-informe')).toBeTruthy();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReportTypeOption } from '@lilachat/shared';
import { CreateReportDialog } from './CreateReportDialog';

// The observation types open here only while the switch is on: the test turns it on for itself.
vi.mock('@lilachat/shared', async (original) => {
  const shared = await original<typeof import('@lilachat/shared')>();
  const switchedOn = (option: ReportTypeOption): ReportTypeOption => (shared.isObservationType(option.code) ? { ...option, opensHere: true } : option);
  return { ...shared, pickerReportTypes: (...args: Parameters<typeof shared.pickerReportTypes>) => shared.pickerReportTypes(...args).map(switchedOn) };
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

/** José 16/11: the web also opens Portal's editor 2.0 for its block sheets; the APK keeps the public page's types. */
describe('CreateReportDialog and Portal\'s block sheets', () => {
  const BLOCK_SHEETS = ['ACT-CNF', 'REC-EXC', 'MET-RES', 'CAL-PROT', 'TOP-CMP', 'INF-ACT', 'PNL-FOT', 'CONT-SRV', 'DOS-OBR'];
  const blockRows = () => BLOCK_SHEETS.map((code) => screen.queryByTestId(`tipo-informe-${code}`));

  it('on the wide web whoever sees money also gets the nine, each a button with its own icon, asking who is responsible', async () => {
    // Arrange
    const pick = vi.fn();
    render(<CreateReportDialog people={['Ana']} seesMoney inEditor={() => true} onPick={pick} onClose={vi.fn()} />);
    const rows = blockRows();
    // Act
    await userEvent.click(screen.getByTestId('tipo-informe-MET-RES'));
    // Assert
    expect(rows.map((row) => row?.tagName)).toEqual(BLOCK_SHEETS.map(() => 'BUTTON'));
    const icons = rows.map((row) => row?.querySelector('svg')?.getAttribute('class'));
    expect(new Set(icons).size).toBe(BLOCK_SHEETS.length);
    expect(icons.filter((icon) => icon?.includes('lucide-droplets'))).toEqual([]);
    expect(pick).not.toHaveBeenCalled();
    expect(screen.getByTestId('responsable-de-informe')).toHaveTextContent('Cuadro Resumen de Metrado');
  });

  it('a member without money gets none of them, money or not (José 07/11: «todo lo que es plata solo admins»)', () => {
    // Arrange
    render(<CreateReportDialog seesMoney={false} inEditor={() => true} onPick={vi.fn()} onClose={vi.fn()} />);
    // Act
    const rows = blockRows();
    // Assert
    expect(rows.filter(Boolean)).toEqual([]);
    expect(screen.getAllByTestId(/^tipo-informe-/)).toHaveLength(9);
  });

  it('where Portal\'s editor does not open (the phone-width web, like the APK) nobody gets one, not even with money', () => {
    // Arrange
    render(<CreateReportDialog seesMoney inEditor={() => false} onPick={vi.fn()} onClose={vi.fn()} />);
    // Act
    const rows = blockRows();
    // Assert
    expect(rows.filter(Boolean)).toEqual([]);
    expect(screen.getAllByTestId(/^tipo-informe-/)).toHaveLength(10); // the public page's nine plus the approval, filled here with money since 18/11
  });
});

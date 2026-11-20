import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fieldDocumentOf, OPTIONAL_SAMPLE_TAG, PARTIAL_SAMPLE_LINE, reportFormAnswer, SAMPLES_NOTE, type FormSchema, type FormSubmitOutcome } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

/** A CTL-IMP tramo as Portal sends it (imprimacionFields.ts): «ubicacion» and the three trays. */
const TRAY_TITLES: Record<string, string> = { pesoSin: 'peso vacío', pesoCon: 'con asfalto', area: 'área' };
const trayNames = [1, 2, 3].flatMap((tray) => Object.keys(TRAY_TITLES).map((base) => `${base}${tray}`));
const bandejas: FormSchema = {
  type: 'object',
  properties: Object.fromEntries([1, 2, 3].flatMap((tray) => Object.entries(TRAY_TITLES).map(([base, title]) => [`${base}${tray}`, { type: 'number', title: `Bandeja ${tray} · ${title}`, 'x-unit': base === 'area' ? 'm²' : 'g', 'x-width': 'half' }]))),
  required: trayNames,
};
const ubicacion: FormSchema = {
  type: 'object',
  properties: {
    tramo: { type: 'string', title: 'Tramo', maxLength: 200 },
    carril: { type: 'string', title: 'Carril', maxLength: 200 },
    progresivaDesde: { type: 'string', title: 'Progresiva de', maxLength: 200, 'x-width': 'half' },
    progresivaHasta: { type: 'string', title: 'Progresiva al', maxLength: 200, 'x-width': 'half' },
  },
  required: ['tramo'],
};
const documentOf = (type: string, saved: { bandejas?: Record<string, unknown>; ubicacion?: Record<string, unknown> } = {}) => fieldDocumentOf({
  id: 'r1', type, title: 'Control', status: 'draft',
  forms: { ubicacion, bandejas },
  sections: [{ id: 'tramos', title: 'Tramos', required: true, state: 'partial', repeat: { itemTitle: 'Tramo', addLabel: 'Agregar tramo', min: 1, template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }, { id: 'bandejas', title: 'Bandejas', required: true, form: 'bandejas' }] }, items: [{ id: 't1', title: 'Tramo 1', summary: [], results: [], sections: [{ id: 'ubicacion', state: 'empty', values: saved.ubicacion ?? {} }, { id: 'bandejas', state: 'empty', values: saved.bandejas ?? {} }] }] }],
  publish: { label: 'Publicar informe', missing: [] },
})!;
const open = (key: 'bandejas' | 'ubicacion', type = 'CTL-IMP', saved = {}) => {
  const answer = reportFormAnswer(documentOf(type, saved), { sectionId: 'tramos', itemId: 't1', key })!;
  const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: true, answer: null }));
  render(<AppFormDialog answer={answer} onSubmit={onSubmit} onUpload={vi.fn(async () => ({ ok: true as const, fileId: 'f1' }))} onClose={() => undefined} />);
  return { onSubmit };
};

describe('CTL-IMP trays as compact rows (design imp-01/imp-03, José 19/11)', () => {
  it('one row per tray, the note «Basta una completa» and each row\'s state', () => {
    // Act
    open('bandejas', 'CTL-IMP', { bandejas: { pesoSin1: 1560, pesoCon1: 1720, area1: 0.178, pesoSin2: 1705 } });
    // Assert
    expect(screen.getByTestId('bandejas-filas')).toHaveTextContent(SAMPLES_NOTE);
    expect(screen.getByTestId('bandeja-1')).toHaveAttribute('data-state', 'complete');
    expect(screen.getByTestId('bandeja-2')).toHaveAttribute('data-state', 'partial');
    expect(within(screen.getByTestId('bandeja-2')).getByRole('alert')).toHaveTextContent(PARTIAL_SAMPLE_LINE);
    expect(screen.getByTestId('bandeja-3')).toHaveTextContent(OPTIONAL_SAMPLE_TAG);
  });

  it('typing in a row updates its state, and «Guardar» sends what a plain number field sends', async () => {
    // Arrange
    const { onSubmit } = open('bandejas');
    // Act
    fireEvent.change(screen.getByTestId('campo-pesoSin1'), { target: { value: '1560' } });
    expect(screen.getByTestId('bandeja-1')).toHaveAttribute('data-state', 'partial');
    fireEvent.change(screen.getByTestId('campo-pesoCon1'), { target: { value: '1720' } });
    fireEvent.change(screen.getByTestId('campo-area1'), { target: { value: '0.178' } });
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    expect(screen.getByTestId('bandeja-1')).toHaveAttribute('data-state', 'complete');
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ pesoSin1: '1560', pesoCon1: '1720', area1: '0.178' }));
  });

  it('the compact button is 52 px', () => {
    open('bandejas');
    expect(screen.getByTestId('btn-enviar-formulario').className).toContain('h-[52px]');
  });

  it('another report keeps one field per tray value', () => {
    open('bandejas', 'CON-CAP');
    expect(screen.queryByTestId('bandejas-filas')).toBeNull();
    expect(screen.getByTestId('btn-enviar-formulario').className).not.toContain('h-[52px]');
  });
});

describe('CTL-IMP lane as chips (design imp-01)', () => {
  it('a chip writes its text, and the saved lane comes picked', async () => {
    // Arrange
    const { onSubmit } = open('ubicacion', 'CTL-IMP', { ubicacion: { tramo: 'JR CONCHUCOS', carril: 'Derecho' } });
    expect(screen.getByTestId('opcion-carril-Derecho')).toHaveAttribute('aria-checked', 'true');
    // Act
    fireEvent.click(screen.getByTestId('opcion-carril-Ambos'));
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ tramo: 'JR CONCHUCOS', carril: 'Ambos' }));
  });

  it('a lane written before the chips stays shown and picked', () => {
    open('ubicacion', 'CTL-IMP', { ubicacion: { tramo: 'T', carril: 'Eje central' } });
    expect(screen.getByTestId('opcion-carril-Eje central')).toHaveAttribute('aria-checked', 'true');
  });

  it('the progresivas come before the lane', () => {
    open('ubicacion');
    const order = [...document.querySelectorAll('[data-field]')].map((node) => node.getAttribute('data-field'));
    expect(order).toEqual(['tramo', 'progresivaDesde', 'progresivaHasta', 'carril']);
  });
});

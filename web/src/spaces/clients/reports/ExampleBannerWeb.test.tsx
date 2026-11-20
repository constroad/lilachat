import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fieldDocumentOf, type ExampleOutcome, type FieldDocument } from '@lilachat/shared';
import { ExampleBannerWeb } from './ExampleBannerWeb';

const reportWith = (example: boolean, status: 'draft' | 'published' = 'draft'): FieldDocument => fieldDocumentOf({
  id: 'r1', type: 'CTL-IMP', title: 'Control de imprimación', status,
  forms: { general: { type: 'object', properties: { liquido: { type: 'string', title: 'Líquido' } } } },
  sections: [{ id: 'general', title: 'Datos generales', required: true, state: 'empty', summary: [], results: [], form: 'general', values: {}, ...(example ? { example: { liquido: 'MC-30' } } : {}) }],
  publish: { label: 'Publicar informe', missing: [] },
})!;

const show = (report: FieldDocument, onFill = vi.fn(async (): Promise<ExampleOutcome> => ({ saved: 1, skipped: [] }))) => {
  const view = render(<ExampleBannerWeb report={report} serviceId="sv1" type="CTL-IMP" onFill={onFill} />);
  return { onFill, ...view };
};

afterEach(() => window.localStorage.clear());

describe('ExampleBannerWeb (design imp-05, José 20/11)', () => {
  it('a draft with examples shows it; without them, or published, nothing', () => {
    show(reportWith(true));
    expect(screen.getByTestId('aviso-datos-ejemplo')).toHaveTextContent('¿Probando?');
    expect(screen.getByTestId('completar-datos-ejemplo')).toHaveTextContent('Completar datos de ejemplo');
  });

  it('nothing to fill or a published report: no banner', () => {
    show(reportWith(false));
    expect(screen.queryByTestId('aviso-datos-ejemplo')).toBeNull();
    show(reportWith(true, 'published'));
    expect(screen.queryByTestId('aviso-datos-ejemplo')).toBeNull();
  });

  it('fills through the screen and says how it went', async () => {
    // Arrange
    const { onFill } = show(reportWith(true));
    // Act
    fireEvent.click(screen.getByTestId('completar-datos-ejemplo'));
    // Assert
    await waitFor(() => expect(screen.getByTestId('aviso-datos-ejemplo-estado')).toHaveTextContent('1 sección completada'));
    expect(onFill).toHaveBeenCalledTimes(1);
  });

  it('a fill that breaks says so and the button works again', async () => {
    show(reportWith(true), vi.fn(async (): Promise<ExampleOutcome> => { throw new Error('boom'); }));
    fireEvent.click(screen.getByTestId('completar-datos-ejemplo'));
    await waitFor(() => expect(screen.getByTestId('aviso-datos-ejemplo-estado')).toHaveTextContent('No se pudo completar el ejemplo'));
    expect(screen.getByTestId('completar-datos-ejemplo')).not.toBeDisabled();
  });

  it('closed, it stays closed for this report on this browser', () => {
    const first = show(reportWith(true));
    fireEvent.click(screen.getByTestId('ocultar-datos-ejemplo'));
    expect(screen.queryByTestId('aviso-datos-ejemplo')).toBeNull();
    first.unmount();
    show(reportWith(true));
    expect(screen.queryByTestId('aviso-datos-ejemplo')).toBeNull();
  });
});

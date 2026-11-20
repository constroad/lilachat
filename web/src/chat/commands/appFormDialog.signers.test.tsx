import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fieldDocumentOf, reportFormAnswer, ROLE_EMPTY_LINE, type FormSchema, type FormSubmitOutcome } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

/** CTL-IMP's «firmas» as Portal sends it (imprimacionFields.ts): four optional texts per role. */
const roleFields = (prefix: string, role: string) => Object.fromEntries(['nombre', 'cargo', 'empresa', 'CIP'].map((part) => [`${prefix}${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`, { type: 'string', title: `${role} · ${part}`, maxLength: 200 }]));
const firmas: FormSchema = { type: 'object', properties: { ...roleFields('responsable', 'Responsable'), ...roleFields('supervisadoPor', 'Supervisado por'), ...roleFields('cliente', 'Cliente') } };

const open = (type: string, values: Record<string, unknown> = {}) => {
  const document = fieldDocumentOf({
    id: 'r1', type, title: 'Control de imprimación', status: 'draft', forms: { firmas },
    sections: [{ id: 'firmas', title: 'Responsables y firmas', required: false, state: 'empty', summary: [], results: [], form: 'firmas', values }],
    publish: { label: 'Publicar informe', missing: [] },
  })!;
  const answer = reportFormAnswer(document, { sectionId: 'firmas', itemId: null, key: 'firmas' })!;
  const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: true, answer: null }));
  render(<AppFormDialog answer={answer} onSubmit={onSubmit} onUpload={vi.fn(async () => ({ ok: true as const, fileId: 'f1' }))} onClose={() => undefined} />);
  return { onSubmit };
};

describe('«Responsables y firmas» as role cards (design imp-04, José 20/11)', () => {
  it('the responsible opens with its fields; the others fold with their name or «Sin datos»', () => {
    // Act
    open('CTL-IMP', { responsableNombre: 'J zamora', supervisadoPorNombre: 'Ana Torres', supervisadoPorCargo: 'Supervisora' });
    // Assert
    expect(screen.getByTestId('rol-responsable')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('campo-responsableNombre')).toHaveValue('J zamora');
    expect(screen.getByTestId('rol-supervisado-por')).toHaveTextContent('Ana Torres · Supervisora');
    expect(screen.getByTestId('rol-cliente')).toHaveTextContent(ROLE_EMPTY_LINE);
    expect(screen.queryByTestId('campo-clienteNombre')).toBeNull();
    expect(screen.getByTestId('btn-enviar-formulario')).toHaveTextContent('Listo');
  });

  it('one «opcional» at the top instead of one per field', () => {
    open('CTL-IMP');
    expect(screen.getByTestId('roles-firmas')).toHaveTextContent('Todo es opcional');
    expect(within(screen.getByTestId('rol-responsable')).queryByText(/opcional/)).toBeNull();
    expect(within(screen.getByTestId('rol-responsable')).getByText('Nombre')).toBeInTheDocument();
  });

  it('one open at a time: opening the client folds the responsible', () => {
    open('CTL-IMP');
    fireEvent.click(screen.getByTestId('rol-cliente'));
    expect(screen.getByTestId('rol-cliente')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('rol-responsable')).not.toHaveAttribute('data-open');
  });

  it('«Listo» saves the same field names and values as before', async () => {
    // Arrange
    const { onSubmit } = open('CTL-IMP', { responsableNombre: 'J zamora' });
    // Act
    fireEvent.click(screen.getByTestId('rol-cliente'));
    fireEvent.change(screen.getByTestId('campo-clienteNombre'), { target: { value: 'Luis Mendoza' } });
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ responsableNombre: 'J zamora', clienteNombre: 'Luis Mendoza' }));
  });

  it('another report keeps its twelve plain fields', () => {
    open('CON-CAP');
    expect(screen.queryByTestId('roles-firmas')).toBeNull();
    expect(screen.getByTestId('campo-clienteCip')).toBeInTheDocument();
    expect(screen.getByTestId('btn-enviar-formulario')).toHaveTextContent('Guardar');
  });
});

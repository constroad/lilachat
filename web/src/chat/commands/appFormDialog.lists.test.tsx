import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EphemeralAnswer, FormSchemaProperty, FormSubmitOutcome } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

/** Portal's `crear_pedido` with its trucks as rows (José, 28/10) and a quote's products as cards (agentes). */
const answerWith = (properties: Record<string, FormSchemaProperty>, required: string[]): EphemeralAnswer => ({
  commandId: 'c1',
  appName: 'Portal',
  command: '',
  action: 'Crear un pedido',
  state: 'form',
  response: { responseType: 'form', form: { id: 'crear_pedido', title: 'Crear un pedido', schema: { type: 'object', properties, required } } },
});
const trucks: Record<string, FormSchemaProperty> = {
  despachos: {
    type: 'array', title: 'Carros', minItems: 1, maxItems: 3, default: [{ carros: 1, m3: 25 }],
    items: { type: 'object', required: ['carros', 'm3'], properties: { carros: { type: 'integer', title: 'Carros', minimum: 1 }, m3: { type: 'number', title: 'm³ por carro', 'x-unit': 'm³', exclusiveMinimum: 0 } } },
  },
};
const products: Record<string, FormSchemaProperty> = {
  items: {
    type: 'array', title: 'Productos', minItems: 1, 'x-add-label': 'Agregar producto',
    items: { type: 'object', required: ['producto', 'detalle'], properties: { producto: { type: 'string', enum: ['mezcla', 'otro'], 'x-labels': { mezcla: 'Mezcla', otro: 'Otro' } }, detalle: { type: 'string', title: 'Qué otro', 'x-visible-if': { producto: ['otro'] } } } },
  },
};
const draw = (answer: EphemeralAnswer, onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: true, answer: null }))) => {
  render(<AppFormDialog answer={answer} onSubmit={onSubmit} onUpload={vi.fn()} onClose={vi.fn()} />);
  return onSubmit;
};
const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

describe('a list in the web form (José and agentes, 28/10)', () => {
  it('trucks are rows: it starts with the app\'s row, adds and removes rows, and sends an array', async () => {
    // Arrange
    const onSubmit = draw(answerWith(trucks, ['despachos']));
    // Act
    fireEvent.click(screen.getByTestId('agregar-despachos'));
    type('campo-despachos-0-carros', '2');
    type('campo-despachos-1-carros', '1');
    type('campo-despachos-1-m3', '15');
    fireEvent.click(screen.getByTestId('agregar-despachos'));
    fireEvent.click(screen.getByTestId('quitar-despachos-2'));
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    expect((screen.getByTestId('campo-despachos-0-m3') as HTMLInputElement).value).toBe('25');
    // What was typed goes as typed: the server cleans it with the same rules before the app hears it.
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ despachos: [{ carros: '2', m3: 25 }, { carros: '1', m3: '15' }] }));
  });

  it('a wrong cell is said under its row; a full list hides the button; the last row cannot be removed', () => {
    // Arrange
    const onSubmit = draw(answerWith(trucks, ['despachos']));
    // Act
    type('campo-despachos-0-m3', '0');
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    expect(screen.getByTestId('fila-despachos-0').textContent).toContain('m³ por carro: Mayor que 0.');
    expect(screen.getByTestId('campo-despachos-0-m3').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByTestId('quitar-despachos-0')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('agregar-despachos'));
    fireEvent.click(screen.getByTestId('agregar-despachos'));
    expect(screen.queryByTestId('agregar-despachos')).toBeNull();
  });

  it('products are cards with the app\'s button; a field shows for its answer inside its own item; the app\'s errors land by path', async () => {
    // Arrange
    const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: false, errors: { 'items[1].detalle': 'Ese producto no existe.' } }));
    draw(answerWith(products, ['items']), onSubmit);
    // Act
    fireEvent.click(screen.getByText('Agregar producto'));
    fireEvent.click(screen.getAllByText('Mezcla')[0]!);
    fireEvent.click(screen.getAllByText('Otro')[1]!);
    type('campo-detalle', 'Imprimante');
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    expect(screen.getAllByTestId('campo-detalle')).toHaveLength(1);
    await vi.waitFor(() => expect(screen.getByTestId('item-items-1').textContent).toContain('Ese producto no existe.'));
    expect(onSubmit).toHaveBeenCalledWith({ items: [{ producto: 'mezcla' }, { producto: 'otro', detalle: 'Imprimante' }] });
  });
});

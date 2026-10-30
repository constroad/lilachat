import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EphemeralAnswer, FormSchemaProperty, FormSubmitOutcome, FormValues, PreviewReply } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';
import { LIVE_DEBOUNCE_MS } from './useFormLive';

/** Wilson's fuel consumption (agentes 2483da7, designs h-01…h-04). */
const PEN = 'pen1';
const OIL = 'oil1';
const reading = (id: string, tank: string, title: string, extra: Record<string, unknown> = {}) => ({ const: id, title, 'x-match': { tanque: tank }, 'x-thumb': `https://lila.constroad.com/t/${id}.jpg`, 'x-photos': [`https://lila.constroad.com/f/${id}.jpg`], ...extra });
const READINGS = [reading('r1', PEN, '23 oct · 82 cm'), reading('r2', PEN, '29 oct · 31 cm'), reading('r3', OIL, '23 oct · 140 cm'), reading('r9', PEN, '22 oct · 85 cm', { 'x-disabled': true, description: 'Usada en el consumo del 22/10' })];
const properties: Record<string, FormSchemaProperty> = {
  desde: { type: 'string', format: 'date', title: 'Desde', default: '2026-10-23', 'x-refresh': true },
  pedidos: { type: 'array', title: 'Pedidos del periodo', minItems: 1, items: { type: 'string', oneOf: [{ const: 'p1', title: 'PED-2026-1214' }, { const: 'p9', title: 'PED-2026-1209', description: 'Usado en el consumo del 22/10', 'x-disabled': true } as never] } },
  lecturas: {
    type: 'array', title: 'Lecturas por tanque', 'x-fixed-rows': true, 'x-row-title': 'tanque', default: [{ tanque: PEN }, { tanque: OIL }],
    items: { type: 'object', required: ['tanque', 'inicioId'], properties: { tanque: { type: 'string', oneOf: [{ const: PEN, title: 'PEN-1 · Asfalto' }, { const: OIL, title: 'Petróleo · Diésel B5' }] }, inicioId: { type: 'string', title: 'Lectura de inicio', oneOf: READINGS } } },
  },
};
const answer: EphemeralAnswer = { commandId: 'c1', appName: 'Portal', command: '', action: 'Registrar consumo', state: 'form', response: { responseType: 'form', form: { id: 'registrar_consumo', title: 'Registrar consumo', preview: 'revisar_consumo', schema: { type: 'object', properties, required: ['pedidos', 'lecturas'] } } } };
const summary: PreviewReply = { blocks: [{ type: 'metric', value: '8.68', unit: 'gl/m³', label: 'Rendimiento', tone: 'warn' }], errors: { 'lecturas[0].inicioId': 'Revisa esta lectura.' } };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const draw = () => {
  const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: true, answer: null }));
  const onRefresh = vi.fn(async (_draft: FormValues) => undefined);
  const onPreview = vi.fn(async () => summary);
  render(<AppFormDialog answer={answer} onSubmit={onSubmit} onUpload={vi.fn()} onClose={vi.fn()} onRefresh={onRefresh} onPreview={onPreview} />);
  return { onSubmit, onRefresh, onPreview };
};
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(LIVE_DEBOUNCE_MS + 10); });

describe('the consumption form on the web', () => {
  it('orders as check rows; a locked one shows why and is never picked', () => {
    // Arrange
    draw();
    // Act
    fireEvent.click(screen.getByTestId('opcion-pedidos-p1'));
    fireEvent.click(screen.getByTestId('opcion-pedidos-p9'));
    // Assert
    expect(screen.getByTestId('opcion-pedidos-p1')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('opcion-pedidos-p9')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Usado en el consumo del 22/10')).toBeInTheDocument();
    expect(screen.getByTestId('elegidos-pedidos')).toHaveTextContent('1 elegido');
  });

  it('a fixed row per tank, titled by it, without adding nor removing; each offers only its own readings', () => {
    // Arrange
    draw();
    // Act
    fireEvent.click(screen.getAllByTestId('campo-inicioId')[1]!);
    // Assert
    expect(screen.getByTestId('titulo-lecturas-0')).toHaveTextContent('PEN-1 · Asfalto');
    expect(screen.getByTestId('titulo-lecturas-1')).toHaveTextContent('Petróleo · Diésel B5');
    expect(screen.queryByTestId('agregar-lecturas')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quitar-lecturas-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('opciones-inicioId').querySelectorAll('[role="radio"]')).toHaveLength(1);
    expect(screen.getByTestId('opcion-inicioId-r3')).toBeInTheDocument();
  });

  it('a reading is picked from the list with its thumbnail and confirmed with «Elegir»', () => {
    // Arrange
    draw();
    // Act
    fireEvent.click(screen.getAllByTestId('campo-inicioId')[0]!);
    fireEvent.click(screen.getByTestId('opcion-inicioId-r9'));
    fireEvent.click(screen.getByTestId('opcion-inicioId-r1'));
    fireEvent.click(screen.getByTestId('elegir-inicioId'));
    // Assert
    expect(screen.getAllByTestId('campo-inicioId')[0]).toHaveTextContent('23 oct · 82 cm');
  });

  it('the summary comes after a pause with its remarks under the field; a new period asks for the form again', async () => {
    // Arrange
    const { onRefresh, onPreview } = draw();
    // Act
    await settle();
    fireEvent.change(screen.getByTestId('campo-desde'), { target: { value: '2026-10-16' } });
    await settle();
    // Assert
    expect(onPreview).toHaveBeenCalled();
    expect(screen.getByTestId('formulario-resumen')).toHaveTextContent('8.68');
    expect(screen.getByText('Revisa esta lectura.')).toBeInTheDocument();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh.mock.calls[0]![0]).toMatchObject({ desde: '2026-10-16', lecturas: [{ tanque: PEN }, { tanque: OIL }] });
  });
});
